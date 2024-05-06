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
import { escapeBraces, log, re } from '$utils';

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
        return (tex: string, options?: TexProcessOptions<B>['options']) => {
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
            processor?: TexProcessor<B>;
            process: TexProcessFn<B>;
            configure?: TexConfigureFn<B>;
            configuration?: TexConfiguration<B>;
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
                                ...texHandler.configuration,
                                ...options,
                            }),
                        );
                    };
                    return new TexHandler<'katex'>({
                        backend: 'katex',
                        configuration: {},
                        process,
                        processor: {},
                    });
                } catch (err) {
                    missingDeps.push('katex');
                    throw err;
                }
            case 'mathjax-full':
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
                    const handler = new TexHandler<'mathjax-full'>({
                        backend: 'mathjax-full',
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
                            return escapeBraces(adaptor.innerHTML(result));
                        },
                        configuration: {
                            outputFormat: 'svg',
                            mathjaxConfiguration: {},
                        },
                        processor: mathjax.document('', {
                            InputJax: new TeX(),
                            OutputJax: new SVG(),
                        }),
                    });

                    await handler.configure({
                        mathjaxConfiguration: {
                            tex: { packages: AllPackages },
                        },
                        outputFormat: 'chtml',
                    });
                    return handler;
                } catch (err) {
                    missingDeps.push('mathjax-full');
                    throw err;
                }
            case 'mathjax-node':
                try {
                    type Backend = 'mathjax-node';
                    type Configuration = TexConfiguration<Backend>;
                    const mathjax = await import('mathjax-node');
                    const process = async (
                        tex: string,
                        { inline, options }: TexProcessOptions<Backend>,
                        texHandler: TexHandler<Backend>,
                    ): Promise<string> => {
                        const result = await mathjax.typeset({
                            math: tex,
                            format: inline ?? true ? 'inline-TeX' : 'TeX',
                            ...texHandler.configuration.inputConfiguration,
                            ...options,
                        });
                        if (!result.errors) {
                            return escapeBraces(
                                result.svg ?? result.html ?? result.mml ?? '',
                            );
                        } else {
                            log('error', 'Errors: ', result.errors);
                            return '';
                        }
                    };
                    const configure = (
                        configuration: Configuration,
                        texHandler: TexHandler<'mathjax-node'>,
                    ) => {
                        if (configuration.mathjaxNodeConfiguration) {
                            mathjax.config(
                                texHandler.configuration
                                    .mathjaxNodeConfiguration,
                            );
                            mathjax.start();
                        }
                    };
                    const handler = new TexHandler<'mathjax-node'>({
                        backend: 'mathjax-node',
                        process,
                        configure,
                        processor: {},
                        configuration: {
                            inputConfiguration: {},
                            mathjaxNodeConfiguration: {},
                        },
                    });
                    await handler.configure({
                        inputConfiguration: { html: true },
                    });
                    return handler;
                } catch (err) {
                    missingDeps.push('mathjax-node');
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
                });
            default:
                throw new Error(`Unsupported TeX backend: "${backend}".`);
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        // return texHandlerFactories[backend as Exclude<TexBackend, 'custom'>]();
    }
}
