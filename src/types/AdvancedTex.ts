// Types
import { AdvancedTexHandler } from '$handlers';
import type {
    CliInstruction,
    ConfigureFn,
    DvisvgmOptions,
    DefineHandlerInterface,
    ProcessFn,
    RequiredNonNullable,
    RequiredNonNullableExcept,
    SupportedTexEngine,
} from '$types';
import type { HTMLAttributes } from 'svelte/elements';

export type AdvancedTexBackend = 'local' | 'custom' | 'none';

export type FullTexLiveConfig = RequiredNonNullableExcept<
    TexLiveConfig,
    'overrideCompilationCommand' | 'overrideConversionCommand'
>;

export type HTMLFigureAttributes = HTMLAttributes<HTMLElement>;

export interface TexLiveConfig {
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
    overrideCompilationCommand?: CliInstruction | undefined;

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
     *   - `$FILEPATH`: `node_modules/.cache/sveltex-preprocess/tikz/example.pdf`
     *   - `$FILENAME`: `example.pdf`
     *   - `$FILENAME_BASE`: `example`
     *   - `$FILETYPE`: `pdf`
     *
     * - Variables describing output file:
     *   - `$OUTDIR`: `static/sveltex-preprocess/tikz`
     *   - `$OUTFILEPATH`: `static/sveltex-preprocess/tikz/example.svg`
     *
     * @remarks
     * ⚠ **Warning**: The following properties will be useless if this property
     * is set:
     * - {@link dvisvgmOptions | `dvisvgmOptions`}
     */
    overrideConversionCommand?: CliInstruction | undefined;

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
     * Output directory. The first part of the path should be `src`, or at least
     * a directory from which SVG files can be imported `import Example from 'outputDirectory/Example.svelte'`
     *
     * whatever directory was configured to serve static files in the SvelteKit
     * configuration.
     *
     * @defaultValue `'static/sveltex'`
     */
    //  * @remarks
    //  * The SVG file will be written to
    //  * `./${outputDirectory}/${name}/${refOrHash}.svg`, where:
    //  *
    //  * - `outputDirectory`: the value of this property.
    //  * - `name` is the name of the component, usually the same as the HTML tag
    //  *   used for the component. In particular, this does not refer to the name
    //  *   of any one given instance of the component, but rather the name of a
    //  *   given *class* of TeX components.
    //  * - `refOrHash` is either the `ref` attribute of the component, or a hash
    //  *   of the TeX code if no `ref` attribute is provided.
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

export type FullTexComponentConfig = RequiredNonNullable<TexComponentConfig>;

/**
 * TeX component configuration options.
 */
export interface TexComponentConfig {
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
    overrides?: TexLiveConfig;

    /**
     *
     */
    defaultAttributes?: HTMLFigureAttributes | undefined;
}

export type AdvancedTexConfiguration<B extends AdvancedTexBackend> =
    B extends 'local'
        ? TexLiveConfig & {
              /**
               * Components to render "advanced" TeX code.
               * @defaultValue `{}`
               */
              components?: Record<string, TexComponentConfig> | undefined;
          }
        : B extends 'custom'
          ? Record<string, unknown>
          : B extends 'none'
            ? Record<string, unknown>
            : never;

export type FullAdvancedTexConfiguration<B extends AdvancedTexBackend> =
    B extends 'local'
        ? FullTexLiveConfig & {
              /**
               * Components to render "advanced" TeX code.
               * @defaultValue `{}`
               */
              components: Record<string, TexComponentConfig>;
          }
        : B extends 'custom'
          ? Record<string, unknown>
          : B extends 'none'
            ? Record<string, unknown>
            : never;

// ----------- BOILERPLATE CODE BELOW -----------

export type IAdvancedTexHandler<B extends AdvancedTexBackend> =
    DefineHandlerInterface<
        AdvancedTexBackend,
        AdvancedTexConfiguration<B>,
        FullAdvancedTexConfiguration<B>,
        AdvancedTexProcessOptions
    >;

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
    name?: string;
    ref?: string | undefined;
    attributes?: HTMLFigureAttributes | undefined;
    filename: string;
}

/**
 * Type of the factory function that creates an advanced TeX handler.
 * @typeParam B - Advanced TeX backend.
 * @returns A function that returns a promise that resolves to an advanced TeX
 * handler of the specified type.
 */
export type AdvancedTexHandlerFactory<B extends AdvancedTexBackend> =
    B extends 'custom'
        ? (
              processor: object,
              process: AdvancedTexProcessFn<B>,
              configure: AdvancedTexConfigureFn<B>,
              configuration: AdvancedTexConfiguration<B>,
          ) => AdvancedTexHandler<B> | Promise<AdvancedTexHandler<B>>
        : (
              config?: AdvancedTexConfiguration<B>,
          ) => AdvancedTexHandler<B> | Promise<AdvancedTexHandler<B>>;

/**
 * Object that maps the names of supported tex processors to a factory that
 * creates an advanced tex handler of that type.
 */
export type AdvancedTexHandlerFactories = {
    [B in AdvancedTexBackend]: AdvancedTexHandlerFactory<B>;
};
