// Types
import type {
    FullTexConfiguration,
    TexBackend,
    TexConfiguration,
    TexConfigureFn,
    TexHandlerFactories,
    TexProcessFn,
    TexProcessOptions,
    TexProcessor,
} from '$types';

// Internal dependencies
import { re } from '$processor/utils.js';
import { escapeBraces } from '$processor/escape.js';
import { isLiteElement } from '$type-guards';

// External dependencies
import { merge } from 'ts-deepmerge';
import { missingDeps } from '$globals';
import { log } from '$utils';
import { Handler } from '$src/handlers/Handler.js';

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
}

const texHandlerFactories: TexHandlerFactories = {
    katex: async () => {
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
    },
    'mathjax-full': async (configuration?) => {
        try {
            const { mathjax } = await import('mathjax-full/js/mathjax.js');
            const { TeX } = await import('mathjax-full/js/input/tex.js');
            const { SVG } = await import('mathjax-full/js/output/svg.js');
            const { CHTML } = await import('mathjax-full/js/output/chtml.js');
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
                            handler.configuration.mathjaxConfig?.tex,
                        ),
                        OutputJax:
                            handler.configuration.outputFormat === 'chtml'
                                ? new CHTML(
                                      handler.configuration.mathjaxConfig?.chtml,
                                  )
                                : new SVG(
                                      handler.configuration.mathjaxConfig?.svg,
                                  ),
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
                    return escapeBraces(adaptor.innerHTML(result));
                },
                configuration: { outputFormat: 'svg' },
                processor: mathjax.document('', {
                    InputJax: new TeX(),
                    OutputJax: new SVG(),
                }),
            });

            await handler.configure(
                merge(
                    { mathjaxConfig: { tex: { packages: AllPackages } } },
                    configuration ?? { outputFormat: 'chtml' },
                ) as TexConfiguration<'mathjax-full'>,
            );
            return handler;
        } catch (err) {
            missingDeps.push('mathjax-full');
            throw err;
        }
    },
    'mathjax-node': async () => {
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
                    ...texHandler.configuration.inputConfig,
                    ...options,
                });
                if (!result.errors) {
                    return escapeBraces(
                        result.svg ?? result.html ?? result.mml ?? '',
                    );
                } else {
                    log('error')('Errors: ', result.errors);
                    return '';
                }
            };
            const configure = (
                configuration: Configuration,
                texHandler: TexHandler<'mathjax-node'>,
            ) => {
                if (configuration.mathjaxNodeConfig) {
                    mathjax.config(
                        texHandler.configuration.mathjaxNodeConfig ??
                            configuration.mathjaxNodeConfig,
                    );
                    mathjax.start();
                }
            };
            const handler = new TexHandler<'mathjax-node'>({
                backend: 'mathjax-node',
                process,
                configure,
                processor: {},
                configuration: {},
            });
            await handler.configure({ inputConfig: { html: true } });
            return handler;
        } catch (err) {
            missingDeps.push('mathjax-node');
            throw err;
        }
    },
    custom: (processor, process, configure, configuration) =>
        new TexHandler<'custom'>({
            backend: 'custom',
            processor,
            process,
            configure,
            configuration,
        }),
    none: (configuration = {}) =>
        new TexHandler<'none'>({
            backend: 'none',
            process: (input) => input,
            configure: () => {
                return;
            },
            processor: {},
            configuration,
        }),
};

/**
 * Creates a tex handler of the specified type.
 *
 * @param backend - The type of the tex processor to create.
 * @returns A promise that resolves to a tex handler of the specified type.
 */
export async function createTexHandler<B extends Exclude<TexBackend, 'custom'>>(
    backend: B,
): Promise<TexHandler<B>>;

export async function createTexHandler<B extends 'custom'>(
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
export async function createTexHandler<B extends TexBackend>(
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
                'Called createTexHandler("custom", custom) without a second parameter.',
            );
        }
        return texHandlerFactories.custom(
            custom.processor ?? {},
            custom.process,
            custom.configure ??
                (() => {
                    return;
                }),
            custom.configuration ?? {},
        );
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return texHandlerFactories[backend as Exclude<TexBackend, 'custom'>]();
}
