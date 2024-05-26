// Types
import type {
    CodeBackend,
    CodeConfiguration,
    CodeConfigureFn,
    CodeProcessFn,
    CodeProcessOptions,
    CodeProcessor,
    FullCodeConfiguration,
    FullCodeProcessOptions,
    ThemableCodeBackend,
} from '$types/handlers/Code.js';

// Internal dependencies
import { getDefaultCodeConfig } from '$config/defaults.js';
import { Handler } from '$handlers/Handler.js';
import { isThemableCodeBackend } from '$type-guards/code.js';
import { isArray } from '$type-guards/utils.js';
import { cdnLink, fancyFetch, fancyWrite } from '$utils/cdn.js';
import { log } from '$utils/debug.js';
import { diagnoseCodeConfiguration } from '$utils/diagnosers/codeConfiguration.js';
import {
    customEscapeSequencesToHtml,
    escapeBraces,
    uniqueEscapeSequences,
} from '$utils/escape.js';
import { fs } from '$utils/fs.js';
import { getVersion, missingDeps } from '$utils/env.js';
import { mergeConfigs } from '$utils/merge.js';
import { prefixWithSlash } from '$utils/misc.js';

// External dependencies
import { typeAssert, escapeHtml, is, join, pc } from '$deps.js';
import { ProcessedSnippet, UnescapeOptions } from '$types/utils/Escape.js';

export class CodeHandler<B extends CodeBackend> extends Handler<
    B,
    CodeBackend,
    CodeProcessor<B>,
    FullCodeProcessOptions,
    CodeConfiguration<B>,
    FullCodeConfiguration<B>,
    CodeHandler<B>
> {
    override get process(): (
        code: string,
        options?: CodeProcessOptions | undefined,
    ) => Promise<ProcessedSnippet> {
        return async (
            code: string,
            options?: CodeProcessOptions | undefined,
        ) => {
            if (this.configIsValid === undefined) {
                this.configIsValid =
                    diagnoseCodeConfiguration(this.backend, this.configuration)
                        .errors === 0;
            }

            let opts: FullCodeProcessOptions = {
                _wrap: true,
                inline: false,
            };

            if (options) opts = mergeConfigs(opts, options);

            let processed = code;
            if (opts.inline) {
                processed = processed.replace(/\r\n?|\n/gu, ' ');
            }
            const unescapeOptions: UnescapeOptions = {
                removeParagraphTag: !opts.inline,
            };

            if (!this.configIsValid) return { processed, unescapeOptions };

            await this.handleCss();

            processed = (await super.process(processed, opts)).processed;

            // If the `_wrap` option is set to `false`, don't wrap the output.
            // (This is sometimes used, for example, by the VerbatimHandler.)
            if (!opts._wrap) return { processed, unescapeOptions };

            const configuration = this.configuration;

            const wrapArray = configuration.wrap({
                ...opts,
                wrapClassPrefix: configuration.wrapClassPrefix,
            });

            if (!opts.inline) {
                processed = processed.replace(
                    /^(?:\r\n?|\n)(.*?)(?:\r\n?|\n)$/s,
                    '$1',
                );
                if (processed !== '' && !processed.match(/(?:\r\n?|\n)$/)) {
                    processed += '\n';
                }
            }

            processed = wrapArray[0] + processed + wrapArray[1];

            return { processed, unescapeOptions };
        };
    }

    /**
     * Lines of code that should be added to the `<svelte:head>` component
     * of any page that contains any code on which this handler ran. This
     * variable must be set at most once.
     */
    private _headLines: string[] = [];
    get headLines() {
        return this._headLines;
    }

    /**
     * Lines of code that should be added to the `<script>` tag
     * of any page that contains any TeX on which this handler ran. This
     * variable must be set at most once, and cannot depend on what page the
     * handler is being used on. These aren't necessarily the only lines that
     * will be added to the `<script>` tag on this handler's behalf, but they're
     * the only ones that don't depend on further details about the TeX content
     * of the page.
     */
    private _scriptLines: string[] = [];
    get scriptLines() {
        return this._scriptLines;
    }

    get handleCss() {
        return async () => {
            if (this._handledCss) return;
            this._handledCss = true;
            await this._handleCss();
        };
    }

    private configIsValid: boolean | undefined = undefined;
    private _handledCss: boolean = false;
    private async _handleCss() {
        // If the backend isn't themable, don't try to fetch any CSS
        if (!isThemableCodeBackend(this.backend)) return;

        // Unfortunately, TypeScript doesn't realize that, at this point, B
        // extends ThemableCodeBackend
        typeAssert(is<CodeHandler<ThemableCodeBackend>>(this));

        // Convenience alias + type assertion
        const theme = this.configuration.theme;
        const { name, mode, min, type } = theme;

        if (type === 'none') return;

        const { cdn } = theme;

        // The backend version, used to try to ensure that the fetched
        // stylesheet is compatible with the current version of the backend.
        const v: string =
            this.backend === 'highlight.js'
                ? (await getVersion(this.backend)) ?? 'latest'
                : 'latest';

        const resourceName =
            this.backend === 'highlight.js'
                ? `${name}${min ? '.min' : ''}.css`
                : `${name === 'default' ? '' : `${name}-`}${mode}.css`;
        const resource = `${this.backend === 'highlight.js' ? 'styles' : 'style'}/${resourceName}`;
        const pkg =
            this.backend === 'starry-night'
                ? '@wooorm/starry-night'
                : this.backend;
        const cdns = isArray(cdn) ? cdn : [cdn];
        const links = cdns.map((c) => cdnLink(pkg, resource, v, c));

        //
        if (type === 'cdn') {
            if (links[0]) {
                this._headLines = [
                    `<link rel="stylesheet" href="${links[0]}">`,
                ];
            }
            return;
        }

        const { dir } = theme;

        // Build the path to which we should write the fetched stylesheet
        const path = join(dir, `${this.backend}@${v}.${resourceName}`);

        // If the file already exists, don't fetch it again
        if (fs.existsSync(path)) return;

        // Fetch the CSS from a CDN
        const css = await fancyFetch(links);

        // If the fetch failed, don't try to write anything
        if (!css) return;

        // Write the fetched CSS to the specified path
        await fancyWrite(path, css);

        this._scriptLines = [`import '${prefixWithSlash(path)}';`];
    }

    /**
     * Creates a code handler of the specified type.
     *
     * @param backend - The type of the code processor to create.
     * @returns A promise that resolves to a code handler of the specified type.
     */
    static async create<B extends Exclude<CodeBackend, 'custom'>>(
        backend: B,
    ): Promise<CodeHandler<B>>;

    static async create<B extends 'custom'>(
        backend: B,
        {
            processor,
            process,
            configure,
            configuration,
        }: {
            processor?: CodeProcessor<'custom'>;
            process: CodeProcessFn<'custom'>;
            configure?: CodeConfigureFn<'custom'> | undefined;
            configuration?: CodeConfiguration<'custom'> | undefined;
        },
    ): Promise<CodeHandler<B>>;

    /**
     * Creates a code handler of the specified type.
     *
     * @param backend - The type of the code processor to create.
     * @returns A promise that resolves to a code handler of the specified type.
     */
    static async create<B extends CodeBackend>(
        backend: B,
        custom?: B extends 'custom'
            ? {
                  processor?: CodeProcessor<'custom'>;
                  process: CodeProcessFn<'custom'>;
                  configure?: CodeConfigureFn<'custom'> | undefined;
                  configuration?: CodeConfiguration<'custom'> | undefined;
              }
            : never,
    ) {
        switch (backend) {
            case 'custom':
                if (custom === undefined) {
                    throw new Error(
                        'Called CodeHandler.create("custom", custom) without a second parameter.',
                    );
                }
                return new CodeHandler<'custom'>({
                    backend: 'custom',
                    processor: custom.processor ?? {},
                    process: custom.process,
                    configure: custom.configure ?? (() => undefined),
                    configuration: mergeConfigs(
                        getDefaultCodeConfig('custom'),
                        custom.configuration ?? {},
                    ),
                });
            case 'highlight.js':
                try {
                    type Backend = 'highlight.js';
                    const processor = (await import('highlight.js')).default;
                    const handler = new CodeHandler<Backend>({
                        backend: 'highlight.js',
                        processor,
                        configuration: getDefaultCodeConfig('highlight.js'),
                        process: (code, { lang }, codeHandler) => {
                            return escapeBraces(
                                codeHandler.processor.highlight(code, {
                                    language: lang ?? 'plaintext',
                                }).value,
                            );
                        },
                        configure: (config, codeHandler) => {
                            codeHandler.processor.configure(config);
                        },
                    });
                    // Apparently, the highlight.js processor isn't
                    // serializable. This will upset Vite, so we need to.
                    // remove it from the object returned by `toJSON`
                    (handler as unknown as { toJSON: () => object }).toJSON =
                        () => {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { processor, ...rest } = handler;
                            return rest;
                        };
                    return handler;
                } catch (error) {
                    missingDeps.push('highlight.js');
                    throw error;
                }
            case 'starry-night':
                try {
                    type Backend = 'starry-night';
                    type Grammar = import('@wooorm/starry-night').Grammar;
                    const processor = await (
                        await import('@wooorm/starry-night')
                    ).createStarryNight([]);
                    const findAndReplace = (
                        await import('hast-util-find-and-replace')
                    ).findAndReplace;
                    const toHtml = (await import('hast-util-to-html')).toHtml;
                    return new CodeHandler<Backend>({
                        backend: 'starry-night',
                        processor,
                        process: (code, { lang }, codeHandler) => {
                            if (
                                !lang ||
                                [
                                    'plaintext',
                                    'plain',
                                    'text',
                                    'txt',
                                    '.txt',
                                ].includes(lang)
                            ) {
                                return escapeBraces(escapeHtml(code));
                            }
                            const scope =
                                codeHandler.processor.flagToScope(lang);
                            if (!scope) {
                                log(
                                    'warn',
                                    [
                                        `[sveltex / starry-night] Language "${lang}" not found. Possible reasons include:`,
                                        `- The language wasn't loaded, or the \`configure\` method wasn't awaited;`,
                                        `- The language isn't supported (cf. ${pc.underline('https://github.com/wooorm/starry-night')});`,
                                        `- The language flag isn't recognized (cf. \`flagToScope\` method from starry-night).`,
                                    ].join('\n'),
                                );
                                return escapeBraces(escapeHtml(code));
                            }
                            const hast = codeHandler.processor.highlight(
                                code,
                                scope,
                            );
                            findAndReplace(hast, [
                                ['<', uniqueEscapeSequences['<']],
                                ['>', uniqueEscapeSequences['>']],
                                ['{', uniqueEscapeSequences['{']],
                                ['}', uniqueEscapeSequences['}']],
                            ]);
                            return customEscapeSequencesToHtml(toHtml(hast));
                        },
                        configuration: getDefaultCodeConfig('starry-night'),
                        configure: async (config, codeHandler) => {
                            if (config.customLanguages) {
                                await codeHandler.processor.register(
                                    config.customLanguages,
                                );
                            }
                            if (config.languages) {
                                if (config.languages === 'all') {
                                    const { all } = await import(
                                        '@wooorm/starry-night'
                                    );
                                    await codeHandler.processor.register(all);
                                } else if (config.languages === 'common') {
                                    const { common } = await import(
                                        '@wooorm/starry-night'
                                    );
                                    await codeHandler.processor.register(
                                        common,
                                    );
                                } else {
                                    let scopes = [...config.languages];
                                    let deps: string[] = [];
                                    let grammars: Grammar[] = [];
                                    while (scopes.length > 0) {
                                        grammars = grammars.concat(
                                            await Promise.all(
                                                scopes.map(async (scope) => {
                                                    const grammar = (
                                                        (await import(
                                                            `@wooorm/starry-night/${scope}`
                                                        )) as {
                                                            default: Grammar;
                                                        }
                                                    ).default;
                                                    if (
                                                        grammar.dependencies !==
                                                            undefined &&
                                                        grammar.dependencies
                                                            .length > 0
                                                    ) {
                                                        deps.push(
                                                            ...grammar.dependencies,
                                                        );
                                                    }
                                                    return grammar;
                                                }),
                                            ),
                                        );
                                        scopes = [...deps];
                                        deps = [];
                                    }
                                    await codeHandler.processor.register(
                                        grammars,
                                    );
                                }
                            }
                        },
                    });
                } catch (error) {
                    missingDeps.push(
                        '@wooorm/starry-night',
                        'hast-util-find-and-replace',
                        'hast-util-to-html',
                    );
                    throw error;
                }
            case 'escapeOnly':
                // const defaultWrap: { inline: WrapDescription; block: WrapDescription } =
                //     {
                //         inline: ['<code>', '</code>'],
                //         block: ['<pre><code>', '</code></pre>'],
                //     } as const;
                return new CodeHandler<'escapeOnly'>({
                    backend: 'escapeOnly',
                    processor: {},
                    configuration: {
                        ...getDefaultCodeConfig('escapeOnly'),
                        escapeHtml: true,
                        escapeBraces: true,
                    },
                    process: (code, _opts, handler) => {
                        let escaped = code;
                        const configuration = handler.configuration;
                        if (configuration.escapeHtml) {
                            escaped = escapeHtml(escaped);
                        }
                        // NB: It's important to escape braces _after_ escaping HTML,
                        // since escaping braces will introduce ampersands which
                        // escapeHtml would escape
                        if (configuration.escapeBraces) {
                            escaped = escapeBraces(escaped);
                        }

                        return escaped;
                    },
                    configure: () => {
                        return;
                    },
                });
            case 'none':
                return new CodeHandler<'none'>({
                    backend: 'none',
                    processor: {},
                    configuration: {
                        wrap: () => ['', ''],
                        wrapClassPrefix: '',
                    },
                    process: (code) => code,
                });
            default:
                throw new Error(`Unsupported code backend: "${backend}".`);
        }
    }
}
