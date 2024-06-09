/* eslint-disable tsdoc/syntax */
// Types
import type { SvgoOptions } from '$deps.js';
import type { TexHandler } from '$handlers/TexHandler.js';
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type { ConfigureFn, ProcessFn } from '$types/handlers/Handler.js';
import type {
    FullVerbEnvConfigTex,
    VerbatimProcessOptions,
} from '$types/handlers/Verbatim.js';
import type {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    CliInstruction,
    CompilationCliInstruction,
    ConversionCliInstruction,
} from '$types/utils/CliInstruction.js';
import type { DvisvgmOptions } from '$types/utils/DvisvgmOptions.js';
import type { PopplerSvgOptions } from '$types/utils/PopplerOptions.js';
import type {
    DeepRequiredNotUndefined,
    FirstTwoLevelsRequiredNotUndefined,
} from '$types/utils/utility-types.js';
import type { TexComponent } from '$utils/TexComponent.js';

// For IntelliSense
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { DvisvgmSvgOutputOptions } from '$types/utils/DvisvgmOptions.js';
import type { TexLogSeverity } from '$data/tex.js';
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Supported TeX backends.
 */
export type TexBackend = 'local';

export type Converter = 'dvisvgm' | 'poppler';

export interface ConversionOptions {
    /**
     * Library to use to convert PDF or DVI files to SVG.
     *
     * - `'dvisvgm'`: Performant and feature-rich converter, bundled with TeX
     *   live. Produces high-quality, highly optimized SVGs.
     * - `'poppler'` (PDF only): Robust library which relies on
     *   [Cairo](https://www.cairographics.org) for its PDF to SVG conversion.
     *   Sveltex interacts with it via the
     *   [`node-poppler`](https://www.npmjs.com/package/node-poppler) package.
     *   Poppler produces high-quality — if sometimes rather large — SVGs.
     *
     * @defaultValue
     * ```ts
     * 'dvisvgm'
     * ```
     *
     * @remarks
     * ⚠ **Warning**: For the `'poppler'` option to work, you should install the
     * [`node-poppler`](https://www.npmjs.com/package/node-poppler) package,
     * which isn't a regular dependency of Sveltex (it's a peer dependency
     * instead, given its large size and the fact that Sveltex won't use it by
     * default). Depending on your package manager, you can do this with one
     * of the following commands:
     * ```sh
     *     pnpm add -D node-poppler # if using PNPM
     *     bun add -D node-poppler # if using Bun
     *     npm add -D node-popple # if using NPM
     *     yarn add -D node-poppler # if using Yarn
     * ```
     * Furthermore, depending on your operating system, you may need to
     * install some additional dependencies:
     * - Linux: Install
     *   [`poppler-utils`](https://packages.ubuntu.com/noble/poppler-utils) and
     *   [`poppler-data`](https://packages.ubuntu.com/noble/poppler-data):
     *   ```sh
     *       sudo apt-get install -y poppler-data
     *       sudo apt-get install -y poppler-utils
     *   ```
     * - macOS: Install the
     *   [`poppler`](https://formulae.brew.sh/formula/poppler) formula from
     *   [Homebrew](https://brew.sh):
     *   ```sh
     *       brew install poppler
     *   ```
     * - Windows: Binaries are already included with `node-poppler`, so no
     *   additional steps are needed.
     *
     * ---
     *
     * #### LINKS
     *
     * `dvisvgm`:
     * - Website: https://dvisvgm.de/
     *   - Manual page ("manpage"): https://dvisvgm.de/Manpage
     * - Repository: https://github.com/mgieseki/dvisvgm
     *
     * Poppler & related:
     * - `node-poppler` on NPM: https://www.npmjs.com/package/node-poppler
     * - `node-poppler` repository: https://github.com/Fdawgs/node-poppler
     * - Poppler website: https://poppler.freedesktop.org
     * - Poppler repository: https://gitlab.freedesktop.org/poppler/poppler
     * - Cairo website: https://www.cairographics.org
     */
    converter?: Converter | undefined;

    /**
     * Options to pass to `dvisvgm` when converting PDF or DVI files to SVG.
     *
     * The documentation of the options herein are adapted from the official
     * dvisvgm [manpage](https://dvisvgm.de/Manpage/).
     *
     * @remarks
     * Setting any given option to `null` defers its assignment to `dvisvgm`,
     * meaning that `dvisvgm`'s default value for the option will be used.
     * Meanwhile, setting an option to `undefined` will set it to Sveltex's
     * default value for the option, as specified in the `@defaultValue` TSDoc
     * tag for the option. Note that Sveltex's default value will often be
     * `null` itself, in which case setting the option to `undefined` will have
     * the same effect as setting it to `null`. Sveltex's default value may also
     * sometimes coincide with `dvisvgm`'s default value for the option, even if
     * Sveltex's default value isn't `null`.
     *
     * @remarks
     * These options will only have an effect if the `converter` property is set
     * to `'dvisvgm'`.
     *
     * @see https://dvisvgm.de/Manpage/
     * @see https://github.com/mgieseki/dvisvgm
     */
    dvisvgm?: DvisvgmOptions | undefined;

    /**
     * Options to pass to `poppler` when converting PDF or DVI files to SVG.
     *
     * @remarks
     * Setting any given option to `null` defers its assignment to
     * [`node-poppler`](https://www.npmjs.com/package/node-poppler), meaning
     * that the external library's default value for the option will be used.
     * Meanwhile, setting an option to `undefined` will set it to Sveltex's
     * default value for the option, as specified in the `@defaultValue` TSDoc
     * tag for the option. Note that Sveltex's default value will often be
     * `null` itself, in which case setting the option to `undefined` will have
     * the same effect as setting it to `null`. Sveltex's default value may also
     * sometimes coincide with `node-popler`'s default value for the option,
     * even if Sveltex's default value isn't `null`.
     *
     * @remarks
     * These options will only have an effect if the `converter` property is set
     * to `'poppler'`.
     *
     * @see https://www.npmjs.com/package/node-poppler
     */
    poppler?: PopplerSvgOptions | undefined;

    /**
     * Output directory. This is where the generated SVG files will be placed,
     * in the form of Svelte components. The first part of the path should be
     * `src`, or at least a directory from which Svelte components can be
     * imported via `import Example from 'outputDirectory/example.svelte'`.
     *
     * @defaultValue `'src/sveltex'`
     *
     * @remarks
     * Each SVG component will be written to
     * `${outputDirectory}/${name}/${ref}.svelte`, where:
     *
     * - `outputDirectory`: the value of this property.
     * - `name` is the name of the component, usually the same as the HTML tag
     *   used for the component. In particular, this does not refer to the name
     *   of any one given instance of the component, but rather the name of a
     *   given *class* of TeX components.
     * - `ref` is the (mandatory) `ref` attribute of the component.
     */
    outputDirectory?: string | undefined;

    /**
     * Override the PDF/DVI to SVG conversion command for this component.
     *
     * @defaultValue `null`
     *
     * @remarks
     * ⚠ **Warning**: Make sure that the command generates an SVG file at
     * `opts.output.path`.
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if
     * `overrideConversion` is set:
     * - {@link dvisvgm | `dvisvgm`}
     * - {@link poppler | `poppler`}
     * - {@link converter | `converter`}
     *
     * ---
     * #### FUNCTION PARAMETERS
     *
     * @param opts - An object describing the location of the PDF/DVI file and the
     * location at which the output file should be placed.
     * @returns A {@link CliInstruction | `CliInstruction`} object that will be
     * used to convert the PDF/DVI file to SVG.
     */
    overrideConversion?: ConversionCliInstruction | null | undefined;
}

export interface CompilationOptions {
    /**
     * TeX engine to use to render TeX code. Possible values,
     * alongside with the commands they use to compile the TeX code (depending
     * on {@link intermediateFiletype | `intermediateFiletype`}):
     *
     * - `'pdflatexmk'`: Uses [LaTeXmk](https://ctan.org/pkg/latexmk), a Perl
     *   script which aims to simplify the compilation of complex LaTeX files
     *   which would usually require multiple compilation steps by determining
     *   the necessary steps and number of compilations, and performing them
     *   automatically.
     *   - `latexmk -dvi` to output DVI using pdfLaTeX.
     *   - `latexmk -pdf` to output PDF using pdfLaTeX.
     * - `'lualatex'`: Uses LuaLaTeX,
     *   - `lualatex --output-format=dvi` to output DVI.
     *   - `lualatex --output-format=pdf` to output PDF.
     * - `'lualatexmk'`: Uses LaTeXmk.
     *   - `latexmk -dvilua` to output DVI using LuaLaTeX.
     *   - `latexmk -pdflua` to output PDF using LuaLaTeX.
     * - `'pdflatex'`: Uses pdfLaTeX.
     *   - `pdflatex -output-format=dvi` to output DVI.
     *   - `pdflatex -output-format=pdf` to output PDF.
     * - `'xelatex'`: Uses XeLaTeX.
     *   - `xelatex -no-pdf` to output XDV.
     *   - `xelatex` to output PDF.
     *
     * @defaultValue
     * ```ts
     * 'pdflatex'
     * ```
     *
     * @remarks
     * Despite its name, `pdflatex` can indeed also output DVI files.
     *
     * @remarks
     * Why is `pdflatex` the default? — Speed. LuaLaTeX was significantly slower
     * in my testing, LaTeXmk was marginally slower (but the working assumption
     * is that the LaTeX files Sveltex will be dealing with will usually be
     * simple enough to be compiled in a single step, limiting the benefit of
     * LaTeXmk), and XeTeX was also marginally slower and is less wide-spread.
     *
     * **Disclaimer**: my testing was very limited; in particular, I tested the
     * different compilation commands on just four different TeX files, each of
     * which were single-page documents (this is because single-page documents
     * is the main use-case for Sveltex).
     */
    engine?: SupportedTexEngine | undefined;

    /**
     * Intermediate filetype to use when compiling the TeX block. Possible
     * values:
     *
     * - [`'dvi'`](https://texfaq.org/FAQ-dvi) (strongly recommended): The DVI
     *   (device independent file format) is TeX's original output format, and
     *   presents many advantages over PDF for the purposes of SVG conversion.
     * - `'pdf'`: If for some reason you need to use PDF as the intermediate
     *   filetype, you can set this property to `'pdf'`, which dvisvgm or
     *   Poppler can then convert to an SVG.
     *
     * @defaultValue
     * ```ts
     * 'dvi'
     * ```
     *
     * @remarks This option is only relevant when
     * {@link ConversionOptions.converter | `conversion.converter`} is set to
     * `'dvisvgm'`, as Poppler doesn't support DVI/XDV files.
     *
     * @remarks
     * If {@link engine | `engine`} is set to `'xelatex'`, then setting this
     * property to `'dvi'` will result in the generation of XDV (extended DVI)
     * files instead of DVI files.
     *
     * @remarks
     * Not all TeX engines and conversion libraries support all intermediate
     * filetypes. All of the supported engines support PDF and DVI, or, in the
     * case of XeTeX-based engines, PDF and XDV. The conversion library dvisvgm
     * can handle PDF, DVI, and XDV, while Poppler can only handle PDF of these
     * formats. In a table:
     *
     * | TeX Engine   |  `dvisvgm`  | `poppler` |
     * |:-------------|:-----------:|:---------:|
     * | `latexmk`    | `dvi`/`pdf` |   `pdf`   |
     * | `lualatex`   | `dvi`/`pdf` |   `pdf`   |
     * | `lualatexmk` | `dvi`/`pdf` |   `pdf`   |
     * | `pdflatex`   | `dvi`/`pdf` |   `pdf`   |
     * | `xelatex`    | `xdv`/`pdf` |   `pdf`   |
     *
     * When using `dvisvgm`, it is almost always better to use `'dvi'` as the
     * intermediate filetype, since this is where `dvisvgm` really shines: it
     * will produce much more optimized SVGs from DVI/XDV files than from PDF
     * files, and has more features available when converting DVI/XDV files.
     */
    intermediateFiletype?: 'pdf' | 'dvi' | undefined;

    /**
     * Override the compilation command for this component.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     *
     * @remarks
     * ⚠ **Warning**: Make sure that the command either generates a DVI/XDV (if
     * {@link intermediateFiletype | `intermediateFiletype`} is `'dvi'`) or PDF
     * (if {@link intermediateFiletype | `intermediateFiletype`} is `'pdf'`)
     * file at `opts.output.path`.
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if this property
     * is set:
     * - {@link engine | `engine`}.
     * - {@link shellEscape | `shellEscape`}.
     * - {@link saferLua | `saferLua`}.
     *
     * **Note**: The {@link intermediateFiletype | `intermediateFiletype`}
     * property will still be relevant, as it will help Sveltex determine how to
     * convert the intermediate file to SVG. In particular, you should make sure
     * that the command you set here generates a file of the type specified by
     * the `intermediateFiletype` property.
     *
     * ---
     * #### FUNCTION PARAMETERS
     *
     * @param opts - An object describing the location of the TeX code and the
     * location at which the output file should be placed.
     * @returns A {@link CliInstruction | `CliInstruction`} object that will be
     * used to compile the TeX code.
     */
    overrideCompilation?: CompilationCliInstruction | null | undefined;

    /**
     * If `true`, some easily exploitable Lua functions will be disabled.
     *
     * ⚠ **Warning**: [`luaotfload`](https://github.com/latex3/luaotfload) won't
     * work if this setting is set to `true`.
     *
     * @defaultValue `false`
     */
    saferLua?: boolean | undefined;

    /**
     * If `false`, shell escape is disabled, meaning that the TeX engine will
     * not be able to execute shell commands (i.e., e.g., the `minted` LaTeX
     * package won't work).
     *
     * If equal to `'restricted'`, shell escape will be enabled, but only for a
     * restricted set of commands; these are defined by the `texmf.cnf` file of
     * the TeX distribution.
     *
     * If `true`, shell escape is enabled without restrictions. Use this option
     * with caution, and only if you trust the TeX code you are compiling.
     *
     * @defaultValue `false`
     */
    shellEscape?: 'restricted' | boolean | undefined;
}

export interface CachingOptions {
    /**
     * If `true`, auxiliary files of *named* TeX blocks won't be removed from
     * the cache directory after compilation. Auxiliary files of *unnamed* TeX
     * blocks will still be removed from the cache directory after compilation.
     *
     * If `false`, all auxiliary files will be removed from the cache directory
     * after compilation.
     *
     * @defaultValue `true`
     */
    enabled?: boolean | undefined;

    /**
     * Directory in which to cache auxiliary files.
     *
     * @defaultValue
     * ```ts
     * `node_modules/.cache/@nvl/sveltex`
     * ```
     *
     * @remarks
     * The default value indicated above is somewhat untrue. The actual default
     * value is determined by the `findCacheDirectory` function from the
     * [`find-cache-dir`](https://www.npmjs.com/package/find-cache-dir) package,
     * which will look for a `package.json` file in the current working
     * directory or its parent directories, and will return the absolute path to
     * the directory that the default value from above shows, relative to the
     * parent directory of the `package.json` it found. If it doesn't find a
     * `package.json`, or if the `node_modules` directory is unwritable, it will
     * return `undefined`. In this case, SvelTeX will fall back to using
     * [`XDG_CACHE_HOME`](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest#basics) via `$XDG_CACHE_HOME/sveltex`,
     * or `~/.cache/sveltex` if `XDG_CACHE_HOME` isn't set.
     */
    cacheDirectory?: string | undefined;
}

export interface OptimizationOptions {
    /**
     * Try to make the SVG use `currentColor` as its default color by replacing
     * all occurrences of the given color in the SVG code with `'currentColor'`.
     *
     * @defaultValue
     * ```ts
     * '#000'
     * ```
     *
     * @remarks
     * Set this property to `null` to disable this feature.
     *
     * @remarks
     * Suppose this property is set to `'#000'`. Sveltex will then replace all
     * occurrences of `'#000'`, `'#000000'`, and `'black'` with
     * `'currentColor'`.
     *
     * @remarks
     * If {@link ConversionOptions.converter | `conversion.converter`} is set to
     * `'poppler'`, it will add `fill="currentColor"` to the (outermost) `<svg>`
     * tag by default.
     *
     * @remarks
     * `dvisvgm` already includes options to achieve the behavior that this
     * property aims to achieve (namely, the
     * {@link DvisvgmSvgOutputOptions.currentColor | `DvisvgmOptions.svg.currentColor`}).
     * However, this present option can still be useful to take care of any
     * potential edge cases that `dvisvgm`'s `currentColor` option might not
     * cover.
     */
    currentColor?: `#${string}` | null | undefined;

    /**
     * Override the SVG optimization function for this component.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if
     * `overrideOptimization` is set to anything other than `null` or
     * `undefined`:
     * - {@link svgo | `svgo`}.
     *
     * ---
     * #### FUNCTION PARAMETERS
     *
     * @param svg - The SVG code to optimize.
     * @param tc - The TeX component whose output SVG code is being optimized.
     * @returns The optimized SVG code.
     */
    overrideOptimization?:
        | ((svg: string, tc: TexComponent) => string)
        | null
        | undefined;

    /**
     * Options to pass to [SVGO](https://www.npmjs.com/package/svgo)'s
     * `optimize` function when optimizing SVG files.
     */
    svgo?: Omit<SvgoOptions, 'path'> | undefined;
}

export interface DebugOptions {
    /**
     * Log messages to ignore.
     *
     * @remarks
     * The strings (resp. regular expressions) are checked for inclusion in
     * (resp. matched against) the message that SvelTeX would print to the
     * console (excl. filepath and line number), which may differ from the
     * message as it appears in the original LaTeX log.
     *
     * @defaultValue
     * ```ts
     * [
     *     'Package shellesc Warning: Shell escape disabled',
     *     'LaTeX Warning: Package "xcolor" has already been loaded: ignoring load-time option "dvisvgm".',
     *     'Package epstopdf Warning: Shell escape feature is not enabled.',
     * ]
     * ```
     */
    ignoreLogMessages?: (string | RegExp)[] | undefined;

    /**
     * Lowest severity level of messages from LaTeX log to print.
     *
     * -   `'all'`: All messages will be printed.
     * -   `'info'`: Print all info messages (incl. under- and overfull box
     *     messages), warnings, and error messages.
     * -   `'box'`: Print under- and overfull box messages, warnings, and error
     *     messages.
     * -   `'warn'`: Print warnings and error messages.
     * -   `'error'`: Only print error messages.
     * -   `'none'`: No messages will be printed.
     *
     * This property can also be set to an object with `onFailure` and
     * `onSuccess` properties, each of which can take the same values as the
     * string values above, and will determine the verbosity of the log printed
     * to the console on failed and successful compilations, respectively.
     *
     * @remarks
     * If `'all'` is selected, the entire log generated by LaTeX will be printed
     * to the console, and the {@link ignoreLogMessages | `ignoreLogMessages`}
     * property will be ignored.
     *
     * @defaultValue
     * ```ts
     * 'box'
     * ```
     */
    verbosity?:
        | ('all' | TexLogSeverity | 'none' | undefined)
        | {
              /**
               * Lowest severity level of messages from LaTeX log to print upon
               * failed compilation.
               *
               * -   `'all'`: All messages will be printed.
               * -   `'info'`: Print all info messages (incl. under- and
               *     overfull box messages), warnings, and error messages.
               * -   `'box'`: Print under- and overfull box messages, warnings,
               *     and error messages.
               * -   `'warn'`: Print warnings and error messages.
               * -   `'error'`: Only print error messages.
               * -   `'none'`: No messages will be printed.
               *
               * @remarks
               * If `'all'` is selected, the entire log generated by LaTeX will
               * be printed to the console.
               *
               * @defaultValue
               * ```ts
               * 'box'
               * ```
               */
              onFailure?: 'all' | TexLogSeverity | 'none' | undefined;

              /**
               * Lowest severity level of messages from LaTeX log to print upon
               * successful compilation.
               *
               * -   `'all'`: All messages will be printed.
               * -   `'info'`: Print all info messages (incl. under- and
               *     overfull box messages), warnings, and error messages.
               * -   `'box'`: Print under- and overfull box messages, warnings,
               *     and error messages.
               * -   `'warn'`: Print warnings and error messages.
               * -   `'error'`: Only print error messages.
               * -   `'none'`: No messages will be printed.
               *
               * @remarks
               * If `'all'` is selected, the entire log generated by LaTeX will
               * be printed to the console.
               *
               * @defaultValue
               * ```ts
               * 'box'
               * ```
               */
              onSuccess?: 'all' | TexLogSeverity | 'none' | undefined;
          }
        | undefined;
}

export interface TexConfiguration {
    /**
     * Options relating to Sveltex's caching mechanism for the compilation (TeX
     * → DVI/PDF/XDV) and conversion + optimization (DVI/PDF → SVG → Svelte)
     * steps.
     */
    caching?: CachingOptions | undefined;

    /**
     * Options relating to the compilation of TeX content to DVI/PDF files.
     */
    compilation?: CompilationOptions | undefined;

    /**
     * Options relating to the conversion of DVI/PDF output to SVG files.
     */
    conversion?: ConversionOptions | undefined;

    /**
     * Options relating to the console output produced by Sveltex while dealing
     * with TeX content.
     */

    debug?: DebugOptions | undefined;

    /**
     * Options relating to the optimization of SVG files (SVG → `.svelte` step).
     */
    optimization?: OptimizationOptions | undefined;
}

export type FullTexConfiguration = DeepRequiredNotUndefined<
    Omit<TexConfiguration, 'optimization'>
> &
    FirstTwoLevelsRequiredNotUndefined<Pick<TexConfiguration, 'optimization'>>;

/**
 * Type of the function that processes a TeX string.
 *
 * @typeParam B - Advanced TeX backend.
 */
export type TexProcessFn = ProcessFn<TexProcessOptions, TexHandler>;

/**
 * Type of the function that configures a TeX processor of the specified type.
 *
 * @typeParam B - Advanced TeX backend.
 */
export type TexConfigureFn = ConfigureFn<TexConfiguration, TexHandler>;

export type TexProcessor = object;

export interface TexProcessOptions extends VerbatimProcessOptions {
    config: FullVerbEnvConfigTex;
}

/**
 *
 */
export interface TexComponentImportInfo {
    /**
     * JS identifier to use to import the Svelte component file containing the
     * SVG code that was generated for the TeX component to which this
     * `TexComponentImportInfo` implicitly corresponds..
     *
     * @example
     * If `id` was set to `'Sveltex__tex__ref'` and `path` was set to
     * `'src/sveltex/tex/ref.svelte'`, the import statement that Sveltex would
     * generate would look like this:
     *
     * ```js
     * import Sveltex__tex__ref from 'src/sveltex/tex/ref.svelte';
     * ```
     *
     * @internal
     */
    id: string;

    /**
     * Path to the Svelte component file containing the SVG code that was
     * generated for the TeX component to which this `TexComponentImportInfo`
     * implicitly corresponds.
     *
     * @example
     * If `id` was set to `'Sveltex__tex__ref'` and `path` was set to
     * `'src/sveltex/tex/ref.svelte'`, the import statement that Sveltex would
     * generate would look like this:
     *
     * ```js
     * import Sveltex__tex__ref from 'src/sveltex/tex/ref.svelte';
     * ```
     *
     * @internal
     */
    path: string;
}

export interface Problem {
    message: string;
    line: number;
    col?: number | undefined;
    severity: TexLogSeverity;
}
