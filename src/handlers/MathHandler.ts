// Types
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
    MathConfigureFn,
    MathProcessFn,
    MathProcessOptions,
    MathProcessor,
} from '$types/handlers/Math.js';

// Internal dependencies
import { getDefaultMathConfiguration } from '$config/defaults.js';
import { Handler, deepClone } from '$handlers/Handler.js';
import { isArray, isOneOf } from '$typeGuards/utils.js';
import { cdnLink, fancyFetch, fancyWrite } from '$utils/cdn.js';
import { escapeBraces } from '$utils/escape.js';
import { fs } from '$utils/fs.js';
import { getVersion, missingDeps } from '$utils/env.js';
import { mergeConfigs } from '$utils/merge.js';
import {
    copyTransformations,
    ensureEndsWith,
    ensureStartsWith,
} from '$utils/misc.js';

// External dependencies
import {
    join,
    nodeAssert,
    // CleanCSS, Output, prettyBytes
} from '$deps.js';
import { escapeCssColorVars, unescapeCssColorVars } from '$utils/css.js';
import { applyTransformations } from '$utils/transformers.js';

export class MathHandler<B extends MathBackend> extends Handler<
    B,
    MathBackend,
    MathProcessor<B>,
    MathProcessOptions<B>,
    MathConfiguration<B>,
    FullMathConfiguration<B>,
    MathHandler<B>
> {
    override get configuration(): FullMathConfiguration<B> {
        // rfdc doesn't handle RegExps well, so we have to copy them manually
        const { pre, post } = this._configuration.transformers;
        return {
            ...deepClone(this._configuration),
            transformers: {
                pre: copyTransformations(pre),
                post: copyTransformations(post),
            },
        };
    }

    override configureNullOverrides: [string, unknown][] = [
        ['transformers', { pre: [], post: [] }],
        ['transformers.pre', []],
        ['transformers.post', []],
        ['mathjax.chtml', {}],
        [
            'css',
            isOneOf(this.backend, ['mathjax', 'katex'])
                ? {
                      type: 'none',
                      dir: 'sveltex',
                      staticDir: 'static',
                      timeout: 2000,
                      cdn: 'jsdelivr',
                  }
                : undefined,
        ],
    ];

    override get process() {
        return async (tex: string, options?: MathProcessOptions<B>) => {
            await this.handleCss();
            return super.process(tex, options ?? ({} as MathProcessOptions<B>));
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
            )
                await this._updateCss(this);
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
        configure,
        configuration,
        processor,
        handleCss,
    }: {
        backend: B;
        process: MathProcessFn<B>;
        configure: MathConfigureFn<B>;
        configuration: MathConfiguration<B>;
        processor: MathProcessor<B>;
        handleCss?: (mathHandler: MathHandler<B>) => Promise<void>;
    }) {
        super({
            backend,
            process,
            configure,
            configuration: mergeConfigs(
                getDefaultMathConfiguration(backend),
                configuration,
            ),
            processor,
        });
        if (handleCss) this._handleCss = handleCss;
    }

    /**
     * The version string of the tex processor used by this handler.
     *
     * This property is only available for the `katex` and `mathjax` backends.
     *
     * @example
     * For KaTeX this could e.g. be:
     * ```ts
     * '0.16.10'
     * ```
     * For MathJax, this could e.g. be:
     * ```ts
     * '3.2.2'
     * ```
     * or
     * ```ts
     * '4.0.0-beta.6'
     * ```
     */
    version: string | undefined = undefined;

    /**
     * Creates a math handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a math handler of the specified type.
     */
    static async create<B extends Exclude<MathBackend, 'custom'>>(
        backend: B,
    ): Promise<MathHandler<B>>;

    static async create<B extends 'custom'>(
        backend: B,
        {
            processor,
            process,
            configure,
            configuration,
        }: {
            processor?: MathProcessor<'custom'>;
            process: MathProcessFn<'custom'>;
            configure?: MathConfigureFn<'custom'>;
            configuration?: MathConfiguration<'custom'>;
        },
    ): Promise<MathHandler<B>>;

    /**
     * Creates a math handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a math handler of the specified type.
     */
    static async create<B extends MathBackend>(
        backend: B,
        custom?: B extends 'custom'
            ? {
                  processor?: MathProcessor<'custom'>;
                  process: MathProcessFn<'custom'>;
                  configure?: MathConfigureFn<'custom'>;
                  configuration?: MathConfiguration<'custom'>;
              }
            : never,
    ): Promise<MathHandler<B>> {
        if (backend === 'custom') {
            if (custom === undefined) {
                throw new Error(
                    'Called MathHandler.create("custom", custom) without a second parameter.',
                );
            }
            return new MathHandler<'custom'>({
                backend: 'custom',
                processor: custom.processor ?? {},
                process: custom.process,
                configure: custom.configure ?? (() => undefined),
                configuration: custom.configuration ?? {},
            }) as unknown as MathHandler<B>;
        } else if (backend === 'katex') {
            try {
                const { renderToString } = (await import('katex')).default;
                const process = (
                    tex: string,
                    { inline, options }: MathProcessOptions<'katex'>,
                    mathHandler: MathHandler<'katex'>,
                ): string => {
                    // Get pre- and post-transformers arrays, and KaTeX
                    // options.
                    const { transformers, katex } = mathHandler.configuration;

                    // Apply pre-transformers
                    let transformedTex = tex;
                    transformedTex = applyTransformations(
                        transformedTex,
                        { inline: inline !== false },
                        transformers.pre,
                    );

                    // Escape CSS color variables
                    const { escaped, cssColorVars } =
                        escapeCssColorVars(transformedTex);
                    transformedTex = escaped;

                    // Run KaTeX
                    let output = renderToString(transformedTex, {
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

                    // Apply post-transformers
                    output = applyTransformations(
                        output,
                        { inline: inline !== false },
                        transformers.post,
                    );

                    // Return result, escaping braces (which might otherwise
                    // confuse Svelte).
                    return escapeBraces(output);
                };
                const handleCss: (
                    mathHandler: MathHandler<'katex'>,
                ) => Promise<void> = async (mathHandler) => {
                    const cssConfig = mathHandler.configuration.css;
                    const { type } = cssConfig;

                    if (type === 'none') return;

                    // type: 'cdn' | 'hybrid'

                    const { cdn } = cssConfig;

                    const v = (await getVersion('katex')) ?? 'latest';

                    const cdns = isArray(cdn) ? cdn : [cdn];
                    // if (cdns.length === 0) return;
                    const links = cdns.map((c) =>
                        cdnLink('katex', 'dist/katex.min.css', v, c),
                    );

                    if (type === 'cdn') {
                        if (links[0]) {
                            mathHandler._headLines = [
                                `<link rel="stylesheet" href="${links[0]}">`,
                            ];
                        } else {
                            throw new Error(
                                'No CDN specified for KaTeX. If you want to deactivate Sveltex CSS handling for KaTeX, set the `tex.css.type` property of the Sveltex configuration to `none`.',
                            );
                        }
                        return;
                    }

                    // type: 'hybrid'

                    const { dir, staticDir } = cssConfig;

                    const href = join(dir, `katex@${v}.min.css`);
                    const path = join(staticDir, href);

                    mathHandler._headLines = [
                        `<link rel="stylesheet" href="${ensureStartsWith(href, '/')}">`,
                    ];

                    if (fs.existsSync(path)) return;

                    let css = await fancyFetch(links);

                    if (!css) return;

                    const linkPrefix = cdnLink(
                        'katex',
                        'dist/fonts/',
                        v,
                        cdns[0],
                    );

                    css = css.replaceAll('fonts/', linkPrefix);

                    // Write the CSS to the specified path
                    await fancyWrite(path, css);
                };
                const th = new MathHandler<'katex'>({
                    backend: 'katex',
                    configuration: getDefaultMathConfiguration('katex'),
                    process,
                    configure: (configuration, handler) => {
                        if (configuration.css?.type) {
                            handler._configuration.css = mergeConfigs(
                                getDefaultMathConfiguration(
                                    'katex',
                                    handler._configuration.css.type,
                                ).css,
                                configuration.css,
                            );
                        }
                    },
                    processor: {},
                    handleCss,
                });
                await th.configure({});
                return th as unknown as MathHandler<B>;
            } catch (err) {
                missingDeps.push('katex');
                throw err;
            }
        } else if (backend === 'mathjax') {
            try {
                const { mathjax } = await import('mathjax-full/js/mathjax.js');
                const { TeX } = await import('mathjax-full/js/input/tex.js');
                const { SVG } = await import('mathjax-full/js/output/svg.js');
                const { CHTML } = await import(
                    'mathjax-full/js/output/chtml.js'
                );
                const { liteAdaptor } = await import(
                    'mathjax-full/js/adaptors/liteAdaptor.js'
                );
                const { RegisterHTMLHandler } = await import(
                    'mathjax-full/js/handlers/html.js'
                );
                // const { AssistiveMmlHandler } = await import(
                //     'mathjax-full/js/a11y/assistive-mml.js'
                // );
                const { AllPackages } = await import(
                    'mathjax-full/js/input/tex/AllPackages.js'
                );
                const LiteElement = (
                    await import('mathjax-full/js/adaptors/lite/Element.js')
                ).LiteElement;
                type LiteElementType =
                    import('mathjax-full/js/adaptors/lite/Element.js').LiteElement;

                const adaptor = liteAdaptor();
                RegisterHTMLHandler(adaptor);
                /// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
                // AssistiveMmlHandler(adaptor as any);

                const handleCss: (
                    mathHandler: MathHandler<'mathjax'>,
                ) => Promise<void> = async (mathHandler) => {
                    const config = mathHandler.configuration;

                    const type = config.css.type;

                    // With MathJax, there's no CSS available from CDNs (as far
                    // as I could tell). For SVG output, I don't know why, but
                    // for CHTML output this makes sense, as newer versions of
                    // MathJax dynamically generate the minimal amount of CSS
                    // needed by default.
                    if (type === 'none') return;

                    /**
                     * The installed version of `mathjax-full`, as set in the
                     * end user's `package.json` file.
                     */
                    const v = (await getVersion('mathjax-full')) ?? 'latest';
                    mathHandler.version = v;

                    /**
                     * MathJax's output format (either `chtml` or `svg`). The
                     * output format influences the CSS that MathJax generates
                     * (in particular, the CSS for the `chtml` output format is
                     * much larger than the one for the `svg` output format).
                     * Accordingly, we want the filepath to which we write the
                     * generated CSS to be different depending on the output
                     * format.
                     */
                    const fmt = config.outputFormat;

                    if (fmt === 'chtml') {
                        // If the output format is `chtml`, we need to ensure
                        // that mathjax.chtml.fontURL is set correctly.
                        const { cdn } = config.css;
                        const firstCdn = isArray(cdn) ? cdn[0] : cdn;
                        const isV4 = v && /^[^\d]*4\.\d+\.\d+/.test(v);
                        const linkPrefix = ensureEndsWith(
                            // We don't test two MathJax versions at the
                            // same time, so one of these branches will
                            // always be missed.
                            /* v8 ignore next 13 */
                            isV4
                                ? cdnLink(
                                      `mathjax-${config.css.font ?? 'modern'}-font`,
                                      'chtml/woff/',
                                      v,
                                      'jsdelivr',
                                  )
                                : cdnLink(
                                      'mathjax',
                                      'es5/output/chtml/fonts/woff-v2/',
                                      v,
                                      firstCdn,
                                  ),
                            '/',
                        );
                        await mathHandler.configure({
                            mathjax: { chtml: { fontURL: linkPrefix } },
                        });
                    }

                    /**
                     * The directory to which we will write the CSS generated by
                     * MathJax.
                     */
                    const { dir, staticDir } = config.css;

                    /**
                     * The href to which the `<link>` tag in the `<svelte:head>`
                     * component will point.
                     */
                    const href = join(dir, `mathjax@${v}.${fmt}.min.css`);
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

                    // Have MathJax generate the CSS
                    const css = adaptor.textContent(
                        mathHandler.processor.outputJax.styleSheet(
                            mathHandler.processor,
                        ) as LiteElementType,
                    );

                    // if (fmt === 'chtml') {
                    //     (await import('mathjax-full')).init({
                    //         loader: {
                    //             source: await import('mathjax-full/components/src/source.js'),
                    //             load: ['adaptors/liteDOM', 'tex-chtml']
                    //         },
                    //         tex:
                    //     })
                    // }

                    // Minify the CSS
                    // let opt: Output;
                    // await runWithSpinner(
                    //     () => {
                    //         opt = new CleanCSS().minify(css);
                    //         if (opt.errors.length > 0) {
                    //             throw new Error(
                    //                 `clean-css raised the following error(s) during minification of MathJax's stylesheet (${fmt}):\n- ${opt.errors.join(
                    //                     '\n- ',
                    //                 )}`,
                    //             );
                    //         }
                    //         css = opt.styles;
                    //     },
                    //     {
                    //         startMessage: `Minifying MathJax stylesheet (${fmt})`,
                    //         successMessage: (t) =>
                    //             `Minified MathJax stylesheet (${fmt}) (${prettyBytes(opt.stats.originalSize)} → ${prettyBytes(opt.stats.minifiedSize)}, ${(opt.stats.efficiency * 100).toFixed(0)}% reduction) in ${t}`,
                    //         failMessage: (t) =>
                    //             `Error minifying MathJax stylesheet (${fmt}) after ${t}`,
                    //     },
                    // );

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
                ) => Promise<void> = async (mathHandler) => {
                    const config = mathHandler.configuration;

                    nodeAssert(
                        config.outputFormat === 'chtml',
                        "Expected `outputFormat` to be 'chtml' in `updateCss` call.",
                    );
                    nodeAssert(
                        config.css.type === 'hybrid',
                        "Expected `css.type` to be 'hybrid' in `updateCss` call.",
                    );

                    // Have MathJax generate the CSS
                    const css: string = adaptor.textContent(
                        mathHandler.processor.outputJax.styleSheet(
                            mathHandler.processor,
                        ) as LiteElementType,
                    );

                    // If the output format is `chtml`, we need to modify the
                    // CSS to point to the correct font URLs. This is because
                    // MathJax's CSS assumes that the fonts are in the same
                    // directory as the CSS file, but we're writing self-hosting
                    // the CSS here, so we'll need to replace the relative URLs
                    // with URLs pointing to the fonts on a CDN.
                    const { cdn } = config.css;
                    const firstCdn = isArray(cdn) ? cdn[0] : cdn;

                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    if (!firstCdn) {
                        throw new Error(
                            'No CDN specified for MathJax. If you want to deactivate Sveltex CSS handling for MathJax, set the `tex.css.type` property of the Sveltex configuration to `none`.',
                        );
                    }

                    nodeAssert(
                        mathHandler.version,
                        'Expected `handleCss` to have been called before `updateCss`.',
                    );

                    /**
                     * The installed version of `mathjax-full`, as set in the
                     * end user's `package.json` file.
                     */
                    const v = mathHandler.version;

                    // css = css.replaceAll(
                    //     // We don't test two MathJax versions at the same
                    //     // time, so one of these branches will always be
                    //     // missed.
                    //     /* v8 ignore next 3 */
                    //     isV4
                    //         ? '/chtml/woff/'
                    //         : 'js/output/chtml/fonts/tex-woff-v2/',
                    //     linkPrefix,
                    // );
                    // if (isV4 && config.css.font) {
                    //     css = css.replaceAll(
                    //         new RegExp(`(${linkPrefix}.*?)-mm-`, 'gu'),
                    //         `$1-${
                    //             {
                    //                 stix2: 'stx',
                    //                 fira: 'fira',
                    //                 asana: 'asna',
                    //                 tex: 'tex',
                    //                 modern: 'mm',
                    //                 bonum: 'gb',
                    //                 dejavu: 'gdv',
                    //                 pagella: 'gp',
                    //                 schola: 'gs',
                    //                 termes: 'gt',
                    //                 ncm: 'ncm',
                    //             }[config.css.font]
                    //         }-`,
                    //     );
                    // }

                    const { dir, staticDir } = config.css;

                    /**
                     * The filepath to which we will write the CSS generated by
                     * MathJax.
                     */
                    const path = join(
                        staticDir,
                        dir,
                        `mathjax@${v}.chtml.min.css`,
                    );
                    await fs.writeFileEnsureDir(path, css);
                };

                const handler = new MathHandler<'mathjax'>({
                    backend: 'mathjax',
                    configure: (configuration, handler) => {
                        if (configuration.css?.type) {
                            handler._configuration.css = mergeConfigs(
                                getDefaultMathConfiguration(
                                    'mathjax',
                                    handler._configuration.css.type,
                                ).css,
                                configuration.css,
                            );
                        }

                        const config = handler._configuration;

                        handler.processor = mathjax.document('', {
                            InputJax: new TeX({
                                packages: AllPackages,
                                ...config.mathjax.tex,
                            }),
                            OutputJax:
                                config.outputFormat === 'chtml'
                                    ? new CHTML(config.mathjax.chtml)
                                    : new SVG(config.mathjax.svg),
                        });
                    },
                    process: async (tex, { inline, options }, mathHandler) => {
                        // Get pre- and post-transformers arrays
                        const { transformers } = mathHandler.configuration;

                        // Apply pre-transformers
                        let transformedTex = tex;
                        transformedTex = applyTransformations(
                            transformedTex,
                            { inline: inline !== false },
                            transformers.pre,
                        );

                        // Run MathJax
                        const result = await mathHandler.processor.convert(
                            transformedTex,
                            {
                                // Apply options from method parameter
                                ...options,

                                // Tell MathJax whether the output should be
                                // rendered as inline- or as display math.
                                display: inline === false,
                            },
                        );

                        // Validate result
                        if (!(result instanceof LiteElement)) {
                            throw new Error(
                                `MathJax did not return a valid node (result: ${String(result)}).`,
                            );
                        }

                        // Transform the result into something we can use
                        let output = adaptor.outerHTML(result);

                        // Apply post-transformers
                        output = applyTransformations(
                            output,
                            { inline: inline !== false },
                            transformers.post,
                        );

                        // Return result, escaping braces (which might otherwise
                        // confuse Svelte).
                        return escapeBraces(output);
                    },
                    configuration: getDefaultMathConfiguration('mathjax'),
                    processor: mathjax.document('', {
                        InputJax: new TeX({ packages: AllPackages }),
                        OutputJax: new SVG(),
                    }),
                    handleCss,
                });
                handler._updateCss = updateCss;
                await handler.configure({
                    mathjax: { tex: { packages: AllPackages } },
                });
                // Apparently, MathJax's `document` function isn't
                // serializable. This will upset Vite, so we need to
                // remove it from the object returned by `toJSON`.
                (handler as unknown as { toJSON: () => object }).toJSON =
                    () => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { processor, ...rest } = handler;
                        return rest;
                    };
                return handler as unknown as MathHandler<B>;
            } catch (err) {
                missingDeps.push('mathjax-full');
                throw err;
            }
        }
        return new MathHandler<'none'>({
            backend: 'none',
            process: (input) => input,
            configure: () => {
                return;
            },
            processor: {},
            configuration: {},
        }) as unknown as MathHandler<B>;
    }
}
