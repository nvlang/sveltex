// File description: Handles math expressions.

// Types
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
    MathProcessFn,
    MathProcessOptions,
} from '../types/handlers/Math.js';
import type { ProcessedSnippet } from '../types/utils/Escape.js';

// Internal dependencies
import { getDefaultMathConfig } from '../base/defaults.js';
import { Handler } from './Handler.js';
import { isArray } from '../typeGuards/utils.js';
import { cdnLink, fancyFetch, fancyWrite } from '../utils/cdn.js';
import { escapeCssColorVars, unescapeCssColorVars } from '../utils/css.js';
import { getVersion, missingDeps } from '../utils/env.js';
import { escapeBraces } from '../utils/escape.js';
import { fs } from '../utils/fs.js';
import { mergeConfigs } from '../utils/merge.js';
import { ensureStartsWith } from '../utils/misc.js';
import { applyTransformations } from '../utils/transformers.js';

// External dependencies
import { is, join, nodeAssert, typeAssert } from '../deps.js';
import { log } from '../utils/debug.js';
import { diagnoseMathConfiguration } from '../utils/diagnosers/mathConfiguration.js';
// import {
//     mathjaxDefaultTexExtensions,
//     mathjaxTexExtensionImports,
// } from '../data/mathjax.js';
// import type {
//     MathjaxDefaultTexExtension,
//     MathjaxTexExtension,
// } from '../types/utils/MathjaxOptions.js';

export class MathHandler<B extends MathBackend> extends Handler<
    B,
    MathBackend,
    MathProcessOptions<B>,
    FullMathConfiguration<B>,
    MathHandler<B>,
    string
> {
    public override get process(): (
        tex: string,
        options?: MathProcessOptions<B>,
    ) => Promise<ProcessedSnippet> {
        return async (tex: string, options?: MathProcessOptions<B>) => {
            this.configIsValid ??=
                diagnoseMathConfiguration(this.backend, this._configuration)
                    .errors === 0;

            if (!this.configIsValid) {
                log(
                    'error',
                    'Invalid math configuration. Skipping math processing.',
                );
                return {
                    processed: escapeBraces(tex),
                    unescapeOptions: { removeParagraphTag: true },
                };
            }

            await this.handleCss();

            // Apply pre-transformers
            const pretransformed = applyTransformations(
                tex,
                { inline: options?.inline !== false },
                this._configuration.transformers.pre,
            );

            const res = await super.process(
                pretransformed,
                options ?? ({} as MathProcessOptions<B>),
            );

            // Apply post-transformers
            res.processed = applyTransformations(
                res.processed,
                { inline: options?.inline !== false, original: tex },
                this._configuration.transformers.post,
            );

            // Escape braces (which might otherwise confuse Svelte)
            res.processed = escapeBraces(res.processed);

            return res;
        };
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private readonly _handleCss: (mathHandler: this) => Promise<void> =
        async () => Promise.resolve();
    public get handleCss(): () => Promise<void> {
        return async () => {
            if (this._handledCss) {
                return;
            }
            if (this._handlingCss) {
                // wait until the CSS is handled
                await new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (this._handledCss) {
                            clearInterval(interval);
                            resolve(null);
                        }
                    }, 10);
                });
                return;
            }
            this._handlingCss = true;
            await this._handleCss(this);
            this._handledCss = true;
            this._handlingCss = false;
        };
    }

    private _handledCss: boolean = false;
    private _handlingCss: boolean = false;

    // The `() => undefined` function is unreachable, since the `updateCss`
    // getter only calls `_updateCss` if MathJax and CHTML are being used, in
    // which case `_updateCss` is overridden in the constructor.
    /* v8 ignore next 2 (unreachable code) */
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private readonly _updateCss: (mathHandler: this) => void = () => undefined;

    public get updateCss(): () => void {
        return () => {
            if (
                this.backend === 'mathjax' &&
                (this._configuration as FullMathConfiguration<'mathjax'>).css
                    .type === 'hybrid' &&
                (this._configuration as FullMathConfiguration<'mathjax'>)
                    .outputFormat === 'chtml'
            ) {
                this._updateCss(this);
            }
        };
    }

    private configIsValid: boolean | undefined = undefined;

    /**
     * Lines of code that should be added to the `<svelte:head>` component
     * of any page that contains any TeX on which this handler ran. This
     * variable must be set at most once, and cannot depend on what page the
     * handler is being used on.
     */
    private _headLines: string[] = [];
    public get headLines(): string[] {
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
    private readonly _scriptLines: string[] = [];
    public get scriptLines(): string[] {
        return this._scriptLines;
    }

    private constructor({
        backend,
        process,
        configuration,
        handleCss,
        updateCss,
    }: {
        backend: B;
        process: MathProcessFn<B>;
        configuration: FullMathConfiguration<B>;
        handleCss?: (mathHandler: MathHandler<B>) => Promise<void>;
        updateCss?: (mathHandler: MathHandler<B>) => void;
    }) {
        super({ backend, process, configuration });
        if (handleCss) this._handleCss = handleCss;
        if (updateCss) this._updateCss = updateCss;
    }

    /**
     * Creates a math handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a math handler of the specified type.
     */
    public static async create<B extends MathBackend>(
        backend: B,
        userConfig?: MathConfiguration<B>,
    ): Promise<MathHandler<B>> {
        // ------------------------------------------------------------------ //
        //                               custom                               //
        // ------------------------------------------------------------------ //
        if (backend === 'custom') {
            // If `backend === 'custom'`, then we knwo that `userConfig`, if
            // defined, must be of type `MathConfiguration<'custom'>`.
            typeAssert(is<MathConfiguration<'custom'> | undefined>(userConfig));

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMathConfig('custom'),
                userConfig ?? {},
            );

            // Return a `MathHandler` instance that uses the above
            // configuration.
            return new MathHandler<'custom'>({
                backend,
                process: configuration.process,
                configuration,
            }) as unknown as MathHandler<B>;
        }
        // ------------------------------------------------------------------ //
        //                               KaTeX                                //
        // ------------------------------------------------------------------ //
        else if (backend === 'katex') {
            // If `backend === 'katex'`, then we know that `userConfig`, if
            // defined, must be of type `MathConfiguration<'katex'>`.
            typeAssert(is<MathConfiguration<'katex'> | undefined>(userConfig));

            // Import the `renderToString` function from the `katex` package,
            // and throw an error if the import fails.
            let renderToString;
            try {
                renderToString = (await import('katex')).default.renderToString;
            } catch (err) {
                // If the import fails, add `katex` to the list of missing
                // dependencies and rethrow the error.
                missingDeps.push('katex');
                throw err;
            }

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMathConfig('katex', userConfig?.css?.type),
                userConfig ?? {},
            );

            const process = (
                tex: string,
                { inline, options }: MathProcessOptions<'katex'>,
            ): string => {
                // Get KaTeX options.
                const { katex } = configuration;

                // Escape CSS color variables
                const { escaped, cssColorVars } = escapeCssColorVars(tex);
                tex = escaped;

                // Run KaTeX
                let output = renderToString(tex, {
                    // Apply options from config (KaTeX doesn't have a
                    // processor object, so the configuration has to be
                    // passed directly to each call to `renderToString`).
                    ...katex,

                    // Apply options from method parameter, which take
                    // precedence over the ones from the config.
                    ...options,

                    // Tell KaTeX whether the output should be rendered as
                    // inline- or as display math.
                    displayMode: inline === false,
                });

                output = unescapeCssColorVars(output, cssColorVars);

                return output;
            };
            const handleCss: (
                mathHandler: MathHandler<'katex'>,
            ) => Promise<void> = async (mathHandler) => {
                const cssConfig = configuration.css;
                const { type } = cssConfig;

                if (type === 'none') return;

                // If this branch is reached, we know that `type` is either
                // 'cdn' or 'hybrid'.

                const { cdn } = cssConfig;

                const v = (await getVersion('katex')) ?? 'latest';

                const cdns = isArray(cdn) ? cdn : [cdn];
                const links = cdns.map((c) =>
                    cdnLink('katex', 'dist/katex.min.css', v, c),
                );

                if (type === 'cdn') {
                    if (links[0]) {
                        mathHandler._headLines = [
                            `<link rel="stylesheet" href="${links[0]}">`,
                        ];
                        return;
                    } else {
                        log(
                            'error',
                            'No CDN specified for KaTeX. If you want to deactivate SvelTeX CSS handling for KaTeX, set the `tex.css.type` property of the SvelTeX configuration to `none`.',
                        );
                        return;
                    }
                }

                // If this branch is reached, we know that `type` is 'hybrid'.

                const { dir, staticDir } = cssConfig;

                const href = join(dir, `katex@${v}.min.css`);
                const path = join(staticDir, href);

                mathHandler._headLines = [
                    `<link rel="stylesheet" href="${ensureStartsWith(href, '/')}">`,
                ];

                if (fs.existsSync(path)) return;

                let css = await fancyFetch(links);

                if (!css) return;

                const linkPrefix = cdnLink('katex', 'dist/fonts/', v, cdns[0]);

                css = css.replaceAll('fonts/', linkPrefix);

                // Write the CSS to the specified path
                await fancyWrite(path, css);
            };

            // Return a `MathHandler` instance that makes use of the above.
            return new MathHandler<'katex'>({
                backend,
                configuration,
                process,
                handleCss,
            }) as unknown as MathHandler<B>;
        }

        // ------------------------------------------------------------------ //
        //                              MathJax                               //
        // ------------------------------------------------------------------ //
        else if (backend === 'mathjax') {
            // If `backend === 'mathjax'`, then we know that `userConfig`, if
            // defined, must be of type `MathConfiguration<'mathjax'>`.
            typeAssert(
                is<MathConfiguration<'mathjax'> | undefined>(userConfig),
            );

            // Merge user-provided configuration into the default configuration.
            let config = mergeConfigs(
                getDefaultMathConfig('mathjax', userConfig?.css?.type),
                userConfig ?? {},
            );

            const fmt = config.outputFormat;

            // Import the necessary functions and types from the `@mathjax/src`
            // package, and throw an error if the import fails.
            let MathJax, combineConfig, liteAdaptor, RegisterHTMLHandler;
            try {
                const { MathJax: _MathJax, combineConfig: _combineConfig } =
                    await import('@mathjax/src/js/components/global.js');
                MathJax = _MathJax;
                combineConfig = _combineConfig;
                liteAdaptor = (
                    await import('@mathjax/src/js/adaptors/liteAdaptor.js')
                ).liteAdaptor;
                RegisterHTMLHandler = (
                    await import('@mathjax/src/js/handlers/html.js')
                ).RegisterHTMLHandler;
            } catch (err) {
                // If the import fails, add `@mathjax/src` to the list of
                // missing dependencies and rethrow the error.
                missingDeps.push('@mathjax/src');
                missingDeps.push('speech-rule-engine');
                if (config.font !== 'newcm') {
                    missingDeps.push(`@mathjax/mathjax-${config.font}-font`);
                }
                throw err;
            }

            type MathItem<N, T, D> =
                import('@mathjax/src/js/core/MathItem.js').MathItem<N, T, D>;
            type MathDocument<N, D, T> =
                import('@mathjax/src/js/core/MathDocument.js').MathDocument<
                    N,
                    D,
                    T
                >;

            // Set the MathJax configuration defaults
            combineConfig(MathJax.config, {
                loader: {
                    load: [
                        'input/tex',
                        `output/${config.outputFormat}`,
                        'adaptors/liteDOM',
                        'a11y/assistive-mml',
                        ...(config.mathjax.load ?? []),
                    ],
                    paths: {
                        mathjax: '@mathjax/src/bundle',
                    },
                    require: (file: string) => import(file),
                },
                startup: {
                    document: '',
                    typeset: false,
                },
                output: {
                    font: `mathjax-${config.font}`,
                },
                chtml: {
                    fontURL: `https://cdn.jsdelivr.net/npm/@mathjax/mathjax-${config.font}-font@latest/chtml/woff2`,
                },
                options: {
                    renderActions: {
                        getSpeech: [
                            300,
                            null,
                            (
                                math: MathItem<any, any, any>,
                                doc: MathDocument<any, any, any>,
                            ) => {
                                // Generate the speech string and add it to the
                                // MathJax container, along with ARIA
                                // attributes, and hide the child nodes.
                                const adaptor = doc.adaptor;
                                const label =
                                    modality === 'braille'
                                        ? 'aria-braillelabel'
                                        : 'aria-label';
                                adaptor.setAttribute(
                                    math.typesetRoot,
                                    label,
                                    toSpeech(toMathML(math)),
                                );
                                adaptor.setAttribute(
                                    math.typesetRoot,
                                    'role',
                                    'img',
                                );
                                adaptor.setAttribute(
                                    math.typesetRoot,
                                    'aria-roledescription',
                                    '\u0091',
                                ); // something not spoken by screen readers
                                adaptor.setAttribute(
                                    math.typesetRoot,
                                    'aria-brailleroledescription',
                                    'math',
                                );
                                for (const child of adaptor.childNodes(
                                    math.typesetRoot,
                                )) {
                                    adaptor.setAttribute(
                                        child,
                                        'aria-hidden',
                                        'true',
                                    );
                                }
                            },
                        ],
                    },
                },
            });

            // Add MathJax configuration passed to us
            combineConfig(MathJax.config, config.mathjax);

            // Import the speech-rule-engine
            await import('@mathjax/src/components/require.mjs');
            const { setupEngine, engineReady, toSpeech } = await import(
                'speech-rule-engine/js/common/system.js'
            );

            // Set up the speech engine
            const locale = config.mathjax.options?.sre?.locale ?? 'en';
            const modality =
                locale === 'nemeth' || locale === 'euro' ? 'braille' : 'speech';
            await setupEngine({ locale, modality }).then(() => engineReady());

            // Create a MathML serializer
            const { SerializedMmlVisitor } = await import(
                '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js'
            );
            const visitor = new SerializedMmlVisitor();
            const toMathML = (math: any) => visitor.visitTree(math.root);

            // Lite adaptor
            const adaptor = liteAdaptor();
            RegisterHTMLHandler(adaptor);

            // Load MathJax and wait for it to start up
            /* @ts-expect-error */
            await import('@mathjax/src/bundle/startup.js');
            /* @ts-expect-error */
            await MathJax.startup.promise;

            // Create MathJax processor
            /* @ts-expect-error */
            const processor = MathJax.startup.document as MathDocument<
                HTMLElement,
                any,
                string
            >;

            /**
             * The version string of the user's `@mathjax/src` dependency.
             */
            const version = (await getVersion('@mathjax/src')) ?? 'latest';

            /**
             * This function is called exactly once for each build, and is
             * responsible for adding the `<link>` tag to the `<svelte:head>`
             * component that points to the CSS file generated by MathJax, and,
             * in the case of the 'svg' output format, for generating the CSS
             * file itself.
             */
            const handleCss: (
                mathHandler: MathHandler<'mathjax'>,
            ) => Promise<void> = async (mathHandler) => {
                const type = config.css.type;

                // With MathJax, there's no CSS available from CDNs (as far as I
                // could tell). For SVG output, I don't know why, but for CHTML
                // output this makes sense, as newer versions of MathJax
                // dynamically generate the minimal amount of CSS needed by
                // default.
                if (type === 'none') return;

                /**
                 * The directory to which we will write the CSS generated by
                 * MathJax.
                 */
                const { dir, staticDir } = config.css;

                /**
                 * The href to which the `<link>` tag in the `<svelte:head>`
                 * component will point.
                 *
                 * MathJax's output format (either `chtml` or `svg`). The output
                 * format influences the CSS that MathJax generates (in
                 * particular, the CSS for the `chtml` output format is much
                 * larger than the one for the `svg` output format).
                 * Accordingly, we want the filepath to which we write the
                 * generated CSS to be different depending on the output format.
                 */
                const href = join(dir, `mathjax@${version}.${fmt}.css`);
                /**
                 * The filepath to which we will write the CSS generated by
                 * MathJax.
                 */
                const path = join(staticDir, href);

                mathHandler._headLines = [
                    `<link rel="stylesheet" href="${ensureStartsWith(href, '/')}">`,
                ];

                // If the output format is `chtml`, we don't want to
                // generate the CSS file yet, because the MathJax processor
                // won't have rendered any math yet, so the CSS file would
                // be very incomplete. Instead, we'll call it with
                // `updateCss` at the end of the preprocessor run on each
                // page.
                if (fmt === 'chtml') return;

                // If the CSS file already exists, return early. Aside from
                // the file name, we don't have any "cache invalidation"
                // mechanism, so some cases might require manual
                // intervention by the end user (i.e., deleting the
                // generated CSS file manually if something went wrong while
                // generating it).
                if (fs.existsSync(path)) return;

                // Have MathJax generate the CSS for the SVG output format
                const css = processor.adaptor.textContent(
                    processor.outputJax.styleSheet(processor),
                );

                // Write the CSS to the specified filepath
                await fancyWrite(path, css);
            };

            /**
             * This is only meant to be called when the output format is
             * `chtml` and the CSS type is `hybrid`. This function is
             * responsible for updating the MathJax stylesheet to cover
             * all of the math that the MathJax processor has been requested
             * to render thus far. Unfortunately, since we can't know what
             * page is processed last, we have to call this function at the
             * end of every page that contains any MathJax math.
             */
            const updateCss: (
                mathHandler: MathHandler<'mathjax'>,
            ) => void = () => {
                nodeAssert(
                    fmt === 'chtml',
                    "Expected `outputFormat` to be 'chtml' in `updateCss` call.",
                );
                nodeAssert(
                    config.css.type === 'hybrid',
                    "Expected `css.type` to be 'hybrid' in `updateCss` call.",
                );

                // Have MathJax generate the CSS
                const css: string = processor.adaptor.textContent(
                    processor.outputJax.styleSheet(processor),
                );

                const { dir, staticDir } = config.css;

                /**
                 * The filepath to which we will write the CSS generated by
                 * MathJax.
                 */
                const path = join(
                    staticDir,
                    dir,
                    `mathjax@${version}.chtml.css`,
                );
                fs.writeFileEnsureDirSync(path, css);
            };

            const process: MathProcessFn<'mathjax'> = async (
                tex,
                { inline, options },
            ) => {
                const node = (await processor.convertPromise(tex, {
                    // Apply options from method parameter
                    ...options,
                    // Tell MathJax whether the output should be
                    // rendered as inline- or as display math.
                    display: inline === false,
                })) as HTMLElement;
                return processor.adaptor
                    .outerHTML(node)
                    .replace(/ data-latex=".*?"/g, '');
            };

            return new MathHandler<'mathjax'>({
                backend,
                process,
                configuration: config,
                handleCss,
                updateCss,
            }) as unknown as MathHandler<B>;
        }

        // Merge user-provided configuration into the default configuration.
        const configuration = mergeConfigs(
            getDefaultMathConfig('none'),
            userConfig ?? {},
        );

        // Return a `MathHandler` instance that effectively just transforms math
        // into an empty string.
        return new MathHandler<'none'>({
            backend,
            process: () => '',
            configuration,
        }) as unknown as MathHandler<B>;
    }
}
