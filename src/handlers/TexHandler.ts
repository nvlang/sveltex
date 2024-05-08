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
import { isLiteElement } from '$type-guards';
import {
    ensureDoesNotStartWithSlash,
    escapeBraces,
    fs,
    log,
    mergeConfigs,
    prettifyError,
    re,
    runWithSpinner,
} from '$utils';
import { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';
import { getDefaultTexConfiguration } from '$config/defaults.js';
import fetch from 'node-fetch';
import { join, normalize } from 'path';
import ora from 'ora';
import CleanCSS, { Output } from 'clean-css';
import pc from 'picocolors';
import prettyBytes from 'pretty-bytes';

type StringIfMathjaxOrKatex<B extends TexBackend> = B extends
    | 'mathjax'
    | 'katex'
    ? string
    : undefined;
type SylesheetNameOrPath<B extends TexBackend> = B extends 'mathjax'
    ? `mathjax@${string}.${'chtml' | 'svg'}.min.css`
    : B extends 'katex'
      ? `katex@${string}.min.css`
      : undefined;

export class TexHandler<B extends TexBackend> extends Handler<
    B,
    TexBackend,
    TexProcessor<B>,
    TexProcessOptions<B>,
    TexConfiguration<B>,
    FullTexConfiguration<B>,
    TexHandler<B>
> {
    override get process() {
        return async (
            tex: string,
            options?: TexProcessOptions<B>['options'],
        ) => {
            if (!this.stylesheetHasBeenGenerated) {
                await this.generateStylesheet();
            }

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

    private _generateStylesheet: (texHandler: this) => Promise<void> = () =>
        Promise.resolve();
    get generateStylesheet() {
        return async () => {
            await this._generateStylesheet(this);
        };
    }
    private stylesheetHasBeenGenerated: boolean = false;

    private constructor({
        backend,
        process,
        configure,
        configuration,
        processor,
        backendVersion,
        generateStylesheet,
    }: {
        backend: B;
        process: TexProcessFn<B>;
        configure: TexConfigureFn<B>;
        configuration: TexConfiguration<B>;
        processor: TexProcessor<B>;
        backendVersion: StringIfMathjaxOrKatex<B>;
        generateStylesheet?: (texHandler: TexHandler<B>) => Promise<void>;
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
        this.backendVersion = backendVersion;
        if (generateStylesheet) this._generateStylesheet = generateStylesheet;
    }

    get stylesheetName(): SylesheetNameOrPath<B> {
        const v = this.backendVersion ?? 'latest';
        switch (this.backend) {
            case 'katex':
                return `katex@${v}.min.css` as SylesheetNameOrPath<B>;
            case 'mathjax':
                return `mathjax@${v}.${(this as unknown as TexHandler<'mathjax'>).configuration.outputFormat}.min.css` as SylesheetNameOrPath<B>;
            default:
                return undefined as SylesheetNameOrPath<B>;
        }
    }

    get stylesheetPath(): StringIfMathjaxOrKatex<B> {
        if (!(this.backendIs('mathjax') || this.backendIs('katex'))) {
            return undefined as StringIfMathjaxOrKatex<B>;
        }
        const texHandler = this as unknown as TexHandler<'mathjax' | 'katex'>;
        const stylesheetName = texHandler.stylesheetName;

        let dir = texHandler.configuration.css.dir;
        dir = normalize(dir);
        dir = ensureDoesNotStartWithSlash(dir);
        return join(dir, stylesheetName) as StringIfMathjaxOrKatex<B>;
    }

    private backendVersion: StringIfMathjaxOrKatex<B>;

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
        switch (backend) {
            case 'custom':
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
                    backendVersion: undefined,
                });
            case 'katex':
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
                    const generateStylesheet: (
                        texHandler: TexHandler<'katex'>,
                    ) => Promise<void> = async (texHandler) => {
                        const stylesheetPath = texHandler.stylesheetPath;
                        if (texHandler.configuration.css.write) {
                            // If the CSS file already exists and the backend
                            // version is set, we don't need to fetch the CSS.
                            // If the backend version is `'latest'`, this
                            // assumption is a bit flawed, but alas, it shall
                            // suffice for now.
                            if (fs.existsSync(stylesheetPath)) return;

                            const url = `https://cdn.jsdelivr.net/npm/katex@${texHandler.backendVersion}/dist/katex.min.css`;

                            const spinner = ora(
                                `Fetching KaTeX stylesheet from "${url}"`,
                            ).start();

                            try {
                                // Fetch the CSS file from JSdelivr
                                const response = await fetch(url);

                                // Get the CSS content
                                // Check if the response is ok (status in the range 200-299)
                                if (!response.ok) {
                                    spinner.fail(
                                        `HTTP error: ${String(response.status)}.`,
                                    );
                                    throw new Error(
                                        `HTTP error fetching KaTeX stylesheet from JSdelivr (${url}): ${String(response.status)}.`,
                                    );
                                }

                                spinner.text = 'Reading response';

                                // Get the CSS content as text
                                const css = await response.text();

                                try {
                                    spinner.text = `Writing KaTeX stylesheet to ${stylesheetPath}`;

                                    // Write the CSS to the specified path
                                    await fs.writeFileEnsureDir(
                                        stylesheetPath,
                                        css,
                                    );

                                    texHandler.stylesheetHasBeenGenerated =
                                        true;

                                    spinner.succeed(
                                        pc.green(
                                            `Wrote KaTeX stylesheet to ${stylesheetPath}`,
                                        ),
                                    );
                                } catch (err) {
                                    spinner.fail(
                                        pc.red(
                                            `Error writing KaTeX stylesheet to ${stylesheetPath}`,
                                        ),
                                    );
                                    log('error', prettifyError(err) + '\n\n');
                                }
                            } catch (err) {
                                spinner.fail(
                                    pc.red(
                                        `Error fetching KaTeX stylesheet from "${url}"`,
                                    ),
                                );
                                log('error', prettifyError(err) + '\n\n');
                            }
                        }
                    };
                    let backendVersion: string;
                    try {
                        backendVersion = (
                            await import('katex/package.json', {
                                with: { type: 'json' },
                            })
                        ).default.version;
                    } catch (err) {
                        backendVersion = 'latest';
                        log(
                            'error',
                            'Error getting KaTeX version:\n\n',
                            prettifyError(err) + '\n\n',
                        );
                    }
                    const th = new TexHandler<'katex'>({
                        backend: 'katex',
                        configuration: getDefaultTexConfiguration('katex'),
                        process,
                        configure: () => undefined,
                        processor: {},
                        backendVersion,
                        generateStylesheet,
                    });
                    await th.configure({});
                    return th;
                } catch (err) {
                    missingDeps.push('katex');
                    throw err;
                }
            case 'mathjax':
                try {
                    const { mathjax } = await import(
                        'mathjax-full/js/mathjax.js'
                    );
                    const { TeX } = await import(
                        'mathjax-full/js/input/tex.js'
                    );
                    const { SVG } = await import(
                        'mathjax-full/js/output/svg.js'
                    );
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

                    let backendVersion: string;
                    try {
                        backendVersion = (
                            await import('mathjax-full/package.json', {
                                with: { type: 'json' },
                            })
                        ).default.version;
                    } catch (err) {
                        backendVersion = 'latest';
                        log(
                            'error',
                            'Error getting MathJax version:\n\n',
                            prettifyError(err) + '\n\n',
                        );
                    }
                    const generateStylesheet: (
                        texHandler: TexHandler<'mathjax'>,
                    ) => Promise<void> = async (texHandler) => {
                        const stylesheetPath = texHandler.stylesheetPath;
                        if (
                            !stylesheetPath ||
                            !texHandler.configuration.css.write
                        ) {
                            return;
                        }
                        // If the CSS file already exists and the backend
                        // version is set, we don't need to fetch the CSS. If
                        // the backend version is `'latest'`, this assumption is
                        // a bit flawed, but alas, it shall suffice for now.
                        if (fs.existsSync(stylesheetPath)) return;

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
                                startMessage: `Generating MathJax stylesheet (${texHandler.configuration.outputFormat})`,
                                successMessage: (t) =>
                                    `Generated MathJax stylesheet (${texHandler.configuration.outputFormat}) in ${t}`,
                                failMessage: (t) =>
                                    `Error generating MathJax stylesheet (${texHandler.configuration.outputFormat}) after ${t}`,
                            },
                        );

                        if (codeGen !== 0) return;

                        let opt: Output;
                        await runWithSpinner(
                            () => {
                                opt = new CleanCSS().minify(css);
                                if (opt.errors.length > 0) {
                                    throw new Error(
                                        `clean-css raised the following error(s) during minification of MathJax's stylesheet (${texHandler.configuration.outputFormat}):\n- ${opt.errors.join(
                                            '\n- ',
                                        )}`,
                                    );
                                }
                                css = opt.styles;
                            },
                            {
                                startMessage: `Minifying MathJax stylesheet (${texHandler.configuration.outputFormat})`,
                                successMessage: (t) =>
                                    `Minified MathJax stylesheet (${texHandler.configuration.outputFormat}) (${prettyBytes(opt.stats.originalSize)} → ${prettyBytes(opt.stats.minifiedSize)}, ${String(opt.stats.originalSize * 100)}% reduction) in ${t}`,
                                failMessage: (t) =>
                                    `Error minifying MathJax stylesheet (${texHandler.configuration.outputFormat}) after ${t}`,
                            },
                        );

                        await runWithSpinner(
                            async () => {
                                await fs.writeFileEnsureDir(
                                    stylesheetPath,
                                    css,
                                );
                                texHandler.stylesheetHasBeenGenerated = true;
                            },
                            {
                                startMessage: `Writing MathJax stylesheet (${texHandler.configuration.outputFormat}) to ${stylesheetPath}`,
                                successMessage: (t) =>
                                    `Wrote MathJax stylesheet (${texHandler.configuration.outputFormat}) to ${stylesheetPath} in ${t}`,
                                failMessage: (t) =>
                                    `Error writing MathJax stylesheet (${texHandler.configuration.outputFormat}) to ${stylesheetPath} after ${t}`,
                            },
                        );
                    };

                    const handler = new TexHandler<'mathjax'>({
                        backend: 'mathjax',
                        backendVersion,
                        configure: (_configuration, handler) => {
                            handler.processor = mathjax.document('', {
                                InputJax: new TeX(
                                    handler.configuration.mathjaxConfiguration.tex,
                                ),
                                OutputJax:
                                    handler.configuration.outputFormat ===
                                    'chtml'
                                        ? new CHTML(
                                              handler.configuration.mathjaxConfiguration.chtml,
                                          )
                                        : new SVG(
                                              handler.configuration.mathjaxConfiguration.svg,
                                          ),
                            });
                        },
                        process: async (
                            tex,
                            { inline, options },
                            texHandler,
                        ) => {
                            const result = await texHandler.processor.convert(
                                tex,
                                {
                                    ...options,
                                    display: inline === false,
                                },
                            );

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
                        generateStylesheet,
                    });
                    await handler.configure({
                        mathjaxConfiguration: {
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
            case 'none':
                return new TexHandler<'none'>({
                    backend: 'none',
                    process: (input) => input,
                    configure: () => {
                        return;
                    },
                    processor: {},
                    configuration: {},
                    backendVersion: undefined,
                });
            default:
                throw new Error(`Unsupported TeX backend: "${backend}".`);
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        // return texHandlerFactories[backend as Exclude<TexBackend, 'custom'>]();
    }
}
