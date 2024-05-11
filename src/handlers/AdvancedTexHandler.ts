// Types
import type {
    AdvancedTexBackend,
    AdvancedTexConfiguration,
    AdvancedTexConfigureFn,
    AdvancedTexProcessFn,
    AdvancedTexProcessOptions,
    AdvancedTexProcessor,
    FullAdvancedTexConfiguration,
    TexComponentConfiguration,
    TexComponentImportInfo,
} from '$types/handlers/AdvancedTex.js';

// Internal dependencies
import { getDefaultAdvancedTexConfiguration } from '$config/defaults.js';
import { TexComponent } from '$utils/TexComponent.js';
import { SveltexCache } from '$utils/cache.js';
import { log } from '$utils/debug.js';
import { mergeConfigs } from '$utils/merge.js';
import { Handler } from '$handlers/Handler.js';

export class AdvancedTexHandler<B extends AdvancedTexBackend> extends Handler<
    B,
    AdvancedTexBackend,
    AdvancedTexProcessor,
    AdvancedTexProcessOptions,
    AdvancedTexConfiguration<B>,
    FullAdvancedTexConfiguration<B>,
    AdvancedTexHandler<B>
> {
    /**
     * The cache object used by the handler. Definite assignment in
     * {@link AdvancedTexHandler.create | `AdvancedTexHandler.create`}, hence
     * the definite assignment assertion (given that the constructor of
     * `AdvancedTexHandler` is private).
     */
    private _cache!: SveltexCache;

    public get cache(): SveltexCache {
        return this._cache;
    }

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
    private _tccMap: Map<string, TexComponentConfiguration<B>> = new Map<
        string,
        TexComponentConfiguration<B>
    >();

    private _tccNames: string[] = [];

    /**
     * Copy of the {@link _tccNames | `_tccNames`} property.
     *
     * @remarks Mutating this array will not affect the `_tccNames` property.
     */
    public get tccNames(): string[] {
        return [...this._tccNames];
    }

    private _tccAliases: string[] = [];

    /**
     * Copy of the {@link _tccAliases | `_tccAliases`} property.
     *
     * @remarks Mutating this array will not affect the `_tccAliases` property.
     */
    public get tccAliases(): string[] {
        return [...this._tccAliases];
    }

    private readonly tccAliasToNameMap: Map<string, string> = new Map<
        string,
        string
    >();

    set tccMap(tccs: Record<string, TexComponentConfiguration<B>> | null) {
        if (tccs === null) {
            // Reset tccMap, tccNames, tccAliases, and tccAliasToNameMap
            this._tccMap = new Map<string, TexComponentConfiguration<B>>();
            this._tccNames = [];
            this._tccAliases = [];
            this.tccAliasToNameMap.clear();
            return;
        }

        const components = new Map<string, TexComponentConfiguration<B>>();

        // Add "main" names of tex components
        for (const [name, config] of Object.entries(tccs)) {
            components.set(name, config);
            if (!this._tccNames.includes(name)) {
                this._tccNames.push(name);
            }
        }

        // Array to store duplicate aliases, for logging
        const duplicates: string[] = [];

        // Add aliases, and check for duplicates
        for (const [name, config] of Object.entries(tccs)) {
            if (typeof config === 'object' && 'aliases' in config) {
                for (const alias of config.aliases) {
                    if (alias !== name) {
                        if (components.has(alias)) {
                            duplicates.push(alias);
                        }
                        this.tccAliasToNameMap.set(alias, name);
                        if (!this._tccAliases.includes(alias)) {
                            this._tccAliases.push(alias);
                        }
                    }
                }
            }
        }

        // Log error about duplicates, if present
        [...new Set(duplicates)].forEach((alias) => {
            log(
                'error',
                `Duplicate advanced TeX component name/alias "${alias}".`,
            );
        });

        this._tccMap = components;
    }

    get tccMap(): Map<string, TexComponentConfiguration<B>> {
        return this._tccMap;
    }

    /**
     * {@link Sveltex.texComponents | `Sveltex.texComponents`} of the
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
     * precise need is fulfilled by this `texComponents` property, which
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
    texComponents: Record<string, TexComponentImportInfo[]>;

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
            (this._tccNames.includes(alias) ? alias : 'unknown')
        );
    }

    /**
     * Notes a tex component in a file.
     *
     * @param filename - The name of the file.
     * @param tc - The tex component to note.
     */
    noteTcInFile(filename: string, tc: TexComponentImportInfo) {
        if (
            filename in this.texComponents &&
            this.texComponents[filename] !== undefined
        ) {
            if (
                !this.texComponents[filename]?.includes(tc) &&
                !this.texComponents[filename]?.find(
                    (c) => c.id === tc.id || c.path === tc.path,
                )
            ) {
                // Add tex component to existing entry for file if it isn't
                // already there.
                this.texComponents[filename]?.push(tc);
            }
        } else {
            // Create new entry for file if it doesn't already exist
            this.texComponents[filename] = [tc];
        }
    }

    createTexComponent(
        content: string,
        options: AdvancedTexProcessOptions,
    ): TexComponent<B> {
        return TexComponent.create({
            ...options,
            tex: content,
            advancedTexHandler: this,
        });
    }

    override get configure() {
        return async (configuration: AdvancedTexConfiguration<B>) => {
            const { cacheDirectory: oldCacheDirectory } = this.configuration;
            await super.configure(configuration);
            const { cacheDirectory: newCacheDirectory } = this.configuration;
            if (oldCacheDirectory !== newCacheDirectory) {
                // Reload cache if cache directory changes
                this._cache = await SveltexCache.load(
                    this.configuration.outputDirectory,
                    newCacheDirectory,
                );
            }
        };
    }

    /**
     * The constructor is private to ensure that only the
     * {@link AdvancedTexHandler.create | `AdvancedTexHandler.create`} method
     * can be used to create instances of
     * {@link AdvancedTexHandler | `AdvancedTexHandler`}.
     *
     * @internal
     */
    private constructor({
        backend,
        process,
        processor,
        configure,
        configuration,
        texComponents,
    }: {
        backend: B;
        process: AdvancedTexProcessFn<B>;
        processor: AdvancedTexProcessor;
        configure: AdvancedTexConfigureFn<B>;
        configuration: FullAdvancedTexConfiguration<B>;
        texComponents: Record<string, TexComponentImportInfo[]>;
    }) {
        super({
            backend,
            process,
            processor,
            configure,
            configuration,
        });
        this.texComponents = texComponents;
        this.configureNullOverrides = [
            ['components', {}],
            ['overrideConversionCommand', undefined],
            ['overrideCompilationCommand', undefined],
        ];
    }

    /**
     * Creates an advanced tex handler of the specified type.
     *
     * @param backend - The type of the advanced tex processor to create.
     * @returns A promise that resolves to a advanced tex handler of the specified type.
     */
    static async create<B extends Exclude<AdvancedTexBackend, 'custom'>>(
        backend: B,
    ): Promise<AdvancedTexHandler<B>>;

    static async create<B extends 'custom'>(
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
     * Creates an advanced tex handler of the specified type.
     *
     * @param backend - The type of the advanced tex processor to create.
     * @returns A promise that resolves to a advanced tex handler of the specified type.
     */
    static async create<B extends AdvancedTexBackend>(
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
        let ath;
        switch (backend) {
            case 'custom':
                if (custom === undefined) {
                    throw new Error(
                        'Called AdvancedTexHandler.create("custom", custom) without a second parameter.',
                    );
                }
                ath = new AdvancedTexHandler({
                    backend: 'custom',
                    processor: custom.processor ?? {},
                    process: custom.process,
                    configure: custom.configure ?? (() => undefined),
                    configuration: mergeConfigs(
                        getDefaultAdvancedTexConfiguration('custom'),
                        custom.configuration ?? {},
                    ),
                    texComponents: {},
                });
                break;
            case 'local':
                {
                    const process = async (
                        tex: string,
                        options: AdvancedTexProcessOptions,
                        advancedTexHandler: AdvancedTexHandler<'local'>,
                    ) => {
                        const tc = TexComponent.create({
                            ...options,
                            tex,
                            advancedTexHandler,
                        });
                        if (!options.selfClosing) {
                            if (tex.trim() === '') return '';
                            await tc.compile();
                        }
                        const importInfo = {
                            id: tc.id,
                            path: tc.out.sveltePath,
                        };
                        advancedTexHandler.noteTcInFile(
                            options.filename,
                            importInfo,
                        );
                        return tc.outputString;
                    };
                    const configure = (
                        _configuration: AdvancedTexConfiguration<'local'>,
                        advancedTexHandler: AdvancedTexHandler<'local'>,
                    ) => {
                        advancedTexHandler.tccMap =
                            _configuration.components === null
                                ? null
                                : advancedTexHandler.configuration.components;
                    };
                    const configuration =
                        getDefaultAdvancedTexConfiguration('local');
                    ath = new AdvancedTexHandler({
                        backend: 'local',
                        process,
                        processor: {},
                        configure,
                        configuration,
                        texComponents: {},
                    });
                }
                break;
            case 'none':
                ath = new AdvancedTexHandler({
                    backend: 'none',
                    process: (tex: string) => tex,
                    configure: () => undefined,
                    processor: {},
                    configuration: getDefaultAdvancedTexConfiguration('none'),
                    texComponents: {},
                });
                break;
            default:
                throw new Error(
                    `Unsupported advanced tex backend: "${backend}".`,
                );
        }
        ath._cache = await SveltexCache.load(
            ath.configuration.outputDirectory,
            ath.configuration.cacheDirectory,
        );
        return ath;
    }
}
