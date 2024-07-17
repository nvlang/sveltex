// File description: Handles TeX content.

// Types
import type { Poppler } from '$deps.js';
import type {
    TexBackend as TexBackend,
    TexProcessFn,
    TexProcessOptions as TexProcessOptions,
    FullTexConfiguration as FullTexConfiguration,
    TexComponentImportInfo,
    TexConfiguration,
} from '$types/handlers/Tex.js';

// Internal dependencies
import { getDefaultTexConfig } from '$base/defaults.js';
import { TexComponent } from '$utils/TexComponent.js';
import { SveltexCache } from '$utils/cache.js';
import { Handler } from '$handlers/Handler.js';
import { pathExists } from '$utils/fs.js';
import { mergeConfigs } from '$utils/merge.js';
import type { ProcessedSnippet } from '$types/utils/Escape.js';

export class TexHandler extends Handler<
    TexBackend,
    TexBackend,
    TexProcessOptions,
    FullTexConfiguration,
    TexHandler
> {
    /**
     * The cache object used by the handler. Definite assignment in
     * {@link TexHandler.create | `TexHandler.create`}, hence
     * the definite assignment assertion (given that the constructor of
     * `TexHandler` is private).
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
    override get process(): (
        content: string,
        options: TexProcessOptions,
    ) => ProcessedSnippet | Promise<ProcessedSnippet> {
        return (content: string, options: TexProcessOptions) => {
            return super.process(content, options);
        };
    }

    /**
     * {@link Sveltex.texComponents | `Sveltex.texComponents`} of the parent
     * `Sveltex` instance.
     *
     * @remarks Important: This property should always set by the parent
     * `Sveltex` instance. Without it, the `TexHandler` will not be able to work
     * properly.
     *
     * While preprocessing a file with name `filename`, the Sveltex instance
     * will call the `process` method of its instance of `TexHandler` on
     * whatever TeX blocks it finds in the file. Now, `TexHandler.process` will
     * instantiate a `TexComponent` object for each TeX block, and call its
     * `compile` method, which will in turn generate the Svelte SVG component
     * (in a separate file) for the TeX block.
     *
     * However, the question now is how do we include the Svelte SVG component
     * in the preprocessed code. The answer is: we add import statements to the
     * file's `<script>` tag which will allow us to include the SVG component in
     * the `<figure>` tag that `TexHandler.process` returned for the TeX block.
     * However, these import statements can't (shouldn't?) be added by the
     * `Sveltex.markup` method, since Svelte requires (prefers?) that the
     * `<script>` tag be preprocessed with a separate preprocessor, which in our
     * case corresponds to `Sveltex.script`. But, for this preprocessor to be
     * able to add the import statements, it needs to know, given a filename,
     * what SVG components it should be importing. This precise need is
     * fulfilled by this `texComponents` property, which `Sveltex.markup` writes
     * to via `Sveltex.markup` → `VerbatimHandler.process` →
     * `TexHandler.process`, and `Sveltex.script` reads from directly.
     *
     * This is also why `TexProcessOptions` requires a `filename` property, and
     * why the `TexHandler.process` method requires the `options` parameter to
     * be provided.
     *
     * **NB**: The `Sveltex.markup` always runs before `Sveltex.script`; this
     * behavior is guaranteed by Svelte itself, see [Svelte
     * docs](https://svelte.dev/docs/svelte-compiler#preprocess).
     */
    texComponents: Record<string, TexComponentImportInfo[]>;

    /**
     * Notes a tex component in a file.
     *
     * @param filename - The name of the file.
     * @param tc - The tex component to note.
     */
    noteTcInFile(filename: string, tc: TexComponentImportInfo): void {
        if (
            filename in this.texComponents &&
            this.texComponents[filename] !== undefined
        ) {
            if (
                !this.texComponents[filename].includes(tc) &&
                !this.texComponents[filename].find(
                    (c) => c.id === tc.id || c.path === tc.path,
                )
            ) {
                // Add tex component to existing entry for file if it isn't
                // already there.
                this.texComponents[filename].push(tc);
            }
        } else {
            // Create new entry for file if it doesn't already exist
            this.texComponents[filename] = [tc];
        }
    }

    /**
     * The constructor is private to ensure that only the
     * {@link TexHandler.create | `TexHandler.create`} method
     * can be used to create instances of
     * {@link TexHandler | `TexHandler`}.
     *
     * @internal
     */
    private constructor({
        backend,
        process,
        configuration,
        texComponents,
    }: {
        backend: 'local';
        process: TexProcessFn;
        configuration: FullTexConfiguration;
        texComponents: Record<string, TexComponentImportInfo[]>;
    }) {
        super({ backend, process, configuration });
        this.texComponents = texComponents;
    }

    poppler?: Poppler | undefined;

    /**
     * Creates a tex handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a tex handler of the specified type.
     */
    static async create(userConfig?: TexConfiguration): Promise<TexHandler> {
        // Merge user-provided configuration into the default configuration.
        const configuration = mergeConfigs(
            getDefaultTexConfig(),
            userConfig ?? {},
        );

        const process = async (
            tex: string,
            options: TexProcessOptions,
            texHandler: TexHandler,
        ) => {
            const tc = TexComponent.create({
                ...options,
                tex,
                texHandler,
            });
            if (!options.selfClosing) {
                if (tex.trim() === '') return '';
                await tc.compile();
            }
            const importInfo = {
                id: tc.id,
                path: tc.out.sveltePath,
            };
            if (pathExists(tc.out.sveltePath)) {
                texHandler.noteTcInFile(options.filename, importInfo);
                return tc.outputString;
            }
            return '';
        };

        const ath = new TexHandler({
            backend: 'local',
            process,
            configuration,
            texComponents: {},
        });

        ath._cache = await SveltexCache.load(
            ath.configuration.conversion.outputDirectory,
            ath.configuration.caching.cacheDirectory,
        );
        return ath;
    }
}
