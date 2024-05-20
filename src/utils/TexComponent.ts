// Types
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type {
    AdvancedTexBackend,
    FullTexComponentConfiguration,
    FullTexLiveConfiguration,
    TexComponentConfiguration,
    TexComponentImportInfo,
} from '$types/handlers/AdvancedTex.js';
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type { KeyPath } from '$utils/cache.js';

// Internal dependencies
import {
    getDefaultAdvancedTexConfiguration,
    getDefaultTexComponentConfiguration,
} from '$config/defaults.js';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { spawnCliInstruction } from '$utils/cli.js';
import { escapeCssColorVars, unescapeCssColorVars } from '$utils/css.js';
import {
    log,
    prettifyError,
    time,
    timeSince,
    timeToString,
} from '$utils/debug.js';
import { buildDvisvgmInstruction } from '$utils/dvisvgm.js';
import { fs } from '$utils/fs.js';
import { mergeConfigs } from '$utils/merge.js';
import { sha256 } from '$utils/misc.js';

// External dependencies
import { join, relative, resolve, ora, pc, svgoOptimize } from '$deps.js';
import { isString } from '$type-guards/utils.js';
import { InterpretedAttributes } from '$types/utils/Escape.js';

/**
 * A "SvelTeX component" — i.e., a component which can be used in SvelTeX files
 * — whose contents will be rendered using a TeX engine, after which the entire
 * component gets replaced by a Svelte component which imports the rendered SVG.
 *
 * @internal
 */
export class TexComponent<A extends AdvancedTexBackend> {
    /**
     * @param ref - The base filename to use for files associated with this.
     * @param name - The name of the TeX component configuration.
     * @returns An identifier for the component that can be used as a JS
     * identifier (i.e., variable name).
     *
     * @example
     * ```ts
     * TexComponent.id({ name: 'tikz', ref: 'myfig' })
     *     === 'Sveltex_tikz_myfig' // true
     * ```
     *
     * @internal
     */
    static id({ ref, name }: { ref: string; name: string }): string {
        return (
            'Sveltex__' +
            name.replace(/[^\w]/g, '_') +
            `__` +
            ref.replace(/[^\w]/g, '_')
        );
    }

    /**
     * JavaScript identifier for the component.
     *
     * @example
     * 'Sveltex_tikz_myfig'
     *
     * @internal
     */
    get id() {
        return TexComponent.id({
            name: this.name,
            ref: this.ref,
        });
    }

    /**
     * @param tcii - Information about the TeX component whose output we want to
     * import, provided as an object with the `id` of the component and the
     * `path` to the component's `.svelte` output file.
     * @returns A string to import the TeX component output as a Svelte
     * component.
     */
    static importSvg(tcii: TexComponentImportInfo): string {
        return `import ${tcii.id} from '/${relative(process.cwd(), tcii.path)}';`;
    }

    /**
     * @internal
     */
    static svgComponentTag({
        ref,
        name,
    }: {
        ref: string;
        name: string;
    }): `<${string} />` {
        return `<svelte:component this={${TexComponent.id({ ref, name })}} />`;
    }

    /**
     * @internal
     */
    get svgComponentTag() {
        return TexComponent.svgComponentTag({
            ref: this.ref,
            name: this.name,
        });
    }

    /**
     * @internal
     */
    get outputString() {
        return this.configuration.postprocess(this.svgComponentTag, this);
    }

    /**
     * @internal
     */
    name: string;

    /**
     * TeX component config to use to render this component.
     *
     * @internal
     */
    private _configuration: FullTexComponentConfiguration<A>;

    /**
     * ##### SETTER
     *
     * Set the configuration of the component.
     *
     * **Note**: The provided configuration is merged into the component's
     * current configuration, so only the properties that are actually set in
     * the provided configuration object may be changed. Properties of the
     * provided configuration that were set to `null` or `undefined` will also
     * be ignored.
     *
     * @internal
     */
    set configuration(config: TexComponentConfiguration<A>) {
        this._configuration = mergeConfigs(this._configuration, config);
    }

    /**
     * ##### GETTER
     *
     * Returns the configuration of the component.
     *
     * ⚠ **Warning**: The actual configuration object is returned, not a copy,
     * so changes to the object will affect the component.
     *
     * @internal
     */
    get configuration(): FullTexComponentConfiguration<A> {
        return this._configuration;
    }

    /**
     * Getter to access the cache object of the advanced TeX handler which
     * created this component.
     *
     * @internal
     */
    get cache() {
        return this.advancedTexHandler.cache;
    }

    get texLiveConfig(): FullTexLiveConfiguration {
        const parentConfig = this.advancedTexHandler
            .configuration as FullTexLiveConfiguration & { components?: never };
        delete parentConfig.components;

        return mergeConfigs(
            getDefaultAdvancedTexConfiguration(this.advancedTexHandler.backend),
            parentConfig,
            this.configuration.overrides,
        );
    }

    /**
     * Content of the component (interpreted as TeX code which would be given
     * between `\begin{document}` and `\end{document}`). This is *before*
     * escaping CSS variables.
     *
     * @internal
     */
    private texDocumentBodyWithCssVars: string;

    /**
     * The name of the directory to create for files associated with this
     * component.
     *
     * @example 'myfig'
     *
     * @remarks Please provide a string without any extensions (i.e., *not*
     * ending in `.svg`, `.tex`, etc.).
     *
     * @remarks The TexComponent will log an error to the console if the
     * filename includes any path separators (`'/'` or `'\'`), and replace them
     * with `'+'` before using the filename.
     *
     * @example
     * If `this.ref` is `'myfig'` and `this.config.outputDirectory` is
     * `'src/sveltex/tikz'` the rendered TeX file will be saved to
     * `src/sveltex/tikz/myfig.svg`.
     *
     * @readonly
     * @internal
     */
    private _ref: string | undefined;

    /**
     * The reference of the component, which is the base filename to use for
     * files associated with this component.
     *
     * @throws If `this._ref` is not set.
     * @example 'myfig'
     * @internal
     */
    get ref(): string {
        /* v8 ignore next 5 (unreachable code) */
        if (this._ref === undefined || this._ref.length === 0) {
            throw new Error(
                'Tried to access uninitialized "ref" of TeX component.',
            );
        }
        return this._ref;
    }

    /**
     * `\jobname` to use for the `.tex` file. This will also be the base name of
     * the `.pdf` or `.dvi` file produced by the TeX engine.
     *
     * @internal
     */
    readonly jobname = 'root';

    /**
     * @internal
     */
    get source(): {
        /**
         * @example 'node_modules/.cache/sveltex-preprocess/tikz/ref'
         * @internal
         */
        dir: string;
        /**
         * @example 'node_modules/.cache/sveltex-preprocess/tikz/myfig/root.tex'
         * @internal
         */
        texPath: `${string}.tex`;
        /**
         * @example 'root.tex'
         * @internal
         */
        texName: `${string}.tex`;
        /**
         * @example 'node_modules/.cache/sveltex-preprocess/tikz/myfig/root.pdf'
         * @internal
         */
        intPath: `${string}.${'pdf' | 'dvi'}`;
        /**
         * @example 'root.pdf'
         * @internal
         */
        intName: `${string}.${'pdf' | 'dvi'}`;
    } {
        const texLiveConfig = this.texLiveConfig;
        const sourceDir = join(texLiveConfig.cacheDirectory, this.keyPath);
        const texName: `${string}.tex` = `${this.jobname}.tex`;
        const texPath = join(sourceDir, texName) as `${string}.tex`;
        const intName: `${string}.${'pdf' | 'dvi'}` = `${this.jobname}.${texLiveConfig.intermediateFiletype}`;
        const intPath = join(
            sourceDir,
            intName,
        ) as `${string}.${'pdf' | 'dvi'}`;

        return {
            dir: sourceDir,
            texName,
            texPath,
            intName,
            intPath,
        };
    }

    /**
     * Output directory and paths for the rendered SVG and the Svelte component
     * file.
     *
     * @internal
     */
    get out(): {
        /**
         * @example 'src/sveltex/tikz'
         * @internal
         */
        dir: string;
        /**
         * @example 'src/sveltex/tikz/ref.svg'
         * @internal
         */
        svgPath: `${string}.svg`;
        /**
         * @example 'ref.svg'
         * @internal
         */
        svgName: `${string}.svg`;
        /**
         * @example 'src/sveltex/tikz/ref.svelte'
         * @internal
         */
        sveltePath: `${string}.svelte`;
        /**
         * @example 'ref.svelte'
         * @internal
         */
        svelteName: `${string}.svelte`;
    } {
        const outDir = join(this.texLiveConfig.outputDirectory, this.name);
        const svgName: `${string}.svg` = `${this.ref}.svg`;
        const svgPath = join(outDir, svgName) as `${string}.svg`;
        const svelteName: `${string}.svelte` = `${this.ref}.svelte`;
        const sveltePath = join(outDir, svelteName) as `${string}.svelte`;

        return {
            dir: outDir,
            svgName,
            svgPath,
            svelteName,
            sveltePath,
        };
    }

    /**
     * Create a new {@link TexComponent | TeX component} from the given data.
     *
     * @param tag - The HTML tag of the component as matched in the source file
     * before preprocessing.
     * @param attributes - The attributes of the component as matched in the
     * source file before preprocessing.
     * @param tex - The TeX content of the component.
     * @param advancedTexHandler - The advanced TeX handler used by the Sveltex
     * instance parsing the source file containing the TeX component we're
     * trying to create.
     * @returns A new TeX component.
     * @throws If the `attributes` object passed to this method has neither a
     * `ref` attribute nor any valueless attribute.
     * @internal
     */
    static create<A extends AdvancedTexBackend>({
        tag,
        attributes,
        tex,
        advancedTexHandler,
    }: {
        tag: string;
        attributes: Record<
            string,
            string | number | boolean | null | undefined
        >;
        tex: string;
        advancedTexHandler: AdvancedTexHandler<A>;
    }): TexComponent<A> {
        const name = advancedTexHandler.resolveTccAlias(tag);
        const tc = new TexComponent({
            advancedTexHandler,
            name,
            config: advancedTexHandler.tccMap.get(name),
            texDocumentBodyWithCssVars: tex,
        });
        tc._handledAttributes = tc.handleAttributes(attributes);
        return tc;
    }

    /**
     * Handle the attributes that the user provided to the component. This is
     * done in two steps:
     *
     * 1. Extract the `ref` attribute from the attributes object and return the
     *    remaining attributes, excluding valueless attributes.
     * 2. Call the
     *    {@link TexComponentConfiguration.handleAttributes | `handleAttributes`}
     *    method (as determined by the TeX component's
     *    {@link configuration | `configuration`}) on the attributes object
     *    returned by the previous step.
     *
     * @internal
     */
    get handleAttributes() {
        return (
            attributes: Record<
                string,
                string | number | boolean | null | undefined
            >,
        ) =>
            this.configuration.handleAttributes(
                this.extractRefAttribute(attributes),
                this,
            );
    }

    /**
     * Object containing the output of the
     * {@link TexComponentConfiguration.handleAttributes | `handleAttributes`}
     * method. This object is intended to be used by the
     * {@link TexComponentConfiguration.postprocess | `postprocess`} method.
     *
     * @internal
     */
    private _handledAttributes: Record<string, unknown> = {};

    /**
     * Getter for the {@link _handledAttributes | `_handledAttributes`} object.
     *
     * @internal
     */
    get handledAttributes(): Record<string, unknown> {
        return this._handledAttributes;
    }

    /**
     * @internal
     */
    private constructor({
        name,
        config,
        texDocumentBodyWithCssVars,
        advancedTexHandler,
    }: {
        name: string;
        config?: TexComponentConfiguration<A> | undefined;
        texDocumentBodyWithCssVars: string;
        // From parent Sveltex instance
        advancedTexHandler: AdvancedTexHandler<A>;
    }) {
        this.name = name;
        this.advancedTexHandler = advancedTexHandler;
        this._configuration = getDefaultTexComponentConfiguration(
            advancedTexHandler.backend,
        );
        if (config) this.configuration = config;
        this.texDocumentBodyWithCssVars = texDocumentBodyWithCssVars;
    }

    /**
     * "Key path" of the component, which is the path to the component's source
     * files' directory relative to the cache directory.
     *
     * @internal
     */
    get keyPath() {
        return join(this.name, this.ref) as KeyPath;
    }

    /**
     * Advanced TeX handler that created this component.
     */
    private readonly advancedTexHandler: AdvancedTexHandler<A>;

    /**
     * The full content of the `.tex` file corresponding to the component, with
     * any potential CSS color variables not yet escaped.
     *
     * @example
     * ```tex
     * \documentclass{standalone}
     * \usepackage{microtype}
     * \begin{document}
     * \textcolor{var(--red)}{example}
     * \end{document}
     * ```
     *
     * @internal
     */
    get contentWithCssVars(): string {
        return [
            this.configuration.documentClass,
            this.configuration.preamble,
            '\\begin{document}',
            this.texDocumentBodyWithCssVars,
            '\\end{document}\n',
        ].join('\n');
    }

    /**
     * Compile the component's content:
     * 1.  Write the content to a temporary TeX file.
     * 2.  Compile the TeX file using the specified TeX engine.
     * 3.  Convert the resulting PDF to an SVG using the specified conversion
     *     command.
     * 4.  Save the SVG to the specified output directory.
     *
     * @internal
     */
    readonly compile = async (): Promise<number | null> => {
        // 1. Get the escaped TeX content.
        const { escaped: compilableTexContent, cssColorVars } =
            escapeCssColorVars(
                this.contentWithCssVars,
                this.configuration.preamble,
            );

        const texLiveConfig = this.texLiveConfig;

        // Determine if caching is enabled in the configuration
        const caching =
            this.configuration.overrides.caching === true ||
            (texLiveConfig.caching &&
                this.configuration.overrides.caching !== false);

        // Declare `cache` "alias" to `this.cache` for convenience
        const cache = this.cache;

        // Get hash of TeX source
        const texHash = sha256(compilableTexContent);

        // Get cache obect of intermediate file associated with this key-path
        const intCache = cache.data.int[this.keyPath];

        // 2. Check if compilation cache hit
        if (
            // If the cache object exists (i.e., a compilation at this key-path
            // has taken place before)...
            intCache !== undefined &&
            // ...and the hash of the `.tex` source which generated the
            // intermediate file matches the hash of the TeX content that we're
            // trying to compile right now...
            intCache.sourceHash === texHash &&
            // ...and caching is enabled in the configuration...
            caching
        ) {
            // 3(A). ...then we can skip the compilation step. We can also skip
            // the conversion step, because it either succeeded before on the
            // same intermediate file, or failed before (in which case an error
            // was already logged). Hence, we can return early.
            return 0;
        }

        // 3(B). Compile the TeX file using the specified TeX engine.
        try {
            const texFilepath = this.source.texPath;

            // Write the escaped TeX content to a temporary TeX file (creating
            // any missing intermediate directories along the way, if
            // necessary).
            await fs.writeFileEnsureDir(texFilepath, compilableTexContent);

            // Declare convenience alias for `this.compileCmd`
            const compileCmd = this.compileCmd;

            // Start timer
            const startTex = time();

            // Start spinner
            const spinnerTex = ora(`Compiling "${texFilepath}"`).start();

            // Compile the TeX file
            const compilation = await spawnCliInstruction(compileCmd);

            if (compilation.code !== 0) {
                // Stop spinner and replace with "failure message"
                spinnerTex.fail(
                    pc.red(
                        `TeX compilation failed for "${texFilepath}" a ${timeToString(timeSince(startTex))}. See ${texFilepath.replace(/\.tex$/, '.log')} for details.`,
                    ),
                );

                // Get string representation of the compilation command that
                // failed.
                const compileCmdString = `${compileCmd.command} ${compileCmd.args?.join(' ') ?? ''}`;

                // Log error message
                log(
                    { severity: 'error', style: 'dim' },
                    `\nThe compilation was attempted by running the following command from within "${String(compileCmd.cwd ?? process.cwd())}":\n\n${compileCmdString}\n\nThe following stderr was produced:${compilation.stderr.length > 0 ? '\n\n' + compilation.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${compilation.stdout.length > 0 ? '\n\n' + compilation.stdout : pc.italic(' (no stdout output)')}\n`,
                );

                // Return the error code that the compilation child process
                // returned.
                return compilation.code;
            } else {
                // Stop spinner and replace with "success message"
                spinnerTex.succeed(
                    pc.green(
                        `Compiled "${this.keyPath}" in ${timeToString(timeSince(startTex))}`,
                    ),
                );
            }
        } catch (err: unknown) {
            // Catch unexpected errors during compilation and log them.
            log(
                'error',
                `✖ Error while compiling ${this.source.texPath}:\n\n`,
                prettifyError(err),
            );
            // Since the error is unknown, we can't return a more specific error
            // code than 1.
            return 1;
        }

        // Declare variable for hash of intermediate PDF/DVI file
        let intHash;
        try {
            // Compute hash of intermediate PDF/DVI file
            intHash = sha256(
                await fs.readFile(resolve(this.source.intPath), {
                    encoding: 'utf8',
                }),
            );
        } catch (err: unknown) {
            // Log error if reading the intermediate file failed (presumably due
            // to an ENOENT error, i.e., the PDF/DVI file not existing), and
            // return early.
            log(
                'error',
                `✖ Error while reading ${this.source.intPath}:\n\n`,
                prettifyError(err),
            );
            return 2;
        }

        // Cache the hashes of the TeX source and the intermediate PDF/DVI file
        cache.data.int[this.keyPath] = {
            sourceHash: texHash,
            hash: intHash,
        };

        // Convenience alias for the SVG cache object associated with this
        // key-path.
        const svgCache = cache.data.svg[this.keyPath];

        // Check if conversion cache hit
        if (
            // If the cache object exists (i.e., a conversion at this key-path
            // has taken place before)...
            svgCache !== undefined &&
            // ...and the hash of the intermediate PDF/DVI file which was
            // converted to an SVG matches the hash of the intermediate file
            // that we just generated...
            svgCache.sourceHash === intHash &&
            // ...and the key-path at which the intermediate file from which the
            // SVG was generated matches the key-path of the intermediate file
            // that we just generated...
            // svgCache.sourceKeyPath === this.keyPath &&
            // ...and caching is enabled in the configuration...
            caching
        ) {
            // 4(A). ...then we can skip the conversion step and return early;
            // though we still need to update `cache.json` with the new cache
            // object.
            await this.cache.save();
            return 0;
        }

        // 4(B). Convert the resulting PDF/DVI to an SVG using the specified
        // conversion command.
        try {
            // Declare convenience alias for `this.convertCmd`
            const convertCmd = this.convertCmd;

            // Create output directory if it doesn't exist
            await fs.ensureDir(this.out.dir);

            // Start timer
            const startSvg = time();

            // Start spinner
            const spinnerSvg = ora(
                `Converting "${this.source.intName}" to SVG`,
            ).start();

            // Convert the PDF/DVI to an SVG
            const conversion = await spawnCliInstruction(convertCmd);

            if (conversion.code !== 0) {
                // Stop spinner and replace with "failure message"
                spinnerSvg.fail(
                    pc.red(
                        `${texLiveConfig.intermediateFiletype.toUpperCase()} to SVG conversion failed for "${this.source.intPath}" after ${timeToString(timeSince(startSvg))}.`,
                    ),
                );

                // Get string representation of the conversion command that
                // failed.
                const convertCmdString = `${convertCmd.command} ${convertCmd.args?.join(' ') ?? ''}`;

                // Log error message
                log(
                    { severity: 'error', style: 'dim' },
                    `\nThe conversion was attempted by running the following command from within "${String(convertCmd.cwd ?? process.cwd())}":\n\n${convertCmdString}\n\nThe following stderr was produced:${conversion.stderr.length > 0 ? '\n\n' + conversion.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${conversion.stdout.length > 0 ? '\n\n' + conversion.stdout : pc.italic(' (no stdout output)')}\n`,
                );

                // Update `cache.json` with the new cache object
                await this.cache.save();

                // Return the error code that the conversion child process
                // returned.
                return conversion.code;
            }

            //
            const svg = await fs.readFile(this.out.svgPath, 'utf8');

            const unescaped = unescapeCssColorVars(svg, cssColorVars);

            const svgOptimized = texLiveConfig.overrideSvgPostprocess
                ? texLiveConfig.overrideSvgPostprocess(unescaped, this)
                : svgoOptimize(unescaped, texLiveConfig.svgoOptions).data;

            // SVGO (or dvisvgm?) seems to add CDATA tags to the SVG, which in
            // turn seem to cause issues with how the SVG is rendered in the
            // browser. I don't really understand why, since, from what I can
            // gather, the CDATA tag should make perfect sense, and technically
            // make the SVG more robust.
            const svgFinal = svgOptimized.replace(
                /<style>(.*?)<!\[CDATA\[(.*?)\]\]>(.*?)<\/style>/gsu,
                '<style>$1$2$3</style>',
            );

            await fs.writeFile(this.out.svgPath, svgFinal, 'utf8');
            await fs.rename(this.out.svgPath, this.out.sveltePath);

            spinnerSvg.succeed(
                pc.green(
                    `Converted "${this.keyPath}" in ${timeToString(timeSince(startSvg))}`,
                ),
            );

            // Cache the hash of the intermediate PDF/DVI file
            cache.data.svg[this.keyPath] = {
                sourceHash: intHash,
            };

            await this.cache.save();
            await this.cache.cleanup();

            // Return success code
            return 0;
        } catch (err: unknown) {
            log(
                'error',
                `✖ Error converting ${this.source.intPath}:\n\n`,
                prettifyError(err),
            );
            await this.cache.save();
            await this.cache.cleanup();
            return 3;
        }
    };

    /**
     * CLI instruction with which to convert the TeX output PDF/DVI to an SVG.
     *
     * @internal
     */
    get convertCmd(): CliInstruction {
        const texLiveConfig = this.texLiveConfig;
        const overrideInstr = texLiveConfig.overrideConversionCommand;
        const instr = overrideInstr
            ? overrideInstr
            : // If no conversion command is specified, use dvisvgm
              buildDvisvgmInstruction({
                  dvisvgmOptions: texLiveConfig.dvisvgmOptions,
                  inputType: texLiveConfig.intermediateFiletype,
                  outputPath: this.out.svgPath,
                  texPath: this.source.intPath,
              });
        const env = {
            FILEPATH: this.source.intPath,
            FILENAME: this.source.intName,
            FILENAME_BASE: this.jobname,
            FILETYPE: texLiveConfig.intermediateFiletype,
            OUTDIR: this.out.dir,
            OUTFILEPATH: this.out.svgPath,
        };
        instr.env = { ...instr.env, ...env };
        instr.silent = true;
        return instr;
    }

    /**
     * CLI instruction with which to compile the `.tex` file.
     *
     * @internal
     */
    get compileCmd(): CliInstruction {
        const texLiveConfig = this.texLiveConfig;
        const env = {
            FILEPATH: this.source.texPath,
            FILENAME: this.source.texName,
            FILENAME_BASE: this.jobname,
            OUTDIR: this.source.dir,
            OUTFILETYPE: texLiveConfig.intermediateFiletype,
            // SOURCE_DATE_EPOCH is used to ensure reproducibility of the
            // compilation process. In other words, it ensures that the
            // compilation process is deterministic and will produce the same
            // output when given the same input, regardless of the time at which
            // it is run.
            SOURCE_DATE_EPOCH: '1',
        };

        const override = texLiveConfig.overrideCompilationCommand;
        if (override) {
            override.env = { ...override.env, ...env };
            return override;
        }

        const cwd = this.source.dir;
        const args: string[] = [];
        const engine = texLiveConfig.engine;
        const filetype = texLiveConfig.intermediateFiletype;
        const silent = true;

        /**
         * Curiously enough, `lualatex` prefixes flags with `--` , while all the
         * other engines use `-`.
         */
        const pre = engine === 'lualatex' ? '--' : '-';

        // Add the TeX engine command
        const command = texBaseCommand[engine];

        // Add the filetype flag
        switch (engine) {
            case 'lualatex':
            case 'latexmk':
            case 'pdflatex':
                args.push(pre + 'output-format=' + filetype);
                break;
            case 'tex':
                if (filetype === 'pdf') {
                    log('error', 'Plain TeX does not support PDF output.');
                }
                break;
            case 'lualatexmk':
                args.push(filetype === 'pdf' ? '-pdflua' : '-dvilua');
                break;
        }

        // Add --safer resp. -safer flag for lualatex resp. lualatexmk, if
        // saferLua is set to true
        if (
            (engine === 'lualatex' || engine === 'lualatexmk') &&
            texLiveConfig.saferLua
        ) {
            args.push(pre + 'safer');
        }

        // Add shell escape flags
        const shellEscape = texLiveConfig.shellEscape;
        if (shellEscape === 'restricted') {
            args.push(pre + 'shell-restricted');
        } else {
            // if (Array.isArray(shellEscape)) {
            //     args.push(
            //         `${pre}cnf-line="shell_escape_commands=${shellEscape.join(',')}"`,
            //     );
            // }
            args.push(pre + (!shellEscape ? 'no-' : '') + 'shell-escape');
        }

        // Add interaction flag
        args.push(`${pre}interaction=nonstopmode`);

        // args.push(`${pre}silent`);

        // Add the filename
        args.push(`"${this.source.texName}"`);

        return { command, args, env, cwd, silent };
    }

    /**
     * Extract the `ref` attribute from the given attributes object and return
     * the remaining attributes, excluding valueless attributes.
     *
     * @param attributes - Attributes object to extract the `ref` attribute from.
     * @returns The remaining attributes, excluding the `ref` attribute and any
     * valueless attributes.
     * @throws If no `ref` attribute is found in the attributes object.
     * @internal
     */
    private extractRefAttribute(
        attributes: InterpretedAttributes,
    ): Record<string, string> {
        const { ref } = attributes;
        if (!ref || !isString(ref)) {
            throw new Error('TeX component must have a valid ref attribute.');
        }
        this._ref = ref;
        return Object.fromEntries(
            Object.entries(attributes).filter((entry) => entry[0] !== 'ref'),
        ) as Record<string, string>;
    }
}

const texBaseCommand: Record<SupportedTexEngine, string> = {
    lualatex: 'lualatex',
    pdflatex: 'pdflatex',
    tex: 'tex',
    latexmk: 'latexmk',
    // The output format flag will take care of making this actually use
    // lualatex
    lualatexmk: 'latexmk',
};

// /**
//  * Regular expression to check if the `xcolor` package was loaded in a preamble.
//  */
// const xcolorLoadedRegex = re`
//     ^                       # (start of line)
//     \s*                     # (optional whitespace)
//     (?<! ^ .* % .* )        # (negative lookbehind for %)
//     (?:
//         \\usepackage        # (usepackage command)
//         | \\RequirePackage  # (RequirePackage command)
//     )
//     \s*
//     (?:                     # -: optional package options
//         (?<! ^ .* % .* ) \[ # (opening bracket, not preceded by %)
//             \s*             # (optional whitespace)
//             [ \w\W ]*       # (any character, incl. newlines, ≥0 times)
//             \s*             # (optional whitespace)
//         (?<! ^ .* % .* ) \] # (closing bracket, not preceded by %)
//     )?
//     \s*                     # (optional whitespace)
//     \{                      # (opening brace)
//         \s*                 # (optional whitespace)
//         xcolor              # (package name)
//         \s*                 # (optional whitespace)
//     \}                      # (closing brace)

//                             # FLAGS
//     ${'mu'}                 # m = Multiline (^ and $ match start/end of each line)
//                             # u = Unicode support
// `;
