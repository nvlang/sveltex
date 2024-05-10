// Types
import type {
    FullTexConfiguration,
    TexBackend,
    TexConfiguration,
    TexConfigureFn,
    TexProcessFn,
    TexProcessOptions,
    TexProcessor,
} from '$types';

// Internal dependencies
import { missingDeps } from '$utils/globals.js';
import { Handler } from '$handlers/Handler.js';
import { isArray, isLiteElement } from '$type-guards';
import {
    prefixWithSlash,
    escapeBraces,
    fs,
    mergeConfigs,
    re,
    runWithSpinner,
} from '$utils';
import { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';
import { getDefaultTexConfiguration } from '$config/defaults.js';
import { join } from 'node:path';
import CleanCSS, { Output } from 'clean-css';
import prettyBytes from 'pretty-bytes';
import { fancyFetch, fancyWrite, getVersion, cdnLink } from '$utils/cdn.js';
import { katexFonts } from 'src/data/tex.js';
import { CssApproach, CssApproachLocal } from '$types/handlers/misc.js';

export class TexHandler<
    B extends TexBackend,
    CA = B extends 'mathjax'
        ? CssApproachLocal
        : B extends 'katex'
          ? CssApproach
          : never,
> extends Handler<
    B,
    TexBackend,
    TexProcessor<B>,
    TexProcessOptions<B>,
    TexConfiguration<B>,
    FullTexConfiguration<B>,
    TexHandler<B, CA>
> {
    override get process() {
        return async (
            tex: string,
            options?: TexProcessOptions<B>['options'],
        ) => {
            await this.handleCss();

            const displayMath = tex.match(
                re`^ (?: \$\$ (.*) \$\$ | \\\[ (.*) \\\] ) $ ${'su'}`,
            );
            const inlineMath = tex.match(
                re`^ (?: \$ (.*) \$ | \\\( (.*) \\\) ) $ ${'su'}`,
            );
            if (displayMath) {
                return super.process(
                    // We ignore the line below because the regex guarantees
                    // that one of the groups is not null, but TypeScript
                    // doesn't realize this, and I don't want to use a non-null
                    // assertion.
                    /* v8 ignore next */
                    displayMath[1] ?? displayMath[2] ?? '',
                    {
                        options,
                        inline: false,
                    } as TexProcessOptions<B>,
                );
            }
            if (inlineMath) {
                return super.process(
                    // We ignore the line below because the regex guarantees
                    // that one of the groups is not null, but TypeScript
                    // doesn't realize this, and I don't want to use a non-null
                    // assertion.
                    /* v8 ignore next */
                    inlineMath[1] ?? inlineMath[2] ?? '',
                    {
                        options,
                        inline: true,
                    } as TexProcessOptions<B>,
                );
            }
            return super.process(tex, { options } as TexProcessOptions<B>);
        };
    }

    private _handleCss: (texHandler: this) => Promise<void> = () =>
        Promise.resolve();
    get handleCss() {
        return async () => {
            if (this._handledCss) return;
            this._handledCss = true;
            await this._handleCss(this);
        };
    }
    private _handledCss: boolean = false;

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
        process: TexProcessFn<B>;
        configure: TexConfigureFn<B>;
        configuration: TexConfiguration<B>;
        processor: TexProcessor<B>;
        handleCss?: (texHandler: TexHandler<B>) => Promise<void>;
    }) {
        super({
            backend,
            process,
            configure,
            configuration: mergeConfigs(
                getDefaultTexConfiguration(backend),
                configuration,
            ),
            processor,
        });
        if (handleCss) this._handleCss = handleCss;
    }

    /**
     * Creates a tex handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a tex handler of the specified type.
     */
    static async create<B extends Exclude<TexBackend, 'custom'>>(
        backend: B,
    ): Promise<TexHandler<B>>;

    static async create<B extends 'custom'>(
        backend: B,
        {
            processor,
            process,
            configure,
            configuration,
        }: {
            processor?: TexProcessor<'custom'>;
            process: TexProcessFn<'custom'>;
            configure?: TexConfigureFn<'custom'>;
            configuration?: TexConfiguration<'custom'>;
        },
    ): Promise<TexHandler<B>>;

    /**
     * Creates a tex handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a tex handler of the specified type.
     */
    static async create<B extends TexBackend>(
        backend: B,
        custom?: B extends 'custom'
            ? {
                  processor?: TexProcessor<'custom'>;
                  process: TexProcessFn<'custom'>;
                  configure?: TexConfigureFn<'custom'>;
                  configuration?: TexConfiguration<'custom'>;
              }
            : never,
    ) {
        if (backend === 'custom') {
            if (custom === undefined) {
                throw new Error(
                    'Called TexHandler.create("custom", custom) without a second parameter.',
                );
            }
            return new TexHandler<'custom'>({
                backend: 'custom',
                processor: custom.processor ?? {},
                process: custom.process,
                configure: custom.configure ?? (() => undefined),
                configuration: custom.configuration ?? {},
            });
        } else if (backend === 'katex') {
            try {
                const { renderToString } = (await import('katex')).default;
                const process = (
                    tex: string,
                    { inline, options }: TexProcessOptions<'katex'>,
                    texHandler: TexHandler<'katex'>,
                ): string => {
                    return escapeBraces(
                        renderToString(tex, {
                            displayMode: inline === false,
                            ...texHandler.configuration.katex,
                            ...options,
                        }),
                    );
                };
                const handleCss: (
                    texHandler: TexHandler<'katex'>,
                ) => Promise<void> = async (texHandler) => {
                    const cssConfig = texHandler.configuration.css;
                    const { type, dir, cdn } = cssConfig;

                    if (type === 'none') return;

                    const v = (await getVersion('katex')) ?? 'latest';

                    const cdns = isArray(cdn) ? cdn : [cdn];
                    if (cdns.length === 0) return;
                    const links = cdns.map((c) =>
                        cdnLink('katex', 'dist/katex.min.css', v, c),
                    );

                    if (type === 'cdn' && links[0]) {
                        texHandler._headLines = [
                            `<link rel="stylesheet" href="${links[0]}">`,
                        ];
                        return;
                    }

                    const path = join(dir, `katex@${v}.min.css`);

                    texHandler._scriptLines = [
                        `import '${prefixWithSlash(path)}';`,
                    ];

                    if (fs.existsSync(path)) return;

                    const css = await fancyFetch(links);

                    if (!css) return;

                    // Write the CSS to the specified path
                    await fancyWrite(path, css);

                    await Promise.all(
                        katexFonts.map(async (fontName) => {
                            const links = cdns.map((c) =>
                                cdnLink(
                                    'katex',
                                    `dist/fonts/${fontName}`,
                                    v,
                                    c,
                                ),
                            );
                            const fontFile = await fancyFetch(links);
                            if (!fontFile) return;
                            await fancyWrite(
                                join(dir, 'fonts', fontName),
                                fontFile,
                            );
                        }),
                    );
                };
                const th = new TexHandler<'katex'>({
                    backend: 'katex',
                    configuration: getDefaultTexConfiguration('katex'),
                    process,
                    configure: () => undefined,
                    processor: {},
                    handleCss,
                });
                await th.configure({});
                return th;
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
                const { AllPackages } = await import(
                    'mathjax-full/js/input/tex/AllPackages.js'
                );

                const adaptor = liteAdaptor();
                RegisterHTMLHandler(adaptor);

                const handleCss: (
                    texHandler: TexHandler<'mathjax'>,
                ) => Promise<void> = async (texHandler) => {
                    // Convenience alias
                    const config = texHandler.configuration;

                    // With MathJax, there's no CSS available from CDNs (as far
                    // as I could tell). For SVG output, I don't know why, but
                    // for CHTML output this makes sense, as newer versions of
                    // MathJax dynamically generate the minimal amount of CSS
                    // needed by default. However, as far as I could tell, this
                    // is a somewhat tricky mechanism to take advantage of
                    // within SSR, so, for CHTML, we'll just generate the big
                    // (~200kB) CSS file that enables MathJax's entire feature
                    // set. Because of this, I recommend using the SVG output
                    // format with MathJax within Sveltex.
                    if (config.css.type !== 'self-hosted') return;

                    /**
                     * The installed version of `mathjax-full`, as set in the
                     * end user's `package.json` file.
                     */
                    const v = (await getVersion('mathjax-full')) ?? 'latest';

                    /**
                     * The directory to which we will write the CSS generated by
                     * MathJax.
                     */
                    const dir = config.css.dir;

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

                    /**
                     * The filepath to which we will write the CSS generated by
                     * MathJax.
                     */
                    const path = join(dir, `mathjax@${v}.${fmt}.min.css`);

                    texHandler._scriptLines = [
                        `import '${prefixWithSlash(path)}';`,
                    ];

                    // If the CSS file already exists, return early. Aside from
                    // the file name, we don't have any "cache invalidation"
                    // mechanism, so some cases might require manual
                    // intervention by the end user (i.e., deleting the
                    // generated CSS file manually if something went wrong while
                    // generating it).
                    if (fs.existsSync(path)) return;

                    // Have MathJax generate the CSS
                    let css: string = '';
                    const codeGen = await runWithSpinner(
                        () => {
                            css = adaptor.textContent(
                                texHandler.processor.outputJax.styleSheet(
                                    texHandler.processor,
                                ) as LiteElement,
                            );
                        },
                        {
                            startMessage: `Generating MathJax stylesheet (${fmt})`,
                            successMessage: (t) =>
                                `Generated MathJax stylesheet (${fmt}) in ${t}`,
                            failMessage: (t) =>
                                `Error generating MathJax stylesheet (${fmt}) after ${t}`,
                        },
                    );

                    // If MathJax failed to generate the CSS, return early
                    if (codeGen !== 0) return;

                    // Minify the CSS
                    let opt: Output;
                    await runWithSpinner(
                        () => {
                            opt = new CleanCSS().minify(css);
                            if (opt.errors.length > 0) {
                                throw new Error(
                                    `clean-css raised the following error(s) during minification of MathJax's stylesheet (${fmt}):\n- ${opt.errors.join(
                                        '\n- ',
                                    )}`,
                                );
                            }
                            css = opt.styles;
                        },
                        {
                            startMessage: `Minifying MathJax stylesheet (${fmt})`,
                            successMessage: (t) =>
                                `Minified MathJax stylesheet (${fmt}) (${prettyBytes(opt.stats.originalSize)} → ${prettyBytes(opt.stats.minifiedSize)}, ${String(opt.stats.efficiency * 100)}% reduction) in ${t}`,
                            failMessage: (t) =>
                                `Error minifying MathJax stylesheet (${fmt}) after ${t}`,
                        },
                    );

                    // Write the CSS to the specified filepath
                    await fancyWrite(path, css);
                };

                const handler = new TexHandler<'mathjax'>({
                    backend: 'mathjax',
                    configure: (_configuration, handler) => {
                        const config = handler.configuration;
                        handler.processor = mathjax.document('', {
                            InputJax: new TeX(config.mathjax.tex),
                            OutputJax:
                                config.outputFormat === 'chtml'
                                    ? new CHTML(config.mathjax.chtml)
                                    : new SVG(config.mathjax.svg),
                        });
                    },
                    process: async (tex, { inline, options }, texHandler) => {
                        const result = await texHandler.processor.convert(tex, {
                            ...options,
                            display: inline === false,
                        });

                        if (!isLiteElement(result)) {
                            throw new Error(
                                `MathJax did not return a valid node (result: ${String(result)}).`,
                            );
                        }
                        return escapeBraces(adaptor.outerHTML(result));
                    },
                    configuration: getDefaultTexConfiguration('mathjax'),
                    processor: mathjax.document('', {
                        InputJax: new TeX(),
                        OutputJax: new SVG(),
                    }),
                    handleCss,
                });
                await handler.configure({
                    mathjax: {
                        tex: { packages: AllPackages },
                    },
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
                return handler;
            } catch (err) {
                missingDeps.push('mathjax-full');
                throw err;
            }
        }
        return new TexHandler<'none'>({
            backend: 'none',
            process: (input) => input,
            configure: () => {
                return;
            },
            processor: {},
            configuration: {},
        });
    }
}
