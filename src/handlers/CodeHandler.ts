// Types
import type {
    CodeBackend,
    CodeConfiguration,
    CodeConfigureFn,
    CodeProcessFn,
    CodeProcessOptions,
    CodeProcessor,
    FullCodeConfiguration,
} from '$types';

// Internal dependencies
import { getDefaultCodeConfiguration } from '$config';
import { missingDeps } from '$utils/globals.js';
import { Handler } from '$handlers/Handler.js';
import {
    customEscapeSequencesToHtml,
    escapeBraces,
    log,
    mergeConfigs,
    re,
    uniqueEscapeSequences,
} from '$utils';

// External dependencies
import { escape as escapeHtml } from 'html-escaper';
import pc from 'picocolors';

export class CodeHandler<B extends CodeBackend> extends Handler<
    B,
    CodeBackend,
    CodeProcessor<B>,
    CodeProcessOptions,
    CodeConfiguration<B>,
    FullCodeConfiguration<B>,
    CodeHandler<B>
> {
    override get process() {
        return async (
            code: string,
            options?: CodeProcessOptions | undefined,
        ) => {
            let innerCode: string = code;
            let opts: CodeProcessOptions | undefined = { _wrap: true };

            // If the options are provided, interpret `code` as `innerCode` and
            // don't wrap the output with anything. Similarly, if
            // optionsFromDelims === undefined, it means that the code snippet
            // didn't have delimiters, so we should treat `code` as `innerCode`
            // and not wrap the output with anything.
            if (options !== undefined) {
                opts = mergeConfigs(opts, options);
            } else {
                const res = this.consumeDelims(code);
                if (res.optionsFromDelims !== undefined) {
                    innerCode = res.innerCode;
                    opts = mergeConfigs(opts, res.optionsFromDelims);
                }
            }

            const processedCode = await super.process(innerCode, opts);

            // If the `_wrap` option is set to `false`, don't wrap the output.
            // (This is sometimes used, for example, by the VerbatimHandler.)
            if (opts._wrap === false) return processedCode;

            const wrapArray = this.configuration.wrap({
                ...opts,
                wrapClassPrefix: this.configuration.wrapClassPrefix,
            });

            // Add a newline before and after the code block, since
            // consumeDelims gobbles up the first newline after the opening
            // delimiter and the last newline before the closing delimiter
            const n = opts.inline === true ? '' : '\n';

            return wrapArray[0] + n + processedCode + n + wrapArray[1];
        };
    }

    private static codeBlockDelimsRegex = re`
        ^                   # start of string
        \s*                 # leading whitespace
        ( \`\`\`+ | ~~~+ )  # $1: ≥3 backticks or tildes
        [\ \t]*             # inline whitespace (spaces or tabs)
        ([\w-]*)            # $2: language tag
        [\ \t]*             # inline whitespace (spaces or tabs)
        (.*)                # $3: info string
        \r?\n               # newline (supporting both CRLF and LF line endings)
        ${'u'}              # support unicode`;

    private static codeInlineDelimsRegex = re`
        ^                   # start of string
        \s*                 # leading whitespace
        ( \`+ | ~+ )        # $1: ≥1 backticks or tildes
        ${'u'}              # support unicode`;

    consumeDelims = (codeInDelims: string) => {
        let innerCode = codeInDelims;
        let optionsFromDelims: CodeProcessOptions | undefined = undefined;
        const codeBlockMatchArray = innerCode.match(
            CodeHandler.codeBlockDelimsRegex,
        );
        if (codeBlockMatchArray) {
            /* v8 ignore next 9 (unreachable code) */
            if (!codeBlockMatchArray[1]) {
                log(
                    'error',
                    'Error parsing code snippet' +
                        "(opening delimiters couldn't be matched): " +
                        innerCode,
                );
                return { innerCode, optionsFromDelims };
            }

            // If the code block was opened with n≥3 backticks resp. tildes,
            // it must be closed with k≥n backticks resp. tildes.
            const closingDelimRegExp = new RegExp(
                `(\\r?\\n)[ \\t]*${codeBlockMatchArray[1]}+\\s*$`,
                'u',
            );

            if (!closingDelimRegExp.test(innerCode)) {
                log(
                    'error',
                    `Error parsing code block (closing delimiters not found); expected the following to end with ≥${String(codeBlockMatchArray[1].length)} ${codeBlockMatchArray[1].includes('`') ? 'backticks' : 'tildes'}:\n${innerCode}`,
                );
                return { innerCode, optionsFromDelims };
            }

            // Extract the language and info string from the opening delimiter
            let lang = codeBlockMatchArray[2];
            const info = codeBlockMatchArray[3];
            if (lang === '') lang = 'plaintext';

            // Remove the opening and closing delimiters
            innerCode = innerCode
                .replace(CodeHandler.codeBlockDelimsRegex, '')
                .replace(closingDelimRegExp, '');
            optionsFromDelims = { inline: false, lang, info };
            return { innerCode, optionsFromDelims };
        }

        // Let's remove the opening and closing delimiters
        const codeInlineMatchArray = innerCode.match(
            CodeHandler.codeInlineDelimsRegex,
        );
        if (codeInlineMatchArray) {
            /* v8 ignore next 9 (unreachable code) */
            if (!codeInlineMatchArray[1]) {
                log(
                    'error',
                    'Error parsing code snippet' +
                        "(opening delimiters couldn't be matched): " +
                        innerCode,
                );
                return { innerCode, optionsFromDelims };
            }

            // If the code block was opened with n≥1 backticks resp. tildes,
            // it must be closed with n backticks resp. tildes.
            const closingDelimRegExp = new RegExp(
                `${codeInlineMatchArray[1]}+\\s*$`,
                'u',
            );

            if (!closingDelimRegExp.test(innerCode)) {
                log(
                    'error',
                    `Error parsing inline code snippet (closing delimiters not found); expected the following to end with ≥${String(codeInlineMatchArray[1].length)} ${codeInlineMatchArray[1].includes('`') ? 'backticks' : 'tildes'}:\n${innerCode}`,
                );
                return { innerCode, optionsFromDelims };
            }

            // Currently we can't set the language or info string for inline
            // code snippets, so we'll just set the language to 'plaintext' and
            // the info string to an empty string.
            optionsFromDelims = { inline: true, lang: 'plaintext', info: '' };

            // Remove the opening and closing delimiters
            innerCode = innerCode
                .replace(CodeHandler.codeInlineDelimsRegex, '')
                .replace(closingDelimRegExp, '');
        } else {
            log(
                'error',
                `Error parsing code snippet (no delimiters could be found/matched): ${innerCode}`,
            );
            console.trace('Error parsing code snippet');
            return { innerCode, optionsFromDelims };
        }

        return { innerCode, optionsFromDelims };
    };

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
                        getDefaultCodeConfiguration('custom'),
                        custom.configuration ?? {},
                    ),
                });
            case 'highlight.js':
                try {
                    type Backend = 'highlight.js';
                    const processor = (await import('highlight.js')).default;
                    return new CodeHandler<Backend>({
                        backend: 'highlight.js',
                        processor,
                        configuration:
                            getDefaultCodeConfiguration('highlight.js'),
                        process: (code, { lang } = {}, codeHandler) => {
                            return escapeBraces(
                                codeHandler.processor.highlight(code, {
                                    language:
                                        lang === undefined || lang.length === 0
                                            ? 'plaintext'
                                            : lang,
                                }).value,
                            );
                        },
                        configure: (config, codeHandler) => {
                            codeHandler.processor.configure(config);
                        },
                    });
                } catch (error) {
                    missingDeps.push('highlight.js');
                    throw error;
                }
            case 'prismjs':
                try {
                    type Backend = 'prismjs';
                    const processor = {
                        prism: (await import('prismjs')).default,
                        loadLanguages: (await import('prismjs/components'))
                            .default,
                    };
                    // Prevent Prism from trying to automatically highlight all code blocks
                    processor.prism.manual = true;
                    const codeHandler = new CodeHandler<Backend>({
                        backend: 'prismjs',
                        processor,
                        process: (code, { lang } = {}, codeHandler) => {
                            const langOrDefault = lang ?? 'plaintext';
                            const grammar =
                                codeHandler.processor.prism.languages[
                                    langOrDefault
                                ];
                            // ?? codeHandler.processor.loadLanguages[langOrDefault];
                            if (!grammar) {
                                log(
                                    'warn',
                                    `[SvelTeX: Prism] Language not found: ${langOrDefault}`,
                                );
                                return escapeBraces(escapeHtml(code));
                            }
                            return escapeBraces(
                                codeHandler.processor.prism.highlight(
                                    code,
                                    grammar,
                                    langOrDefault,
                                ),
                            );
                        },
                        configuration: getDefaultCodeConfiguration('prismjs'),
                        // configure: (config, codeHandler) => {
                        //     // if (config.languages === 'all') {
                        //     //     codeHandler.processor.loadLanguages();
                        //     // } else if (config.languages) {
                        //     //     codeHandler.processor.loadLanguages(config.languages);
                        //     // }
                        // },
                    });
                    // load all languages
                    // if (typeof codeHandler.processor.loadLanguages === 'function')
                    //     codeHandler.processor.loadLanguages();
                    return codeHandler;
                } catch (error) {
                    missingDeps.push('prismjs');
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
                    const codeHandler = new CodeHandler<Backend>({
                        backend: 'starry-night',
                        processor,
                        process: (code, { lang } = {}, codeHandler) => {
                            if (
                                lang === undefined ||
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
                        configuration:
                            getDefaultCodeConfiguration('starry-night'),
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
                                                        deps = deps.concat(
                                                            grammar.dependencies,
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
                    return codeHandler;
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
                        ...getDefaultCodeConfiguration('escapeOnly'),
                        escapeHtml: true,
                        escapeBraces: true,
                    },
                    process: (code, _opts, handler) => {
                        let escaped = code;
                        if (handler.configuration.escapeHtml !== false) {
                            escaped = escapeHtml(escaped);
                        }
                        // NB: It's important to escape braces _after_ escaping HTML,
                        // since escaping braces will introduce ampersands which
                        // escapeHtml would escape
                        if (handler.configuration.escapeBraces !== false) {
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
