// Types
import type { HTMLAttributes, SvgoOptions } from '$deps.js';
import type { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type { ConfigureFn, ProcessFn } from '$types/handlers/Handler.js';
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type { DvisvgmOptions } from '$types/utils/DvisvgmOptions.js';
import type {
    EscapeOptions,
    InterpretedAttributes,
} from '$types/utils/Escape.js';
import type {
    RequiredNonNullable,
    RequiredNonNullableExcept,
} from '$types/utils/utility-types.js';
import type { TexComponent } from '$utils/TexComponent.js';

/**
 * Supported advanced TeX backends.
 */
export type AdvancedTexBackend = 'local' | 'custom' | 'none';

export type FullTexLiveConfiguration = RequiredNonNullableExcept<
    TexLiveConfiguration,
    | 'overrideCompilationCommand'
    | 'overrideConversionCommand'
    | 'overrideSvgPostprocess'
>;

export type HTMLSvgAttributes = HTMLAttributes<HTMLElement>;

export interface TexLiveConfiguration {
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
     * `node_modules/.cache/sveltex-preprocess`
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
     *   - `$FILEPATH`: `node_modules/.cache/sveltex-preprocess/tikz/example.tex`
     *   - `$FILENAME`: `example.tex`
     *   - `$FILENAME_BASE`: `example`
     *
     * - Output file:
     *   - `$OUTDIR`: `node_modules/.cache/sveltex-preprocess/tikz`
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
     *     `node_modules/.cache/sveltex-preprocess/tikz/Example.pdf`
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
     * - {@link dvisvgmOptions | `dvisvgmOptions`}
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
        | (<A extends AdvancedTexBackend>(
              svg: string,
              tc: TexComponent<A>,
          ) => string)
        | null
        | undefined;

    /**
     * Options to pass to [SVGO](https://www.npmjs.com/package/svgo)'s
     * `optimize` function when optimizing SVG files.
     */
    svgoOptions?: Omit<SvgoOptions, 'path'> | undefined;

    /**
     * Options to pass to `dvisvgm` when converting DVI files to SVG.
     */
    dvisvgmOptions?: DvisvgmOptions | undefined;

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

export type FullTexComponentConfiguration<B extends AdvancedTexBackend> =
    RequiredNonNullable<TexComponentConfiguration<B>>;

/**
 * TeX component configuration options.
 */
export interface TexComponentConfiguration<A extends AdvancedTexBackend> {
    /**
     * Name of the component (used to define an HTML tag for SvelTeX files).
     *
     * @remarks Names are case-sensitive.
     * @remarks Don't use existing HTML tags as names (e.g., don't use `code` or
     * `span`).
     * @example 'tikz'
     */
    // name: string;

    /**
     * Aliases for the component.
     *
     * @remarks Aliases are case-sensitive.
     * @remarks Don't use existing HTML tags as aliases (e.g., don't use `code`
     * or `span`).
     * @example ['TikZ', 'Tikz']
     */
    aliases?: string[];

    /**
     * Preamble to include in the TeX file (everything after
     * `\documentclass{...}` but before `\begin{document}`).
     *
     * @defaultValue
     * ```tex
     * \usepackage{microtype}
     * ```
     */
    preamble?: string;

    /**
     * First line(s) of the TeX document.
     *
     * @defaultValue `'\\documentclass{standalone}'`
     */
    documentClass?: string;

    /**
     *
     */
    overrides?: TexLiveConfiguration;

    /**
     * @param attributes - Attributes the user passed to the TeX component
     * (except `ref` or valueless attributes).
     * @param tc - The TeX component, which this function may mutate.
     * @returns An object which will be assigned to the
     * {@link TexComponent.handledAttributes | `handledAttributes`} property of
     * the TeX component, for use by the {@link postprocess | `postprocess`}
     * function.
     */
    handleAttributes?: (
        attributes: Record<string, string>,
        tc: Omit<TexComponent<A>, 'configuration' | 'handledAttributes'> &
            Omit<Pick<TexComponent<A>, 'configuration'>, 'handleAttributes'>,
    ) => Record<string, unknown>;

    /**
     * Postprocessing function to control how the SVG component is inserted into
     * the output Svelte file.
     *
     * @param svgComponent - `'<svelte:component this={...} />'`.
     * @param tc - The TeX component whose output SVG component is being
     * post-processed.
     */
    postprocess?: (svgComponent: string, tc: TexComponent<A>) => string;
}

type AdvancedTexBaseConfiguration<A extends AdvancedTexBackend> =
    TexLiveConfiguration & {
        /**
         * Components to render "advanced" TeX code.
         * @defaultValue `{}`
         */
        components?:
            | Record<string, TexComponentConfiguration<A>>
            | undefined
            | null;
    };

type FullAdvancedTexBaseConfiguration<A extends AdvancedTexBackend> =
    FullTexLiveConfiguration & {
        /**
         * Components to render "advanced" TeX code.
         * @defaultValue `{}`
         */
        components: Record<string, TexComponentConfiguration<A>>;
    };

export type AdvancedTexConfiguration<A extends AdvancedTexBackend> =
    A extends 'custom'
        ? AdvancedTexBaseConfiguration<A> & Record<string, unknown>
        : AdvancedTexBaseConfiguration<A>;

export type FullAdvancedTexConfiguration<A extends AdvancedTexBackend> =
    A extends 'custom'
        ? FullAdvancedTexBaseConfiguration<A>
        : FullAdvancedTexBaseConfiguration<A> & Record<string, unknown>;

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

export interface AdvancedTexProcessOptions {
    tag: string;
    attributes: InterpretedAttributes;
    filename: string;
    selfClosing: boolean;
    escapeOptions?: EscapeOptions | undefined;
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
