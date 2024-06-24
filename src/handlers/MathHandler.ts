// File description: Handles math expressions.

// Types
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
    MathProcessFn,
    MathProcessOptions,
} from '$types/handlers/Math.js';

// Internal dependencies
import { getDefaultMathConfiguration } from '$config/defaults.js';
import { Handler } from '$handlers/Handler.js';
import { isArray } from '$typeGuards/utils.js';
import { cdnLink, fancyFetch, fancyWrite } from '$utils/cdn.js';
import { escapeCssColorVars, unescapeCssColorVars } from '$utils/css.js';
import { getVersion, missingDeps } from '$utils/env.js';
import { escapeBraces } from '$utils/escape.js';
import { fs } from '$utils/fs.js';
import { mergeConfigs } from '$utils/merge.js';
import { ensureEndsWith, ensureStartsWith } from '$utils/misc.js';
import { applyTransformations } from '$utils/transformers.js';

// External dependencies
import { inspect, is, join, nodeAssert, typeAssert } from '$deps.js';
import { log } from '$utils/debug.js';

export class MathHandler<B extends MathBackend> extends Handler<
    B,
    MathBackend,
    MathProcessOptions<B>,
    FullMathConfiguration<B>,
    MathHandler<B>
> {
    override get process() {
        return async (tex: string, options?: MathProcessOptions<B>) => {
            await this.handleCss();

            // Apply pre-transformers
            tex = applyTransformations(
                tex,
                { inline: options?.inline !== false },
                this._configuration.transformers.pre,
            );

            const res = await super.process(
                tex,
                options ?? ({} as MathProcessOptions<B>),
            );

            // Apply post-transformers
            res.processed = applyTransformations(
                res.processed,
                { inline: options?.inline !== false },
                this._configuration.transformers.post,
            );

            // Escape braces (which might otherwise confuse Svelte)
            res.processed = escapeBraces(res.processed);

            return res;
        };
    }

    private _handleCss: (mathHandler: this) => Promise<void> = () =>
        Promise.resolve();
    get handleCss() {
        return async () => {
            if (this._handledCss) return;
            this._handledCss = true;
            await this._handleCss(this);
        };
    }

    private _handledCss: boolean = false;

    // The `() => Promise.resolve()` function is unreachable, since the
    // `updateCss` getter only calls `_updateCss` if MathJax and CHTML are being
    // used, in which case `_updateCss` is overridden in the constructor.
    /* v8 ignore next 2 (unreachable code) */
    private _updateCss: (mathHandler: this) => Promise<void> = () =>
        Promise.resolve();

    get updateCss() {
        return async () => {
            if (
                this.backend === 'mathjax' &&
                (this._configuration as FullMathConfiguration<'mathjax'>).css
                    .type === 'hybrid' &&
                (this._configuration as FullMathConfiguration<'mathjax'>)
                    .outputFormat === 'chtml'
            ) {
                await this._updateCss(this);
            }
        };
    }

    /**
     * Lines of code that should be added to the `<svelte:head>` component
     * of any page that contains any TeX on which this handler ran. This
     * variable must be set at most once, and cannot depend on what page the
     * handler is being used on.
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
        updateCss?: (mathHandler: MathHandler<B>) => Promise<void>;
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
    static async create<B extends MathBackend>(
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
                getDefaultMathConfiguration('custom'),
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
                getDefaultMathConfiguration('katex', userConfig?.css?.type),
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
                            'No CDN specified for KaTeX. If you want to deactivate Sveltex CSS handling for KaTeX, set the `tex.css.type` property of the Sveltex configuration to `none`.',
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

            // Import the necessary functions and types from the `mathjax-full`
            // package, and throw an error if the import fails.
            let mathjax,
                TeX,
                SVG,
                CHTML,
                liteAdaptor,
                RegisterHTMLHandler,
                AllPackages,
                LiteElement;
            try {
                mathjax = (await import('mathjax-full/js/mathjax.js')).mathjax;
                TeX = (await import('mathjax-full/js/input/tex.js')).TeX;
                SVG = (await import('mathjax-full/js/output/svg.js')).SVG;
                CHTML = (await import('mathjax-full/js/output/chtml.js')).CHTML;
                liteAdaptor = (
                    await import('mathjax-full/js/adaptors/liteAdaptor.js')
                ).liteAdaptor;
                RegisterHTMLHandler = (
                    await import('mathjax-full/js/handlers/html.js')
                ).RegisterHTMLHandler;
                //  { AssistiveMmlHandler } = await import(
                //     'mathjax-full/js/a11y/assistive-mml.js'
                // );
                AllPackages = (
                    await import('mathjax-full/js/input/tex/AllPackages.js')
                ).AllPackages;
                LiteElement = (
                    await import('mathjax-full/js/adaptors/lite/Element.js')
                ).LiteElement;
            } catch (err) {
                // If the import fails, add `mathjax-full` to the list of
                // missing dependencies and rethrow the error.
                missingDeps.push('mathjax-full');
                throw err;
            }

            // We have to define the type outside of the try-catch block, but
            // since the import of LiteElement must've succeeded for this branch
            // to have been reached, we can safely assume that the import will
            // succeed here too.
            type LiteElementType =
                import('mathjax-full/js/adaptors/lite/Element.js').LiteElement;

            const adaptor = liteAdaptor();
            RegisterHTMLHandler(adaptor);
            // // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            // AssistiveMmlHandler(adaptor as any);

            // Merge user-provided configuration into the default configuration.
            let configuration = mergeConfigs(
                getDefaultMathConfiguration('mathjax', userConfig?.css?.type),
                userConfig ?? {},
            );

            /**
             * The version string of the user's `mathjax-full` dependency.
             */
            const version = (await getVersion('mathjax-full')) ?? 'latest';

            // If the output format is `chtml` and the CSS type is `hybrid`,
            // we need to ensure that the MathJax stylesheet is generated
            // with the correct font URLs.
            if (
                configuration.outputFormat === 'chtml' &&
                configuration.css.type === 'hybrid'
            ) {
                // If the output format is `chtml`, we need to ensure that
                // mathjax.chtml.fontURL is set correctly.
                const { cdn } = configuration.css;
                const firstCdn = isArray(cdn) ? cdn[0] : cdn;
                const isV4 = version && /^[^\d]*4\.\d+\.\d+/.test(version);
                const linkPrefix = ensureEndsWith(
                    // We don't test two MathJax versions at the same time, so
                    // one of these branches will always be missed.
                    /* v8 ignore next 13 */
                    isV4
                        ? cdnLink(
                              `mathjax-${configuration.css.font ?? 'modern'}-font`,
                              'chtml/woff/',
                              version,
                              'jsdelivr',
                          )
                        : cdnLink(
                              'mathjax',
                              'es5/output/chtml/fonts/woff-v2',
                              version,
                              firstCdn,
                          ),
                    '/',
                ).slice(0, -1);
                configuration = mergeConfigs(configuration, {
                    mathjax: { chtml: { fontURL: linkPrefix } },
                });
            }

            // Create a MathJax processor, to be used by the `process` function.
            const processor = mathjax.document('', {
                InputJax: new TeX({
                    packages: AllPackages,
                    ...configuration.mathjax.tex,
                }),
                OutputJax:
                    configuration.outputFormat === 'chtml'
                        ? new CHTML(configuration.mathjax.chtml)
                        : new SVG(configuration.mathjax.svg),
            });

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
                const type = configuration.css.type;

                // With MathJax, there's no CSS available from CDNs (as far as I
                // could tell). For SVG output, I don't know why, but for CHTML
                // output this makes sense, as newer versions of MathJax
                // dynamically generate the minimal amount of CSS needed by
                // default.
                if (type === 'none') return;

                /**
                 * MathJax's output format (either `chtml` or `svg`). The output
                 * format influences the CSS that MathJax generates (in
                 * particular, the CSS for the `chtml` output format is much
                 * larger than the one for the `svg` output format).
                 * Accordingly, we want the filepath to which we write the
                 * generated CSS to be different depending on the output format.
                 */
                const fmt = configuration.outputFormat;

                /**
                 * The directory to which we will write the CSS generated by
                 * MathJax.
                 */
                const { dir, staticDir } = configuration.css;

                /**
                 * The href to which the `<link>` tag in the `<svelte:head>`
                 * component will point.
                 */
                const href = join(dir, `mathjax@${version}.${fmt}.min.css`);
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
                const css = adaptor.textContent(
                    processor.outputJax.styleSheet(
                        processor,
                    ) as LiteElementType,
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
            ) => Promise<void> = async () => {
                nodeAssert(
                    configuration.outputFormat === 'chtml',
                    "Expected `outputFormat` to be 'chtml' in `updateCss` call.",
                );
                nodeAssert(
                    configuration.css.type === 'hybrid',
                    "Expected `css.type` to be 'hybrid' in `updateCss` call.",
                );

                // Have MathJax generate the CSS
                const css: string = adaptor.textContent(
                    processor.outputJax.styleSheet(
                        processor,
                    ) as LiteElementType,
                );

                // If the output format is `chtml`, we need to modify the
                // CSS to point to the correct font URLs. This is because
                // MathJax's CSS assumes that the fonts are in the same
                // directory as the CSS file, but we're writing self-hosting
                // the CSS here, so we'll need to replace the relative URLs
                // with URLs pointing to the fonts on a CDN.
                const { cdn } = configuration.css;
                const firstCdn = isArray(cdn) ? cdn[0] : cdn;

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!firstCdn) {
                    throw new Error(
                        'No CDN specified for MathJax. If you want to deactivate Sveltex CSS handling for MathJax, set the `tex.css.type` property of the Sveltex configuration to `none`.',
                    );
                }

                const { dir, staticDir } = configuration.css;

                /**
                 * The filepath to which we will write the CSS generated by
                 * MathJax.
                 */
                const path = join(
                    staticDir,
                    dir,
                    `mathjax@${version}.chtml.min.css`,
                );
                await fs.writeFileEnsureDir(path, css);
            };

            const process: MathProcessFn<'mathjax'> = async (
                tex,
                { inline, options },
            ) => {
                // Run MathJax
                const result: unknown = await processor.convert(tex, {
                    // Apply options from method parameter
                    ...options,

                    // Tell MathJax whether the output should be
                    // rendered as inline- or as display math.
                    display: inline === false,
                });

                // Assert validity of result
                nodeAssert(
                    result instanceof LiteElement,
                    'Expected MathJax to return a valid node. Instead, got:\n' +
                        inspect(result),
                );

                // Transform the result into something we can use, and
                // return it.
                return adaptor.outerHTML(result);
            };

            return new MathHandler<'mathjax'>({
                backend,
                process,
                configuration,
                handleCss,
                updateCss,
            }) as unknown as MathHandler<B>;
        }

        // Merge user-provided configuration into the default configuration.
        const configuration = mergeConfigs(
            getDefaultMathConfiguration('none'),
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
