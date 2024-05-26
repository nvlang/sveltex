// Types
import type { SvgoOptions } from '$deps.js';
import type { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type { ConfigureFn, ProcessFn } from '$types/handlers/Handler.js';
import type {
    FullVerbEnvConfigAdvancedTex,
    VerbEnvConfigAdvancedTex,
    VerbatimProcessOptions,
} from '$types/handlers/Verbatim.js';
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type { DvisvgmOptions } from '$types/utils/DvisvgmOptions.js';
import type {
    FirstTwoLevelsRequiredNotUndefined,
    RequiredNonNullableExcept,
} from '$types/utils/utility-types.js';
import type { TexComponent } from '$utils/TexComponent.js';

/**
 * Supported advanced TeX backends.
 */
export type AdvancedTexBackend = 'local' | 'custom' | 'none';

export type FullTexLiveConfiguration<
    CC extends ConversionCommand = ConversionCommand,
> = RequiredNonNullableExcept<
    TexLiveConfiguration<CC>,
    | 'overrideCompilationCommand'
    | 'overrideConversionCommand'
    | 'overrideSvgPostprocess'
>;

export type ConversionCommand = 'dvisvgm' | 'pdf2svg';

export type ConversionOptions<CC extends ConversionCommand> =
    CC extends 'dvisvgm'
        ? DvisvgmOptions
        : CC extends 'pdf2svg'
          ? Pdf2svgOptions
          : never;

export type FullConversionOptions<CC extends ConversionCommand> =
    FirstTwoLevelsRequiredNotUndefined<ConversionOptions<CC>>;

interface HasPdf2svgOptions {
    conversionCommand: 'pdf2svg';

    /**
     * Options to pass to `pdf2svg` when converting PDF files to SVG.
     */
    conversionOptions?: ConversionOptions<'pdf2svg'> | undefined;
}

interface HasDvisvgmOptions {
    conversionCommand?: 'dvisvgm' | undefined;

    /**
     * Options to pass to `dvisvgm` when converting PDF or DVI files to SVG.
     */
    conversionOptions?: ConversionOptions<'dvisvgm'> | undefined;
}

export type TexLiveConfiguration<
    CC extends ConversionCommand = ConversionCommand,
> = TexLiveConfigurationWithoutConversionOptions<CC> &
    (HasDvisvgmOptions | HasPdf2svgOptions);

export interface TexLiveConfigurationWithoutConversionOptions<
    CC extends ConversionCommand = ConversionCommand,
> {
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

    /**
     * Intermediate filetype to use when compiling the TeX block.
     *
     * @defaultValue `'pdf'`.
     *
     * @remarks
     * Not all engines support all intermediate filetypes. For example, `tex`
     * (plain TeX) only supports `'dvi'`.
     */
    intermediateFiletype?: 'pdf' | 'dvi' | undefined;

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
     * If `true`, auxiliary files of *named* TeX blocks won't be removed from
     * the cache directory after compilation. Auxiliary files of *unnamed* TeX
     * blocks will still be removed from the cache directory after compilation.
     *
     * If `false`, all auxiliary files will be removed from the cache directory
     * after compilation.
     *
     * @defaultValue `true`
     */
    caching?: boolean | undefined;

    /**
     * Directory in which to cache auxiliary files.
     *
     * @defaultValue
     * ```ts
     * `node_modules/.cache/@nvl/sveltex`
     * ```
     */
    cacheDirectory?: string | undefined;

    /**
     * Override the compilation command for this component.
     *
     * @remarks
     * The following environment variables will be available, in addition to the
     * ones from {@link process.env | `process.env`} and any manually set
     * environment variables:
     *
     * - Input file:
     *   - `$FILEPATH`: `node_modules/.cache/@nvl/sveltex/tikz/example.tex`
     *   - `$FILENAME`: `example.tex`
     *   - `$FILENAME_BASE`: `example`
     *
     * - Output file:
     *   - `$OUTDIR`: `node_modules/.cache/@nvl/sveltex/tikz`
     *   - `$OUTFILETYPE`: `pdf`
     *
     * @remarks
     * **✓ Invariants**:
     * - `FILEPATH === OUTDIR + '/' + FILENAME`
     * - `FILENAME === FILENAME_BASE + '.tex'`
     *
     * @remarks
     * ⚠ **Warning**: Make sure that the command either generates a PDF file at
     * `OUTDIR + '/' + FILENAME_BASE + '.' + OUTFILETYPE`, or that you set the
     * `overrideConversionCommand` property to properly deal with the output of
     * the compilation command.
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if this property
     * is set:
     * - {@link engine | `engine`}
     * - {@link shellEscape | `shellEscape`}
     * - {@link caching | `caching`}
     */
    overrideCompilationCommand?: CliInstruction | null | undefined;

    /**
     * Override the PDF/DVI to SVG conversion command for this component.
     *
     * @defaultValue `undefined`
     *
     * @remarks
     * The following environment variables will be available, in addition to the
     * ones from {@link process.env | `process.env`} and any manually set
     * environment variables:
     *
     * - Variables describing input file:
     *   - `$FILEPATH`:
     *     `node_modules/.cache/@nvl/sveltex/tikz/Example.pdf`
     *   - `$FILENAME`: `Example.pdf`
     *   - `$FILENAME_BASE`: `Example`
     *   - `$FILETYPE`: `pdf`
     *
     * - Variables describing output file:
     *   - `$OUTDIR`: `src/sveltex/tikz`
     *   - `$OUTFILEPATH`: `src/sveltex/tikz/Example.svg`
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if
     * `overrideConversionCommand` is set:
     * - {@link conversionOptions | `conversionOptions`}
     */
    overrideConversionCommand?: CliInstruction | null | undefined;

    /**
     * Override the SVG optimization function for this component.
     *
     * @defaultValue `undefined`
     * @remarks Set to `null` to disable SVG optimization.
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if
     * `overrideSvgPostprocess` is set:
     * - {@link svgoOptions | `svgoOptions`}
     *
     * @param svg - The SVG code to optimize.
     * @param tc - The TeX component whose output SVG code is being optimized.
     * @returns The optimized SVG code.
     */
    overrideSvgPostprocess?:
        | ((svg: string, tc: TexComponent) => string)
        | null
        | undefined;

    /**
     * Options to pass to [SVGO](https://www.npmjs.com/package/svgo)'s
     * `optimize` function when optimizing SVG files.
     */
    svgoOptions?: Omit<SvgoOptions, 'path'> | undefined;

    conversionCommand?: CC | undefined;

    /**
     * Whether to output verbose logs.
     *
     * @defaultValue `false`
     */
    verbose?: boolean | undefined;

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
     * TeX engine to use by default to render "advanced" TeX code. This setting
     * can be overridden by the `engine` property of a specific
     * TexComponentConfig object.
     *
     * @defaultValue `'lualatex'`
     */
    engine?: SupportedTexEngine | undefined;
}

export interface Pdf2svgOptions {
    currentColor?: `#${string}` | undefined;
}

export type FullTexComponentConfiguration = FullVerbEnvConfigAdvancedTex;

export type TexComponentConfiguration = VerbEnvConfigAdvancedTex;

type AdvancedTexBaseConfiguration<
    CC extends ConversionCommand = ConversionCommand,
> = TexLiveConfiguration<CC>;

type FullAdvancedTexBaseConfiguration<
    CC extends ConversionCommand = ConversionCommand,
> = FullTexLiveConfiguration<CC>;

export type AdvancedTexConfiguration<
    A extends AdvancedTexBackend,
    CC extends ConversionCommand = 'dvisvgm',
> = A extends 'custom'
    ? AdvancedTexBaseConfiguration<CC> & Record<string, unknown>
    : AdvancedTexBaseConfiguration<CC>;

export type FullAdvancedTexConfiguration<
    A extends AdvancedTexBackend,
    CC extends ConversionCommand = 'dvisvgm',
> = A extends 'custom'
    ? FullAdvancedTexBaseConfiguration<CC>
    : FullAdvancedTexBaseConfiguration<CC> & Record<string, unknown>;

/**
 * Type of the function that processes an advanced TeX string.
 *
 * @typeParam B - Advanced TeX backend.
 */
export type AdvancedTexProcessFn<B extends AdvancedTexBackend> = ProcessFn<
    AdvancedTexProcessOptions,
    AdvancedTexHandler<B>
>;

/**
 * Type of the function that configures an advanced TeX processor of the specified type.
 *
 * @typeParam B - Advanced TeX backend.
 */
export type AdvancedTexConfigureFn<B extends AdvancedTexBackend> = ConfigureFn<
    AdvancedTexConfiguration<B>,
    AdvancedTexHandler<B>
>;

export type AdvancedTexProcessor = object;

export interface AdvancedTexProcessOptions extends VerbatimProcessOptions {
    config: FullTexComponentConfiguration;
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
