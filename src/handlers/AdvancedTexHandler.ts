// Types
import type {
    AdvancedTexBackend,
    AdvancedTexConfiguration,
    AdvancedTexConfigureFn,
    AdvancedTexHandlerFactories,
    AdvancedTexProcessFn,
    AdvancedTexProcessOptions,
    AdvancedTexProcessor,
    FullAdvancedTexConfiguration,
    TexComponentConfig,
} from '$types';

// Internal dependencies
import { defaultAdvancedTexConfiguration } from '$config';
import { TexComponent, log } from '$utils';
import { Handler } from './Handler.js';

export class AdvancedTexHandler<B extends AdvancedTexBackend> extends Handler<
    B,
    AdvancedTexBackend,
    AdvancedTexProcessor,
    AdvancedTexProcessOptions,
    AdvancedTexConfiguration<B>,
    FullAdvancedTexConfiguration<B>,
    AdvancedTexHandler<B>
> {
    // override _configuration: FullAdvancedTexConfiguration<B>;

    // override get configuration(): FullAdvancedTexConfiguration<B> {
    //     return this._configuration;
    // }

    // override set configuration(configuration: AdvancedTexConfiguration<B>) {
    //     this._configuration = mergeConfigs(this._configuration, configuration);
    //     if (this.backendIs('local')) {
    //         this.tccMap = this._configuration.components as Record<
    //             string,
    //             TexComponentConfig
    //         >;
    //     }
    // }

    /**
     * Process content.
     *
     * @param content - The content to process.
     * @param options - Options to pass to the processor.
     * @returns The processed content, or promise resolving to it.
     */
    override get process() {
        return (content: string, options: AdvancedTexProcessOptions) => {
            return super.process(content, options);
        };
    }

    /**
     * TeX component configurations map.
     *
     * - key: component configuration name
     * - val: component configuration
     */
    private _tccMap: Map<string, TexComponentConfig> = new Map<
        string,
        TexComponentConfig
    >();

    set tccMap(ttcs: Record<string, TexComponentConfig> | undefined) {
        if (ttcs === undefined) return;

        const components = new Map<string, TexComponentConfig>();

        // Add "main" names of tex components
        for (const [name, config] of Object.entries(ttcs)) {
            components.set(name, config);
            if (!this.tccNames.includes(name)) {
                this.tccNames.push(name);
            }
        }

        // Array to store duplicate aliases, for logging
        const duplicates: string[] = [];

        // Add aliases, and check for duplicates
        for (const [name, config] of Object.entries(ttcs)) {
            if (typeof config === 'object' && 'aliases' in config) {
                for (const alias of config.aliases) {
                    if (alias !== name) {
                        if (components.has(alias)) {
                            duplicates.push(alias);
                        }
                        this.tccAliasToNameMap.set(alias, name);
                        if (!this.tccAliases.includes(alias)) {
                            this.tccAliases.push(alias);
                        }
                    }
                }
            }
        }

        // Log error about duplicates, if present
        [...new Set(duplicates)].forEach((alias) => {
            log('error')(
                `Duplicate advanced TeX component name/alias "${alias}".`,
            );
        });

        this._tccMap = components;
    }

    get tccMap(): Map<string, TexComponentConfig> {
        return this._tccMap;
    }

    /**
     * {@link Sveltex.texComponentsMap | `Sveltex.texComponentsMap`} of the
     * parent `Sveltex` instance.
     *
     * @remarks Important: This property should always set by the parent
     * `Sveltex` instance. Without it, the `AdvancedTexHandler` will not be able
     * to work properly.
     *
     * While preprocessing a file with name `filename`, the Sveltex instance
     * will call the `process` method of its instance of `AdvancedTexHandler` on
     * whatever advanced TeX blocks it finds in the file. Now,
     * `AdvancedTexHandler.process` will instantiate a `TexComponent` object for
     * each advanced TeX block, and call its `compile` method, which will in
     * turn generate the SVG file for the TeX block.
     *
     * However, the question now is how we include the SVG file in the
     * preprocessed code. The answer is: we add some code to the file's
     * `<script>` tag that will add the SVG file's contents to the `<figure>`
     * tag that `AdvancedTexHandler.process` returned for the TeX block.
     * However, this code can't be added by the `Sveltex.markup` method, since
     * Svelte requires (prefers?) that the `<script>` tag be preprocessed with a
     * separate preprocessor, which in our case corresponds to `Sveltex.script`.
     * But, for this preprocessor to be able to add the code, it needs to know,
     * given a filename, for what SVG files it should add code to the `<script>`
     * tag to add their content to the corresponding `<figure>` tags. This
     * precise need is fulfilled by this `texComponentsMap` property, which
     * `Sveltex.markup` writes to via `Sveltex.markup` →
     * `VerbatimHandler.process` → `AdvancedTexHandler.process`, and
     * `Sveltex.script` reads from directly.
     *
     * This is also why `AdvancedTexProcessOptions` requires a `filename`
     * property, and why the `AdvancedTexHandler.process` method requires the
     * `options` parameter to be provided.
     *
     * **NB**: The `Sveltex.markup` always runs before `Sveltex.script`; this
     * behavior is guaranteed by Svelte itself, see [Svelte
     * docs](https://svelte.dev/docs/svelte-compiler#preprocess))
     */
    texComponentsMap?: Map<string, TexComponent[]>;

    readonly tccNames: string[] = [];
    readonly tccAliases: string[] = [];
    private readonly tccAliasToNameMap: Map<string, string> = new Map<
        string,
        string
    >();

    /**
     * Resolves an alias to the name of the component it refers to. If the input
     * string is already a component name, it is returned as is. If the input
     * string is neither a component name nor an alias, 'unknown' is returned.
     *
     * @param alias - The alias to resolve.
     * @returns The name of the component the alias refers to.
     */
    resolveTccAlias(alias: string): string {
        return (
            this.tccAliasToNameMap.get(alias) ??
            (this.tccNames.includes(alias) ? alias : 'unknown')
        );
    }

    // backendIs<Q extends AdvancedTexBackend | B>(
    //     backend: Q,
    // ): this is AdvancedTexHandler<Q> {
    //     return this.backend === backend;
    // }

    // backendIsNot<Q extends AdvancedTexBackend | B>(
    //     backend: Q,
    // ): this is AdvancedTexHandler<Exclude<AdvancedTexBackend, Q>> {
    //     return this.backend !== backend;
    // }

    // constructor({
    //     backend,
    //     process,
    //     processor,
    //     configure,
    //     configuration,
    // }: {
    //     backend: B;
    //     process: AdvancedTexProcessFn<B>;
    //     processor: AdvancedTexProcessor;
    //     configure: AdvancedTexConfigureFn<B>;
    //     configuration: FullAdvancedTexConfiguration<B>;
    // }) {
    //     super({
    //         backend,
    //         process,
    //         processor,
    //         configure,
    //         configuration,
    //     });

    //     // this._process = process;
    //     // if (processor) this.processor = processor;
    //     // this._configure = configure;
    //     // this._configuration = defaultAdvancedTexConfiguration[
    //     //     backend
    //     // ] as FullAdvancedTexConfiguration<B>;
    //     // if (configuration) this.configuration = configuration;
    // }
}

/**
 * Object that maps the names of supported advanced tex processors to a factory that
 * creates a advanced tex handler of that type.
 */
const advancedTexHandlerFactories: AdvancedTexHandlerFactories = {
    /**
     * Creates a advanced tex handler that uses the `marked` advanced tex processor.
     */
    local: () => {
        const process = async (
            tex: string,
            options: AdvancedTexProcessOptions,
            advancedTexHandler: AdvancedTexHandler<'local'>,
        ) => {
            if (tex.trim() === '') return '';
            const name = advancedTexHandler.resolveTccAlias(
                options.name ?? 'unknown',
            );
            const component = new TexComponent({
                name,
                config: advancedTexHandler.tccMap.get(name),
                attributes: options.attributes,
                texDocumentBody: tex,
                ref: options.ref,
                advancedTexHandler: advancedTexHandler,
            });
            await component.compile();
            if (!advancedTexHandler.texComponentsMap?.has(options.filename)) {
                advancedTexHandler.texComponentsMap?.set(options.filename, []);
            }
            const arr = advancedTexHandler.texComponentsMap?.get(
                options.filename,
            );
            if (
                !arr?.includes(component) &&
                arr?.find((c) => c.hash === component.hash) === undefined
            ) {
                arr?.push(component);
            }
            return component.figureElement.outerHTML;
        };
        const configure = (
            _configuration: AdvancedTexConfiguration<'local'>,
            advancedTexHandler: AdvancedTexHandler<'local'>,
        ) => {
            advancedTexHandler.tccMap =
                advancedTexHandler.configuration.components;
        };
        return new AdvancedTexHandler<'local'>({
            backend: 'local',
            process,
            processor: {},
            configure,
            configuration: defaultAdvancedTexConfiguration.local,
        });
    },
    /**
     * Creates a advanced tex handler that uses a custom advanced tex processor.
     *
     * @param processor - The custom advanced tex processor.
     * @param process - A function that processes a advanced tex string.
     * @param configure - A function that configures the advanced tex processor.
     * @returns A promise that resolves to a advanced tex handler that uses the
     * custom advanced tex processor.
     *
     * @experimental
     */
    custom: (processor, process, configure, configuration) => {
        type Backend = 'custom';
        return new AdvancedTexHandler<Backend>({
            backend: 'custom',
            processor,
            process,
            configure,
            configuration,
        });
    },
    /**
     *
     */
    none: () => {
        return new AdvancedTexHandler<'none'>({
            backend: 'none',
            process: (tex: string) => tex,
            configure: () => {
                return;
            },
            processor: {},
            configuration: {},
        });
    },
};

/**
 * Creates a advanced tex handler of the specified type.
 *
 * @param backend - The type of the advanced tex processor to create.
 * @returns A promise that resolves to a advanced tex handler of the specified type.
 */
export async function createAdvancedTexHandler<
    B extends Exclude<AdvancedTexBackend, 'custom'>,
>(backend: B): Promise<AdvancedTexHandler<B>>;

export async function createAdvancedTexHandler<B extends 'custom'>(
    backend: B,
    {
        processor,
        process,
        configure,
        configuration,
    }: {
        processor?: AdvancedTexProcessor;
        process: AdvancedTexProcessFn<'custom'>;
        configure?: AdvancedTexConfigureFn<'custom'>;
        configuration?: AdvancedTexConfiguration<'custom'>;
    },
): Promise<AdvancedTexHandler<B>>;

/**
 * Creates a advanced tex handler of the specified type.
 *
 * @param backend - The type of the advanced tex processor to create.
 * @returns A promise that resolves to a advanced tex handler of the specified type.
 */
export async function createAdvancedTexHandler<B extends AdvancedTexBackend>(
    backend: B,
    custom?: B extends 'custom'
        ? {
              processor?: AdvancedTexProcessor;
              process: AdvancedTexProcessFn<'custom'>;
              configure?: AdvancedTexConfigureFn<'custom'>;
              configuration?: AdvancedTexConfiguration<'custom'>;
          }
        : never,
) {
    if (backend === 'custom') {
        if (custom === undefined) {
            throw new Error(
                'Called createAdvancedTexHandler("custom", custom) without a second parameter.',
            );
        }
        return advancedTexHandlerFactories.custom(
            custom.processor ?? {},
            custom.process,
            custom.configure ??
                (() => {
                    return;
                }),
            custom.configuration ?? {},
        );
    }
    return advancedTexHandlerFactories[
        /* eslint-disable-next-line
        @typescript-eslint/no-unnecessary-type-assertion */
        backend as Exclude<AdvancedTexBackend, 'custom'>
    ]();
}
