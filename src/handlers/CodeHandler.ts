// Types
import type {
    CodeBackend,
    CodeConfiguration,
    CodeProcessOptionsBase,
    CodeProcessor,
    FullCodeConfiguration,
    CodeBackendWithCss,
    FullCodeTheme,
    CodeConfigureFn,
    CodeProcessFn,
} from '$types/handlers/Code.js';
import type { ProcessedSnippet } from '$types/utils/Escape.js';

// Internal dependencies
import { getDefaultCodeConfig } from '$config/defaults.js';
import { Handler, deepClone } from '$handlers/Handler.js';
import { isCodeBackendWithCss } from '$type-guards/code.js';
import { isArray, isObject, isString } from '$type-guards/utils.js';
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
import { copyTransformations, ensureStartsWith } from '$utils/misc.js';
import { applyTransformations } from '$utils/transformers.js';
import {
    type StarryNightLanguage,
    starryNightLanguages,
    StarryNightScope,
} from '$data/code.js';

// External dependencies
import {
    typeAssert,
    escapeHtml,
    is,
    join,
    pc,
    nodeAssert,
    inspect,
} from '$deps.js';

export class CodeHandler<B extends CodeBackend> extends Handler<
    B,
    CodeBackend,
    CodeProcessor<B>,
    CodeProcessOptionsBase,
    CodeConfiguration<B>,
    FullCodeConfiguration<B>,
    CodeHandler<B>
> {
    override get configuration(): FullCodeConfiguration<B> {
        // rfdc doesn't handle RegExps well, so we have to copy them manually
        const { pre, post } = this._configuration.transformers;
        return {
            ...deepClone(this._configuration),
            transformers: {
                post: copyTransformations(post ?? []),
                pre: copyTransformations(pre ?? []),
            },
        };
    }

    override get process(): (
        code: string,
        options?: CodeProcessOptionsBase | undefined,
    ) => Promise<ProcessedSnippet> {
        return async (
            code: string,
            options?: CodeProcessOptionsBase | undefined,
        ) => {
            if (this.configIsValid === undefined) {
                this.configIsValid =
                    diagnoseCodeConfiguration(this.backend, this.configuration)
                        .errors === 0;
            }

            let mergedOpts: CodeProcessOptionsBase = { inline: false };

            if (options) mergedOpts = mergeConfigs(mergedOpts, options);

            // Initialize the variable holding the processed code with the
            // original code.
            let processed = code;

            const transformers = this._configuration.transformers;

            // Apply the pre-transformers
            if (transformers.pre) {
                processed = applyTransformations(
                    processed,
                    mergedOpts,
                    transformers.pre,
                );
            }

            // In inline code spans, newlines are replaced with spaces, as per
            // CommonMark etc. specs.
            if (mergedOpts.inline) {
                processed = processed.replace(/\r\n?|\n/gu, ' ');
            }

            // If the snippet corresponded to a code block, we meed to take note
            // that we'll eventually have to remove the paragraph tag with which
            // the MarkdownHandler has wrapped the escaped snippet.
            const unescapeOptions = { removeParagraphTag: !mergedOpts.inline };

            if (!this.configIsValid) return { processed, unescapeOptions };

            // For `starry-night` and `highlight.js`, possibly download the CSS
            // for the selected theme. For all other backends, this will just
            // set `this._handledCss` to `true` without doing anything else.
            await this.handleCss();

            // Actually process the code, using the `process` function provided
            // by the backend (see the `create` method below).
            processed = (await super.process(processed, mergedOpts)).processed;

            // Shiki and escapeOnly don't add a \n at the end of the code block
            // by default.
            // if (!mergedOpts.inline) {
            //     if (
            //         this._configuration.appendNewline &&
            //         (this.backend === 'shiki' || this.backend === 'escapeOnly')
            //     ) {
            //         const m = processed.match(
            //             /^(<pre[^>]*?><code[^>]*?>)(.*[^\r\n])(<\/code><\/pre>)$/su,
            //         );
            //         if (m?.[1] && m[2] && m[3]) {
            //             processed = `${m[1]}${m[2]}\n${m[3]}`;
            //         }
            //     }
            // }

            // Apply the post-transformers
            if (transformers.post) {
                processed = applyTransformations(
                    processed,
                    mergedOpts,
                    transformers.post,
                );
            }

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
        if (!isCodeBackendWithCss(this.backend)) return;

        const config = this._configuration;

        // Unfortunately, TypeScript doesn't realize that, at this point, B
        // extends CodeBackendWithCss
        typeAssert(is<FullCodeConfiguration<CodeBackendWithCss>>(config));

        const theme = config.theme as FullCodeTheme<
            'highlight.js' | 'starry-night'
        >;

        if (theme.type === 'none') return;

        let links: string[] = [];
        let v: string;
        let resourceName: string;

        if (this.backend === 'starry-night') {
            typeAssert(
                is<FullCodeTheme<'starry-night', 'cdn' | 'self-hosted'>>(theme),
            );
            v = 'latest';
            const { name, mode, cdn } = theme;
            resourceName = `${name === 'default' ? '' : `${name}-`}${mode}.css`;
            const resource = `style/${resourceName}`;
            const pkg = '@wooorm/starry-night';
            const cdns = isArray(cdn) ? cdn : [cdn];
            links = cdns.map((c) => cdnLink(pkg, resource, v, c));
        } else {
            typeAssert(
                is<FullCodeTheme<'highlight.js', 'cdn' | 'self-hosted'>>(theme),
            );
            v = (await getVersion(this.backend)) ?? 'latest';
            const { name, min, cdn } = theme;
            resourceName = `${name}${min ? '.min' : ''}.css`;
            const resource = `styles/${resourceName}`;
            const pkg = 'highlight.js';
            const cdns = isArray(cdn) ? cdn : [cdn];
            links = cdns.map((c) => cdnLink(pkg, resource, v, c));
        }

        if (theme.type === 'cdn') {
            if (links[0]) {
                this._headLines = [
                    `<link rel="stylesheet" href="${links[0]}">`,
                ];
            }
            return;
        }

        // Build the path to which we should write the fetched stylesheet
        const path = join(theme.dir, `${this.backend}@${v}.${resourceName}`);

        // If the file already exists, don't fetch it again
        if (fs.existsSync(path)) return;

        // Fetch the CSS from a CDN
        const css = await fancyFetch(links);

        // If the fetch failed, don't try to write anything
        if (!css) return;

        // Write the fetched CSS to the specified path
        await fancyWrite(path, css);

        this._scriptLines = [`import '${ensureStartsWith(path, '/')}';`];
    }

    // Setting a config value to `null` should be akin to "disabling" the
    // functionality it controls.
    override configureNullOverrides: [string, unknown][] = [
        ['transformers', { pre: null, post: null }],
        ['langAlias', {}],
        ['addLanguageClass', false],
        ['appendNewline', false],
        ['escapeBraces', false],
        ['escapeHtml', false],
        ['inlineMeta', () => undefined],
        ['shiki', {}],
    ];

    /**
     * Creates a code handler of the specified type.
     *
     * @param backend - The type of the code processor to create.
     * @returns A promise that resolves to a code handler of the specified type.
     */
    // static async create<B extends Exclude<CodeBackend, 'custom'>>(
    //     backend: B,
    //     cfg?: CodeConfiguration<B>,
    // ): Promise<CodeHandler<B>>;

    // static async create<B extends 'custom'>(
    //     backend: B,
    //     {
    //         processor,
    //         process,
    //         configure,
    //         configuration,
    //     }: {
    //         processor?: CodeProcessor<'custom'>;
    //         process: CodeProcessFn<'custom'>;
    //         configure?: CodeConfigureFn<'custom'> | undefined;
    //         configuration?: CodeConfiguration<'custom'> | undefined;
    //     },
    // ): Promise<CodeHandler<B>>;

    /**
     * Creates a code handler of the specified type.
     *
     * @param backend - The type of the code processor to create.
     * @returns A promise that resolves to a code handler of the specified type.
     */
    static async create<B extends CodeBackend>(
        backend: B,
        cfg: CodeConfiguration<B>,
    ): Promise<CodeHandler<B>> {
        if (backend === 'highlight.js') {
            type Backend = 'highlight.js';
            const backend: Backend = 'highlight.js';
            typeAssert(is<CodeConfiguration<Backend>>(cfg));
            let processor;
            try {
                processor = (await import('highlight.js')).default;
            } catch (error) {
                missingDeps.push('highlight.js');
                throw error;
            }
            const process: CodeProcessFn<'highlight.js'> = (
                code,
                { lang, inline },
                handler,
            ) => {
                const config = handler._configuration;
                if (inline) {
                    const inlineParsed = config.inlineMeta(
                        code,
                        (tag) =>
                            !!handler.processor.getLanguage(
                                (config.langAlias?.[tag] ?? tag)
                                    .toLowerCase()
                                    .replaceAll(' ', '-'),
                            ),
                    );
                    if (inlineParsed) {
                        code = inlineParsed.code;
                        lang = inlineParsed.lang ?? lang;
                    }
                }
                lang = (lang ? config.langAlias?.[lang] ?? lang : lang)
                    ?.toLowerCase()
                    .replaceAll(' ', '-');
                let processed;
                if (lang && handler.processor.getLanguage(lang)) {
                    processed = escapeBraces(
                        handler.processor.highlight(code, {
                            language: lang,
                        }).value,
                    );
                } else {
                    if (lang) {
                        log(
                            'warn',
                            [
                                `Language ${inspect(lang)} not found. Possible reasons include:`,
                                `- The language wasn't loaded;`,
                                `- The language isn't supported (cf. ${pc.underline('https://highlightjs.readthedocs.io/en/latest/supported-languages.html')});`,
                                `- The language flag isn't recognized (cf. \`getLanguage\` method from highlight.js).`,
                            ].join('\n'),
                        );
                    }
                    processed = escapeBraces(escapeHtml(code));
                }
                const { addLanguageClass } = handler._configuration;
                const prefix =
                    addLanguageClass === true ? 'language-' : addLanguageClass;
                const attr =
                    prefix !== false && lang
                        ? ` class="${prefix}${String(lang)}"`
                        : '';
                if (!inline) {
                    processed = processed.replace(
                        /^(?:\r\n?|\n)(.*?)(?:\r\n?|\n)$/s,
                        '$1',
                    );
                    if (
                        config.appendNewline &&
                        processed !== '' &&
                        !/(?:\r\n?|\n)$/.test(processed)
                    ) {
                        processed += '\n';
                    }
                } else {
                    processed = processed.replace(/\r\n?|\n/gu, ' ');
                }
                processed = inline
                    ? `<code${attr}>${processed}</code>`
                    : `<pre><code${attr}>${processed}</code></pre>`;
                return processed;
            };
            const configuration = mergeConfigs(
                getDefaultCodeConfig(backend),
                cfg,
            );
            const configure: CodeConfigureFn<Backend> = (
                config,
                codeHandler,
            ) => {
                if (config[backend]) {
                    codeHandler.processor.configure(config[backend]);
                }
            };
            const handler = new CodeHandler<Backend>({
                backend,
                processor,
                configuration,
                process,
                configure,
            });
            // Since this backend requires a custom `configure` method,
            // we need to call this method to properly initialize the
            // handle the initial configuration object.
            await handler.configure(cfg);
            // Apparently, the highlight.js processor isn't
            // serializable. This will upset Vite, so we need to
            // remove it from the object returned by `toJSON`
            (handler as unknown as { toJSON: () => object }).toJSON = () => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { processor, ...rest } = handler;
                return rest;
            };
            return handler as unknown as CodeHandler<B>;
        } else if (backend === 'starry-night') {
            type Backend = 'starry-night';
            const backend: Backend = 'starry-night';
            let processor;
            let findAndReplace;
            let toHtml;
            try {
                typeAssert(is<CodeConfiguration<'starry-night'>>(cfg));

                processor = await (
                    await import('@wooorm/starry-night')
                ).createStarryNight([]);
                findAndReplace = (await import('hast-util-find-and-replace'))
                    .findAndReplace;
                toHtml = (await import('hast-util-to-html')).toHtml;
            } catch (error) {
                missingDeps.push(
                    '@wooorm/starry-night',
                    'hast-util-find-and-replace',
                    'hast-util-to-html',
                );
                throw error;
            }
            type Grammar = import('@wooorm/starry-night').Grammar;
            const process: CodeProcessFn<Backend> = (
                code,
                { lang, inline },
                handler,
            ) => {
                const config = handler._configuration;
                if (inline) {
                    const inlineParsed = config.inlineMeta(
                        code,
                        (tag) =>
                            !!handler.processor.flagToScope(
                                (config.langAlias?.[tag] ?? tag)
                                    .toLowerCase()
                                    .replaceAll(' ', '-'),
                            ),
                    );
                    if (inlineParsed) {
                        code = inlineParsed.code;
                        lang = inlineParsed.lang ?? lang;
                    }
                }
                lang = (
                    (lang ? config.langAlias?.[lang] ?? lang : lang) ??
                    config.lang
                )
                    ?.toLowerCase()
                    .replaceAll(' ', '-');
                let processed;
                const scope = lang
                    ? handler.processor.flagToScope(lang)
                    : undefined;
                const text =
                    lang &&
                    ['text', 'plain', 'plaintext', 'txt'].includes(lang);
                if (!text && scope) {
                    const hast = handler.processor.highlight(code, scope);
                    findAndReplace(hast, [
                        ['<', uniqueEscapeSequences['<']],
                        ['>', uniqueEscapeSequences['>']],
                        ['{', uniqueEscapeSequences['{']],
                        ['}', uniqueEscapeSequences['}']],
                    ]);
                    processed = customEscapeSequencesToHtml(toHtml(hast));
                } else {
                    if (lang && !text && !scope) {
                        log(
                            'warn',
                            [
                                `Language "${lang}" not found. Possible reasons include:`,
                                `- The language wasn't loaded;`,
                                `- The language isn't supported (cf. ${pc.underline('https://github.com/wooorm/starry-night')});`,
                                `- The language flag isn't recognized (cf. \`flagToScope\` method from starry-night).`,
                            ].join('\n'),
                        );
                    }
                    processed = escapeBraces(escapeHtml(code));
                }
                const { addLanguageClass } = handler._configuration;
                const prefix =
                    addLanguageClass === true ? 'language-' : addLanguageClass;
                const attr =
                    prefix !== false && lang
                        ? ` class="${prefix}${String(lang)}"`
                        : '';

                if (!inline) {
                    processed = processed.replace(
                        /^(?:\r\n?|\n)(.*?)(?:\r\n?|\n)$/s,
                        '$1',
                    );
                    if (
                        config.appendNewline &&
                        processed !== '' &&
                        !/(?:\r\n?|\n)$/.test(processed)
                    ) {
                        processed += '\n';
                    }
                } else {
                    processed = processed.replace(/\r\n?|\n/gu, ' ');
                }

                processed = inline
                    ? `<code${attr}>${processed}</code>`
                    : `<pre><code${attr}>${processed}</code></pre>`;
                return processed;
            };
            const configure: CodeConfigureFn<'starry-night'> = async (
                config,
                codeHandler,
            ) => {
                if (config.languages) {
                    // Interpret prop value
                    const languages: (string | Grammar)[] = isString(
                        config.languages,
                    )
                        ? [config.languages]
                        : config.languages;
                    let preset: 'all' | 'common' | undefined = undefined;
                    if (
                        isString(languages[0]) &&
                        (languages[0] === 'all' || languages[0] === 'common')
                    ) {
                        preset = languages[0];
                        languages.shift();
                    }
                    const customLanguages = languages.filter(
                        isObject,
                    ) as Grammar[];
                    const languageNames = languages.filter(
                        isString,
                    ) as StarryNightLanguage[];

                    // Register preset languages
                    if (preset === 'all') {
                        const { all } = await import('@wooorm/starry-night');
                        await codeHandler.processor.register(all);
                    } else if (preset === 'common') {
                        const { common } = await import('@wooorm/starry-night');
                        await codeHandler.processor.register(common);
                    }
                    // Register individually specified languages
                    if (languageNames.length > 0) {
                        let scopes = languageNames.map(
                            (name) => starryNightLanguages[name],
                        );
                        let deps: StarryNightScope[] = [];
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
                                            grammar.dependencies.length > 0
                                        ) {
                                            deps.push(
                                                ...(grammar.dependencies as StarryNightScope[]),
                                            );
                                        }
                                        return grammar;
                                    }),
                                ),
                            );
                            scopes = [...deps];
                            deps = [];
                        }
                        await codeHandler.processor.register(grammars);
                    }
                    // Register custom grammars
                    if (customLanguages.length > 0) {
                        await codeHandler.processor.register(customLanguages);
                    }
                }
            };
            const configuration = mergeConfigs(
                getDefaultCodeConfig('starry-night'),
                cfg,
            );
            const handler = new CodeHandler<Backend>({
                backend,
                configuration,
                configure,
                process,
                processor,
            });
            // Since this backend requires a custom `configure` method, we
            // need to call this method to properly initialize the handle
            // the initial configuration object.
            await handler.configure(cfg);
            return handler as unknown as CodeHandler<B>;
        } else if (backend === 'shiki') {
            let shikiValidLanguageTags: string[];
            let codeToHtml;
            try {
                typeAssert(is<CodeConfiguration<'shiki'>>(cfg));
                const bundledLanguagesAlias = (await import('shiki'))
                    .bundledLanguagesAlias;
                const bundledLanguages = (await import('shiki'))
                    .bundledLanguages;
                shikiValidLanguageTags = [
                    ...Object.keys(bundledLanguages),
                    ...Object.keys(bundledLanguagesAlias),
                ];
                codeToHtml = (await import('shiki')).codeToHtml;
            } catch (error) {
                missingDeps.push('shiki');
                throw error;
            }

            const process: CodeProcessFn<'shiki'> = async (
                code: string,
                { lang, inline, metaString },
                handler,
            ) => {
                const config = handler._configuration;
                let shouldAddNewline = !inline && config.appendNewline;
                if (inline) {
                    const inlineParsed = config.inlineMeta(code, (tag) =>
                        shikiValidLanguageTags.includes(
                            (config.langAlias?.[tag] ?? tag)
                                .toLowerCase()
                                .replaceAll(' ', '-'),
                        ),
                    );
                    if (inlineParsed) {
                        code = inlineParsed.code;
                        lang = inlineParsed.lang ?? lang;
                        metaString = inlineParsed.meta ?? metaString;
                    }
                } else if (shouldAddNewline) {
                    shouldAddNewline =
                        code !== '' && !/(?:\r\n?|\n)$/.test(code);
                }
                lang = (
                    (lang ? config.langAlias?.[lang] ?? lang : lang) ??
                    handler.configuration.shiki.lang
                )
                    ?.toLowerCase()
                    .replaceAll(' ', '-');
                let langUndefined: boolean = false;
                let langUnknown: string | undefined = undefined;
                if (!lang) {
                    lang = 'text';
                    langUndefined = true;
                } else if (!shikiValidLanguageTags.includes(lang)) {
                    log(
                        'warn',
                        [
                            `Language "${lang}" not found. Possible reasons include:`,
                            `- The language wasn't loaded;`,
                            `- The language isn't supported (cf. ${pc.underline('https://shiki.style/languages')});`,
                            `- The language flag isn't recognized.`,
                        ].join('\n'),
                    );
                    langUnknown = lang;
                    lang = 'text';
                }
                const meta = metaString
                    ? {
                          ...config.parseMetaString?.(metaString, code, lang),
                          __raw: metaString,
                      }
                    : {};
                const classes: string[] = ['shiki'];
                let processed;
                const { theme, themes } = config.shiki;
                const structure = inline ? 'inline' : 'classic';
                if (themes) {
                    processed = escapeBraces(
                        await codeToHtml(code, {
                            ...config.shiki,
                            themes: themes,
                            structure,
                            meta,
                            lang: lang,
                        }),
                    );
                    classes.push('shiki-themes');
                    const { light, ...rest } = themes;
                    [light, ...Object.values(rest)].forEach((t) => {
                        nodeAssert(
                            t,
                            'Expected theme object not to be null or undefined.',
                        );
                        if (isString(t)) classes.push(t);
                        else if (t.name) classes.push(t.name);
                    });
                } else if (theme) {
                    processed = escapeBraces(
                        await codeToHtml(code, {
                            ...config.shiki,
                            theme: theme,
                            structure,
                            meta,
                            lang,
                        }),
                    );
                    if (isString(theme)) classes.push(theme);
                    else if (theme.name) classes.push(theme.name);
                } else {
                    processed = escapeBraces(
                        await codeToHtml(code, {
                            theme: 'none',
                            ...handler.configuration.shiki,
                            structure,
                            meta,
                            lang,
                        }),
                    );
                }
                const prefix =
                    config.addLanguageClass === true
                        ? 'language-'
                        : config.addLanguageClass;

                if (inline) {
                    if (prefix !== false && !langUndefined)
                        classes.unshift(prefix + lang);
                    processed =
                        `<code class="${classes.join(' ')}">` +
                        processed +
                        '</code>';
                } else {
                    if (shouldAddNewline) {
                        processed = processed.replace(/(<\/code>.+?)/, '\n$1');
                    }
                    if (prefix !== false && !langUndefined) {
                        const m = /^(<pre[^>]*?>\s*)?(<code[^>]*>)/u.exec(
                            processed,
                        );
                        if (m?.[2]) {
                            if (/\sclass="[^"]*?"/u.test(m[2])) {
                                processed = processed.replace(
                                    m[2],
                                    m[2].replace(
                                        /(?<=\sclass=")/u,
                                        `${prefix}${langUnknown ?? lang} `,
                                    ),
                                );
                            } else {
                                processed = processed.replace(
                                    '<code',
                                    `<code class="${prefix}${langUnknown ?? lang}"`,
                                );
                            }
                        }
                    }
                }
                return processed;
            };
            const configuration = mergeConfigs(
                getDefaultCodeConfig('shiki'),
                cfg,
            );
            const handler = new CodeHandler<'shiki'>({
                backend,
                processor: {},
                configuration,
                process,
            });
            return handler as unknown as CodeHandler<B>;
        } else if (backend === 'escapeOnly') {
            typeAssert(is<CodeConfiguration<'escapeOnly'>>(cfg));
            const process: CodeProcessFn<'escapeOnly'> = (
                code,
                { lang, inline },
                handler,
            ) => {
                let escaped = code;
                const config = handler.configuration;
                const shouldAddNewline =
                    !inline &&
                    config.appendNewline &&
                    code !== '' &&
                    !/(?:\r\n?|\n)$/.test(code);
                if (config.escapeHtml) {
                    escaped = escapeHtml(escaped);
                }
                // NB: It's important to escape braces _after_ escaping HTML,
                // since escaping braces will introduce ampersands which
                // escapeHtml would escape
                if (config.escapeBraces) {
                    escaped = escapeBraces(escaped);
                }
                if (shouldAddNewline) {
                    escaped += '\n';
                }

                const { addLanguageClass } = config;
                const prefix =
                    addLanguageClass === true ? 'language-' : addLanguageClass;
                const attr =
                    prefix !== false && lang
                        ? ` class="${prefix}${String(lang)}"`
                        : '';
                escaped = inline
                    ? `<code${attr}>${escaped}</code>`
                    : `<pre><code${attr}>${escaped}</code></pre>`;

                return escaped;
            };
            const configuration = mergeConfigs(
                getDefaultCodeConfig('escapeOnly'),
                cfg,
            );
            return new CodeHandler<'escapeOnly'>({
                backend: 'escapeOnly',
                processor: {},
                configuration,
                process,
            }) as unknown as CodeHandler<B>;
        } else if (backend === 'none') {
            nodeAssert(backend === 'none');
            return new CodeHandler<'none'>({
                backend: 'none',
                processor: {},
                configuration: mergeConfigs(getDefaultCodeConfig('none'), cfg),
                process: (code) => code,
            }) as unknown as CodeHandler<B>;
        } else {
            throw new Error(`Unsupported code backend: "${backend}".`);
        }
    }
}
