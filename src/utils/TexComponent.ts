// Types
import type { TexHandler } from '$handlers/TexHandler.js';
import type {
    FullTexConfiguration,
    TexComponentImportInfo,
} from '$types/handlers/Tex.js';
import type {
    FullVerbEnvConfigTex,
    VerbEnvConfigTex,
} from '$types/handlers/Verbatim.js';
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type { KeyPath } from '$utils/cache.js';

// Internal dependencies
import {
    getTexPresetDefaults,
    getDefaultVerbEnvConfig,
    sanitizePopplerSvgOptions,
} from '$config/defaults.js';
import { enginePrettyName, texBaseCommand } from '$data/tex.js';
import { isArray, isObject, isString } from '$type-guards/utils.js';
import { InterpretedAttributes } from '$types/utils/Escape.js';
import { spawnCliInstruction } from '$utils/cli.js';
import {
    escapeCssColorVars,
    getHexRegExp,
    unescapeCssColorVars,
} from '$utils/css.js';
import {
    log,
    prettifyError,
    time,
    timeSince,
    timeToString,
} from '$utils/debug.js';
import { insteadGot } from '$utils/diagnosers/Diagnoser.js';
import { buildDvisvgmInstruction } from '$utils/dvisvgm.js';
import { fs, pathExists } from '$utils/fs.js';
import { mergeConfigs } from '$utils/merge.js';
import { sha256 } from '$utils/misc.js';

// External dependencies
import {
    basename,
    dirname,
    flattenObject,
    join,
    ora,
    pc,
    prettyBytes,
    relative,
    stat,
    svgoOptimize,
} from '$deps.js';

/**
 * A "SvelTeX component" — i.e., a component which can be used in SvelTeX files
 * — whose contents will be rendered using a TeX engine, after which the entire
 * component gets replaced by a Svelte component which imports the rendered SVG.
 *
 * @internal
 */
export class TexComponent {
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
            name: this.tag,
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
            name: this.tag,
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
    tag: string;

    /**
     * TeX component config to use to render this component.
     */
    private _configuration: FullVerbEnvConfigTex =
        getDefaultVerbEnvConfig('tex');

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
    set configuration(config: VerbEnvConfigTex) {
        this._configuration = mergeConfigs(this._configuration, config);
        let needsCorrection = false;
        const { compilation: compilation, conversion: conversion } =
            this.texConfig;

        if (
            conversion.converter === 'poppler' &&
            compilation.intermediateFiletype === 'dvi'
        ) {
            log(
                'warn',
                "Poppler does not support conversion of DVI files; setting `intermediateFiletype` to `'pdf'` instead.",
            );
            compilation.intermediateFiletype = 'pdf';
            needsCorrection = true;
        }
        if (needsCorrection) {
            this._configuration = mergeConfigs(this._configuration, {
                overrides: { compilation, conversion },
            });
        }
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
    get configuration(): FullVerbEnvConfigTex {
        return this._configuration;
    }

    /**
     * Getter to access the cache object of the TeX handler which
     * created this component.
     *
     * @internal
     */
    get cache() {
        return this.texHandler.cache;
    }

    get texConfig() {
        return mergeConfigs(
            this.texHandler.configuration,
            this._configuration.overrides,
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
        /* eslint-disable tsdoc/syntax */
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tikz/ref'
         * @internal
         */
        dir: string;
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tikz/myfig/root.tex'
         * @internal
         */
        texPath: `${string}.tex`;
        /**
         * @example 'root.tex'
         * @internal
         */
        texName: `${string}.tex`;
        texExt: 'tex';
        texBaseName: string;
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tikz/myfig/root.pdf'
         * @internal
         */
        intPath: `${string}.${'pdf' | 'dvi' | 'xdv'}`;
        intExt: 'pdf' | 'dvi' | 'xdv';
        /**
         * @example 'root.pdf'
         * @internal
         */
        intName: `${string}.${'pdf' | 'dvi' | 'xdv'}`;
        intBaseName: string;
    } {
        const texConfig = this.texConfig;
        const sourceDir = join(texConfig.caching.cacheDirectory, this.keyPath);
        const { intermediateFiletype, engine } = texConfig.compilation;
        const extenstion: 'pdf' | 'dvi' | 'xdv' =
            intermediateFiletype === 'dvi'
                ? engine === 'xelatex' // ['xelatex', 'xelatexmk'].includes(engine)
                    ? 'xdv'
                    : 'dvi'
                : 'pdf';
        const texBaseName = this.jobname;
        const texName: `${string}.tex` = `${this.jobname}.tex`;
        const texPath = join(sourceDir, texName) as `${string}.tex`;
        const intBaseName = this.jobname;
        const intName: `${string}.${'pdf' | 'dvi' | 'xdv'}` = `${this.jobname}.${extenstion}`;
        const intPath = join(
            sourceDir,
            intName,
        ) as `${string}.${'pdf' | 'dvi' | 'xdv'}`;

        return {
            dir: sourceDir,
            texExt: 'tex',
            texBaseName,
            texName,
            texPath,
            intExt: extenstion,
            intBaseName,
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
         */
        dir: string;
        /**
         * @example 'src/sveltex/tikz/ref.svg'
         */
        svgPath: `${string}.svg`;
        /**
         * @example 'ref.svg'
         */
        svgName: `${string}.svg`;
        /**
         * @example 'ref'
         */
        svgBaseName: string;
        svgExt: 'svg';
        /**
         * @example 'src/sveltex/tikz/ref.svelte'
         */
        sveltePath: `${string}.svelte`;
        /**
         * @example 'ref.svelte'
         */
        svelteName: `${string}.svelte`;
        /**
         * @example 'ref'
         */
        svelteBaseName: string;
        svelteExt: 'svelte';
    } {
        const dir = dirname(this.ref);
        const refBase = basename(this.ref);
        const outDir = join(
            this.texConfig.conversion.outputDirectory,
            this.tag,
            dir,
        );
        const svgBaseName = refBase;
        const svgName: `${string}.svg` = `${refBase}.svg`;
        const svgPath = join(outDir, svgName) as `${string}.svg`;
        const svelteBaseName = refBase;
        const svelteName: `${string}.svelte` = `${refBase}.svelte`;
        const sveltePath = join(outDir, svelteName) as `${string}.svelte`;

        return {
            dir: outDir,
            svgBaseName,
            svgName,
            svgPath,
            svgExt: 'svg',
            svelteBaseName,
            svelteName,
            sveltePath,
            svelteExt: 'svelte',
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
     * @param texHandler - The TeX handler used by the Sveltex
     * instance parsing the source file containing the TeX component we're
     * trying to create.
     * @returns A new TeX component.
     * @throws If the `attributes` object passed to this method has neither a
     * `ref` attribute nor any valueless attribute.
     * @internal
     */
    static create({
        attributes,
        tex,
        texHandler,
        config,
        tag,
    }: {
        attributes: Record<
            string,
            string | number | boolean | null | undefined
        >;
        tex: string;
        texHandler: TexHandler;
        config: VerbEnvConfigTex;
        tag: string;
    }): TexComponent {
        const tc = new TexComponent({
            texHandler,
            config,
            texDocumentBodyWithCssVars: tex,
            tag,
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
     *    {@link VerbEnvConfigTex.handleAttributes | `handleAttributes`}
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
     * {@link VerbEnvConfigTex.handleAttributes | `handleAttributes`}
     * method. This object is intended to be used by the
     * {@link VerbEnvConfigTex.postprocess | `postprocess`} method.
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
        config,
        texDocumentBodyWithCssVars,
        texHandler,
        tag,
    }: {
        config: VerbEnvConfigTex;
        texDocumentBodyWithCssVars: string;
        tag: string;
        // From parent Sveltex instance
        texHandler: TexHandler;
    }) {
        this.texHandler = texHandler;
        this.configuration = config;
        this.texDocumentBodyWithCssVars = texDocumentBodyWithCssVars;
        this.tag = tag;
    }

    /**
     * "Key path" of the component, which is the path to the component's source
     * files' directory relative to the cache directory.
     *
     * @internal
     */
    get keyPath() {
        return join(this.tag, this.ref) as KeyPath;
    }

    /**
     * Advanced TeX handler that created this component.
     */
    private readonly texHandler: TexHandler;

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
            this.documentClass,
            this.preamble,
            '\\begin{document}',
            this.texDocumentBodyWithCssVars,
            '\\end{document}\n',
        ].join('\n');
    }

    get documentClass(): string {
        const texConfig = this.texConfig;
        const documentClass = this.configuration.documentClass;
        const propIsString = isString(documentClass);
        const name: string = propIsString
            ? documentClass
            : documentClass.name ?? 'standalone';
        const options: string[] = propIsString
            ? []
            : documentClass.options ?? [];
        if (
            texConfig.compilation.intermediateFiletype === 'dvi' &&
            !options.includes('dvisvgm')
        ) {
            options.unshift('dvisvgm');
        }
        if (options.length === 0) return `\\documentclass{${name}}`;
        return `\\documentclass[${options.join(',')}]{${name}}`;
    }

    get preamble(): string {
        return extendedPreamble(this.configuration, this.texConfig);
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
            escapeCssColorVars(this.contentWithCssVars, this.preamble);

        const texConfig = this.texConfig;

        // Compilation options
        const { engine, intermediateFiletype } = texConfig.compilation;

        // Conversion options
        const {
            overrideConversion: overrideConversion,
            converter: conversionLibrary,
            poppler: poppler,
        } = texConfig.conversion;

        // Optimization options
        const {
            svgo: svgo,
            currentColor,
            overrideOptimization,
        } = texConfig.optimization;

        // Derived variables
        const format =
            conversionLibrary === 'poppler' ? 'pdf' : intermediateFiletype;
        const formatPretty = format.toUpperCase();
        const enginePretty = enginePrettyName[engine];
        const converter = overrideConversion
            ? `custom converter`
            : conversionLibrary;

        // Paths
        const { texPath, intPath } = this.source;
        const { svgPath, sveltePath, dir: outDir } = this.out;
        const keyPath = this.keyPath;

        // Determine if caching is enabled in the configuration
        const caching = texConfig.caching.enabled;

        // Declare `cache` "alias" to `this.cache` for convenience
        const cache = this.cache;

        // Get hash of TeX source
        const texHash = sha256(compilableTexContent);

        // Declare variable for hash of intermediate DVI/PDF/XDV file (assigned
        // after compilation)
        let intHash;

        // Get cache obect of intermediate file associated with this key-path
        const intCache = cache.data.int[keyPath];

        // Check if files exist; if
        const intFileExists = pathExists(intPath);
        const svelteFileExists = pathExists(sveltePath);

        const debugInfo = [
            '',
            `    Engine: ${enginePretty}`,
            `    Converter: ${converter}`,
            `    - TeX: ${texPath}`,
            `    ? ${formatPretty}: ${intPath}`,
            `    ? SVG: ${svgPath}`,
            `    ? Svelte: ${sveltePath}`,
        ].join('\n');

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
            caching &&
            // ...and the intermediary and final files already exist...
            intFileExists &&
            svelteFileExists
        ) {
            // 3(A). ...then we can skip the compilation step. We can also skip
            // the conversion step, because it either succeeded before on the
            // same intermediate file, or failed before (in which case an error
            // was already logged). Hence, we can return early.
            return 0;
        }

        // Start timer
        const startTex = time();

        // Start spinner
        const spinnerTex = ora(`Compiling "${texPath}"`).start();

        // 3(B). Compile the TeX file using the specified TeX engine.
        try {
            // Write the escaped TeX content to a temporary TeX file (creating
            // any missing intermediate directories along the way, if
            // necessary).
            await fs.writeFileEnsureDir(texPath, compilableTexContent);

            // Declare convenience alias for `this.compileCmd`
            const compileCmd = this.compileCmd;

            // Compile the TeX file
            const compilation = await spawnCliInstruction(compileCmd);

            if (compilation.code !== 0) {
                // Stop spinner and replace with "failure message"
                spinnerTex.fail(
                    pc.red(
                        `${keyPath}: TeX → ${formatPretty} with ${enginePretty} failed after ${timeToString(timeSince(startTex))}`,
                    ),
                );

                // Get string representation of the compilation command that
                // failed.
                const compileCmdString =
                    compileCmd.command +
                    ' ' +
                    (compileCmd.args?.join(' ') ?? '');

                // Log error message
                log(
                    { severity: 'error', style: 'dim' },
                    `\nThe compilation was attempted by running the following command from within "${String(compileCmd.cwd ?? process.cwd())}":\n\n${compileCmdString}\n\nThe following stderr was produced:${compilation.stderr.length > 0 ? '\n\n' + compilation.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${compilation.stdout.length > 0 ? '\n\n' + compilation.stdout : pc.italic(' (no stdout output)')}\n`,
                );

                // Return the error code that the compilation child process
                // returned.
                return compilation.code;
            } else {
                const { size } = await stat(intPath);

                intHash = sha256(
                    await fs.readFile(intPath, { encoding: 'utf8' }),
                );

                // Stop spinner and replace with "success message"
                spinnerTex.succeed(
                    pc.green(
                        `${keyPath}: TeX → ${formatPretty} (${prettyBytes(size)}) with ${enginePretty} in ${timeToString(timeSince(startTex))}`,
                    ),
                );
            }
        } catch (err: unknown) {
            // Stop spinner and replace with "failure message"
            spinnerTex.fail(
                pc.red(
                    `${keyPath}: TeX → ${formatPretty} with ${enginePretty} failed after ${timeToString(timeSince(startTex))}` +
                        debugInfo,
                ),
            );

            // Catch unexpected errors during compilation and log them.
            log(
                'error',
                `✖ Error while compiling ${texPath}:\n\n`,
                prettifyError(err),
            );
            // Since the error is unknown, we can't return a more specific error
            // code than 1.
            return 1;
        }

        // Cache the hashes of the TeX source and the intermediate DVI/PDF/XDV
        // file.
        cache.data.int[keyPath] = {
            sourceHash: texHash,
            hash: intHash,
        };

        // Convenience alias for the SVG cache object associated with this
        // key-path.
        const svgCache = cache.data.svg[keyPath];

        // Check if conversion cache hit
        if (
            // If the cache object exists (i.e., a conversion at this key-path
            // has taken place before)...
            svgCache !== undefined &&
            // ...and the hash of the intermediate DVI/PDF/XDV file which was
            // converted to an SVG matches the hash of the intermediate file
            // that we just generated...
            svgCache.sourceHash === intHash &&
            // ...and the key-path at which the intermediate file from which the
            // SVG was generated matches the key-path of the intermediate file
            // that we just generated...
            // svgCache.sourceKeyPath === keyPath &&
            // ...and caching is enabled in the configuration...
            caching &&
            // ...and the final .svelte file already exists...
            svelteFileExists
        ) {
            // 4(A). ...then we can skip the conversion step and return early;
            // though we still need to update `cache.json` with the new cache
            // object.
            await this.cache.save();
            return 0;
        }

        let svg: string | undefined = undefined;

        // Start timer
        const startSvg = time();

        // Start spinner
        const spinnerSvg = ora(`${keyPath}: ${formatPretty} → SVG`).start();

        // 4(B). Convert the resulting DVI/PDF/XDV to an SVG using the specified
        // conversion command.
        try {
            // Create output directory if it doesn't exist
            await fs.ensureDir(outDir);

            let conversion: {
                code: number | null;
                stderr: string;
                stdout: string;
            };
            let errorMessage: string | undefined = undefined;

            if (conversionLibrary === 'poppler' && !overrideConversion) {
                let stdout = '';
                let code = 0;
                try {
                    if (this.texHandler.poppler === undefined) {
                        const Poppler = (await import('node-poppler')).Poppler;
                        this.texHandler.poppler = new Poppler();
                    }
                    stdout = await this.texHandler.poppler.pdfToCairo(
                        intPath,
                        svgPath,
                        sanitizePopplerSvgOptions(poppler),
                    );
                } catch (err) {
                    code = 1;
                    errorMessage = prettifyError(err);
                }
                conversion = { code, stdout, stderr: '' };
            } else {
                // Declare convenience alias for `this.convertCmd`
                const convertCmd = this.convertCmd;

                // Convert the DVI/PDF/XDV to an SVG
                conversion = await spawnCliInstruction(convertCmd);

                if (conversion.code !== 0) {
                    // Get string representation of the conversion command that
                    // failed.
                    const convertCmdString = `${convertCmd.command}${convertCmd.args ? ' ' + convertCmd.args.join(' ') : ''}`;

                    // Set error message
                    errorMessage = `\nThe conversion was attempted by running the following command from within "${String(convertCmd.cwd ?? process.cwd())}":\n\n${convertCmdString}\n\nThe following stderr was produced:${conversion.stderr.length > 0 ? '\n\n' + conversion.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${conversion.stdout.length > 0 ? '\n\n' + conversion.stdout : pc.italic(' (no stdout output)')}\n`;
                }
            }

            if (conversion.code !== 0) {
                // Stop spinner and replace with "failure message"
                spinnerSvg.fail(
                    pc.red(
                        `${keyPath}: ` +
                            format.toUpperCase() +
                            ` → SVG with ` +
                            converter +
                            ` failed after ` +
                            timeToString(timeSince(startSvg)) +
                            `\n${debugInfo}`,
                    ),
                );

                // Log error message
                log({ severity: 'error', style: 'dim' }, errorMessage);

                // Update `cache.json` with the new cache object
                await this.cache.save();

                // Return the error code that the conversion child process
                // returned.
                return conversion.code;
            }

            const { size } = await stat(svgPath);

            //
            svg = await fs.readFile(svgPath, 'utf8');

            if (svg === '') {
                throw new Error(
                    `Conversion of ${intPath} to SVG failed: Empty SVG file found at ${svgPath}.`,
                );
            }

            spinnerSvg.succeed(
                pc.green(
                    `${keyPath}: ${formatPretty} → SVG (${prettyBytes(size)}) with ${converter} in ${timeToString(timeSince(startSvg))}`,
                ),
            );
        } catch (err: unknown) {
            spinnerSvg.fail(
                pc.red(
                    `${keyPath}: ${formatPretty} → SVG failed after ${timeToString(timeSince(startSvg))}` +
                        debugInfo,
                ),
            );
            log(
                'error',
                `✖ Error converting ${intPath}:\n\n`,
                prettifyError(err),
            );
            await this.cache.save();
            await this.cache.cleanup();
            return 2;
        }

        // Start timer
        const startOpt = time();

        // Start spinner
        const spinnerOpt = ora(`${keyPath}: SVG → Svelte`).start();

        // SVG → Svelte
        try {
            let unescaped = unescapeCssColorVars(svg, cssColorVars);

            if (currentColor) {
                if (conversionLibrary === 'poppler') {
                    unescaped = unescaped.replace(
                        '<svg',
                        '<svg fill="currentColor"',
                    );
                }
                const regExp = getHexRegExp(currentColor);
                if (regExp) {
                    unescaped = unescaped.replaceAll(regExp, 'currentColor');
                }
            }

            const svgOptimized = overrideOptimization
                ? overrideOptimization(unescaped, this)
                : svgoOptimize(unescaped, svgo).data;

            // SVGO (or dvisvgm?) seems to add CDATA tags to the SVG, which in
            // turn seem to cause issues with how the SVG is rendered in the
            // browser. I don't really understand why, since, from what I can
            // gather, the CDATA tag should make perfect sense, and technically
            // make the SVG more robust.
            const svgFinal = svgOptimized.replace(
                /<style>(.*?)<!\[CDATA\[(.*?)\]\]>(.*?)<\/style>/gsu,
                '<style>$1$2$3</style>',
            );

            await fs.writeFile(svgPath, svgFinal, 'utf8');
            await fs.rename(svgPath, sveltePath);

            const { size } = await stat(sveltePath);

            // Cache the hash of the intermediate DVI/PDF/XDV file
            cache.data.svg[keyPath] = { sourceHash: intHash };

            await this.cache.save();
            await this.cache.cleanup();

            spinnerOpt.succeed(
                pc.green(
                    `${keyPath}: SVG → Svelte (${prettyBytes(size)}) with ${overrideOptimization ? 'custom optimizer' : 'SVGO'} in ${timeToString(timeSince(startOpt))}`,
                ),
            );

            // Return success code
            return 0;
        } catch (err) {
            spinnerOpt.fail(
                pc.red(
                    `${keyPath}: SVG → Svelte failed after ${timeToString(timeSince(startOpt))}` +
                        debugInfo,
                ),
            );
            log(
                'error',
                `✖ Error optimizing ${svgPath}:\n\n`,
                prettifyError(err),
            );
            await this.cache.save();
            await this.cache.cleanup();
            return 3;
        }
    };

    /**
     * CLI instruction with which to convert the TeX output DVI/PDF/XDV to an SVG.
     *
     * @internal
     */
    get convertCmd(): CliInstruction {
        const texConfig = this.texConfig;
        const { overrideConversion: overrideConversion } = texConfig.conversion;
        const { svgExt, svgBaseName, svgName, svgPath, dir: svgDir } = this.out;
        const {
            intExt,
            intBaseName,
            intName,
            intPath,
            dir: intDir,
        } = this.source;
        const instr = overrideConversion
            ? overrideConversion({
                  input: {
                      dir: intDir,
                      path: intPath,
                      name: intName,
                      basename: intBaseName,
                      ext: intExt,
                  },
                  output: {
                      dir: svgDir,
                      path: svgPath,
                      name: svgName,
                      basename: svgBaseName,
                      ext: svgExt,
                  },
              })
            : // If no conversion command is specified, use dvisvgm
              buildDvisvgmInstruction({
                  dvisvgm: texConfig.conversion.dvisvgm,
                  inputType: texConfig.compilation.intermediateFiletype,
                  outputPath: svgPath,
                  texPath: intPath,
              });
        instr.silent = true;
        return instr;
    }

    /**
     * CLI instruction with which to compile the `.tex` file.
     */
    get compileCmd(): CliInstruction {
        const texConfig = this.texConfig;
        const {
            engine,
            intermediateFiletype,
            saferLua,
            shellEscape,
            overrideCompilation: overrideCompilation,
        } = texConfig.compilation;

        const env = {
            // SOURCE_DATE_EPOCH is used to ensure reproducibility of the
            // compilation process (with PDFs). In other words, it ensures that
            // the compilation process is deterministic and will produce the
            // same output when given the same input, regardless of the time at
            // which it is run. This helps with caching.
            SOURCE_DATE_EPOCH: '1',
        };

        if (overrideCompilation) {
            const {
                dir,
                intBaseName,
                intExt,
                intName,
                intPath,
                texBaseName,
                texExt,
                texName,
                texPath,
            } = this.source;
            const instr = overrideCompilation({
                input: {
                    dir,
                    path: texPath,
                    name: texName,
                    basename: texBaseName,
                    ext: texExt,
                },
                output: {
                    dir,
                    path: intPath,
                    name: intName,
                    basename: intBaseName,
                    ext: intExt,
                },
            });
            return instr;
        }

        const cwd = this.source.dir;
        const args: string[] = [];
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
            case 'pdflatexmk':
            case 'pdflatex':
                args.push(pre + 'output-format=' + intermediateFiletype);
                break;
            case 'xelatex':
                if (intermediateFiletype === 'dvi') args.push('-no-pdf');
                break;
            case 'lualatexmk':
                args.push(
                    intermediateFiletype === 'pdf' ? '-pdflua' : '-dvilua',
                );
                break;
            // Interestingly enough, I suspect there may be a bug in LaTeXmk,
            // because the below code would not work as expected.
            // case 'xelatexmk':
            //     args.push(intermediateFiletype === 'dvi' ? '-xdv' : '-pdfxe');
        }

        if (intermediateFiletype === 'dvi') {
            // Make compilation to DVI somewhat more deterministic (by default,
            // the output-comment would be the current date (and time? I don't
            // know)).
            args.push(pre + 'output-comment=""');
        }

        // Add --safer resp. -safer flag for lualatex resp. lualatexmk, if
        // saferLua is set to true
        if ((engine === 'lualatex' || engine === 'lualatexmk') && saferLua) {
            args.push(pre + 'safer');
        }

        // Add shell escape flags
        if (shellEscape === 'restricted') {
            args.push(pre + 'shell-restricted');
        } else {
            args.push(pre + (!shellEscape ? 'no-' : '') + 'shell-escape');

            // The commented-out code below was my attempt at implementing the
            // option to pass an allowlist of commands to `shellEscape`, but I
            // couldn't get it to work. I'm leaving it here for now, in case I
            // want to revisit it later.

            // (Array.isArray(shellEscape)) { args.push(
            // `${pre}cnf-line="shell_escape_commands=${shellEscape.join(',')}"`,
            //     );
            // }
        }

        // Add interaction flag. The modes make TeX behave in the following way:
        //
        // - `errorstopmode` stops on all errors, whether they are about errors
        //   in the source code or non-existent files.
        // - `scrollmode` doesn't stop on errors in the source but requests
        //   input when a more serious error like like a missing file occurs.
        // - In the somewhat misnamed `nonstopmode`, TeX does not request input
        //   after serious errors but stops altogether.
        // - `batchmode` prevents all output in addition to that (intended for
        //   use in automated scripts). In all cases, all errors are written to
        //   the log file (`yourtexfile.log`).
        //
        // Source: https://www.volkerschatz.com/tex/ttips.html, via
        // https://tex.stackexchange.com/a/13330/170958
        //
        // It wouldn't make sense for Sveltex to offer the option to change the
        // interaction mode, because it would be impossible for the user to
        // interact with the compiler anyway, given that it's running in a
        // separate child process. Accordingly, it is "hard-coded" to
        // `batchmode`.
        args.push(`${pre}interaction=batchmode`);

        // args.push(`${pre}silent`);

        // Add the filename. It's important that this be the last argument,
        // simply because of the format in which the LaTeX commands expect their
        // CLI input to be provided.
        args.push(this.source.texName);

        return { command, args, env, cwd, silent };
    }

    /**
     * Extract the `ref` attribute from the given attributes object and return
     * the remaining attributes.
     *
     * @param attributes - Attributes object to extract the `ref` attribute from.
     * @returns The remaining attributes, excluding the `ref` attribute.
     * @throws If no `ref` attribute is found in the attributes object.
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

export function extendedPreamble(
    verbEnvConfig: FullVerbEnvConfigTex,
    texConfig: FullTexConfiguration,
) {
    const preamble = verbEnvConfig.preamble;
    const { packages, gdlibraries, tikzlibraries } = enactPresets(
        verbEnvConfig,
        texConfig,
    );
    packages.unshift('xcolor');
    const usepackage = [
        '\\makeatletter',
        ...packages.map(
            (pkg) => `\\@ifpackageloaded{${pkg}}{}{\\usepackage{${pkg}}}`,
        ),
        '\\makeatother',
    ].join('\n');
    const usetikzlibrary =
        tikzlibraries.length > 0
            ? '\\usetikzlibrary{' + tikzlibraries.join(',') + '}'
            : '';
    const usegdlibrary =
        gdlibraries.length > 0
            ? '\\usegdlibrary{' + gdlibraries.join(',') + '}'
            : '';
    return [
        preamble,
        usepackage,
        usetikzlibrary,
        usegdlibrary,
        // backendConfig,
    ].join('\n');
}

function extractTrueKeys(obj: object) {
    return Object.entries(obj)
        .filter(([, value]) => value === true)
        .map(([key]) => key);
}

export function enactPresets(
    verbEnvConfig: FullVerbEnvConfigTex,
    texConfig: FullTexConfiguration,
) {
    const presets = isArray(verbEnvConfig.preset)
        ? verbEnvConfig.preset
        : [verbEnvConfig.preset];
    // Currently, only tikz presets are supported. Last one takes precedence.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const preset = presets.findLast((p) => p.name === 'tikz');
    if (!preset) return { tikzlibraries: [], gdlibraries: [], packages: [] };
    const tikzlibraries = [];
    const gdlibraries = [];
    const packages = ['tikz'];
    const merged = mergeConfigs(
        getTexPresetDefaults('tikz').libraries,
        preset.libraries,
    );
    const { graphdrawing, ...tikzLibrariesObj } = merged;
    if (graphdrawing !== undefined && graphdrawing !== false) {
        if (['lualatex', 'lualatexmk'].includes(texConfig.compilation.engine)) {
            tikzlibraries.push('graphdrawing');
            if (isObject(graphdrawing)) {
                gdlibraries.push(...extractTrueKeys(graphdrawing));
            }
        } else {
            log(
                'error',
                `Graph drawing libraries require "compilation.engine" to be "lualatex" or "lualatexmk". ${insteadGot(texConfig.compilation.engine, 'string')} Ignoring graph drawing libraries.`,
            );
        }
    }
    tikzlibraries.push(...extractTrueKeys(flattenObject(tikzLibrariesObj)));
    if (tikzlibraries.includes('fixedpointarithmetic')) packages.push('fp');
    return { tikzlibraries, gdlibraries, packages };
}
