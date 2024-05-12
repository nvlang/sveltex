// Types
import { Equals, assert } from '$deps.js';
import type { TexHandler } from '$handlers/TexHandler.js';
import type {
    CssApproach,
    CssApproachLocal,
    CssConfiguration,
    FullCssConfiguration,
} from '$types/handlers/misc.js';
import type {
    MathjaxConfiguration,
    MathjaxConversionOptions,
} from '$types/utils/MathjaxOptions.js';
import type { RequiredNonNullable } from '$types/utils/utility-types.js';

/**
 * Supported TeX backends.
 */
export type TexBackend = 'katex' | 'mathjax' | 'custom' | 'none';

/**
 * Type of the processor used to parse tex.
 *
 * @typeParam T - The type of the tex processor.
 * @returns Depending on `T`:
 * - `katex`: `null`.
 * - `mathjax`: `null`.
 * - `custom`: `unknown`.
 * - `none`: `null`.
 *
 * @remarks This is the type of the `processor` property of the tex handler.
 */
export type TexProcessor<B extends TexBackend> = B extends 'katex'
    ? object
    : B extends 'mathjax'
      ? import('mathjax-full/js/core/MathDocument.js').MathDocument<
            unknown,
            unknown,
            unknown
        >
      : B extends 'custom'
        ? object
        : B extends 'none'
          ? object
          : never;

/**
 * Type of the configuration object used to configure the tex processor.
 *
 * @typeParam T - The type of the tex processor.
 * @returns Depending on `T`:
 * - `katex`: The module's `KatexOptions` type.
 * - `mathjax`: Type with an optional `outputFormat` property of type
 *   `'svg' | 'chtml'` and an optional `mathjaxConfiguration` property of type
 *   {@link MathjaxConfiguration | `MathjaxConfiguration`}.
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the tex handler's
 * `configure` function.
 */
export type TexConfiguration<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> = B extends 'katex'
    ? BaseTexConfiguration<B, CA> & {
          katex?: Omit<import('katex').KatexOptions, 'displayMode'> | undefined;
      }
    : B extends 'mathjax'
      ? BaseTexConfiguration<B, CA> & {
            outputFormat?: 'svg' | 'chtml' | undefined;
            mathjax?: MathjaxConfiguration | undefined;
        }
      : B extends 'custom'
        ? Record<string, unknown>
        : B extends 'none'
          ? Record<string, unknown>
          : never;

interface BaseTexConfiguration<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> {
    /**
     * KaTeX/MathJax need CSS to work properly. By default, Sveltex takes care
     * of this itself. This property allows you to configure this behavior.
     */
    css?: CssConfiguration<CA> | undefined | null;
    /**
     * Regex transformations to apply to the tex content before passing it to
     * the TeX backend for processing, or to the output produced by the TeX
     * backend.
     */
    transformations?: PreAndPostTransformations | undefined | null;
}

interface FullBaseTexConfiguration<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> {
    css: FullCssConfiguration<CA>;
    transformations: RequiredNonNullable<PreAndPostTransformations>;
}

/**
 * A string transformation, where the first element is a regex or string to
 * match, and the second element is the replacement string. The replacement
 * string can contain `$1`, `$2`, etc. to refer to capture groups in the regex.
 * In particular, the transformation will be performed by calling
 * `.replaceAll()` on the string with the regex and replacement string as first
 * and second arguments, respectively, so any features that the `.replaceAll()`
 * method supports can be used here too.
 */
export type Transformation = [RegExp | string, string];

interface PreAndPostTransformations {
    /**
     * Regex transformations to apply to the tex content before passing it to
     * the TeX backend for processing.
     *
     * @remarks The transformations are applied using `.replaceAll()`, and are
     * called in the order they are listed on the output of the previous
     * transformation (or on the original TeX content if it's the first
     * transformation).
     */
    pre?: Transformation[] | undefined | null;

    /**
     * Regex transformations to apply to the CHTML/SVG/MathML content after the
     * TeX backend has processed it.
     *
     * @remarks The transformations are applied using `.replaceAll()`, and are
     * called in the order they are listed on the output of the previous
     * transformation (or on the unmodified TeX backend output if it's the first
     * transformation).
     */
    post?: Transformation[] | undefined | null;
}

/**
 * Return type of the
 * {@link TexHandler.configuration | `TexHandler.configuration`} getter.
 *
 * @typeParam B - The type of the tex backend.
 */
export type FullTexConfiguration<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> = B extends 'mathjax' | 'katex'
    ? RequiredNonNullable<
          Omit<TexConfiguration<B, CA>, keyof BaseTexConfiguration<B, CA>>
      > &
          FullBaseTexConfiguration<B, CA>
    : TexConfiguration<B, CA>;

type PossibleTexCssApproach<B extends TexBackend> = B extends 'mathjax'
    ? CssApproachLocal
    : B extends 'katex'
      ? CssApproach
      : never;

/**
 * Type of the function that processes a tex string.
 *
 * @typeParam B - Tex backend.
 */
export type TexProcessFn<B extends TexBackend> =
    /**
     * @param tex - The tex content to process, without delimiters (e.g. `x^2`).
     * @param options - Options describing how to process the tex content (e.g.,
     * whether to process it as inline or display math).
     * @param texHandler - The tex handler to use to process the tex.
     * @returns The processed tex, or a promise resolving to it.
     */
    (
        tex: string,
        options: TexProcessOptions<B>,
        texHandler: TexHandler<B>,
    ) => string | Promise<string>;

/**
 * Type of the function that configures a {@link TexHandler | `TexHandler`}
 * instance with backend {@link B | `B`} .
 *
 * @typeParam B - Tex backend.
 */
export type TexConfigureFn<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> =
    /**
     * Function to configure a {@link TexHandler | `TexHandler`} instance.
     *
     * @param opts - The configuration options to apply to the tex handler.
     * @param texHandler - The tex handler to configure.
     * @returns `void`, or a promise resolving to it.
     */
    (
        opts: TexConfiguration<B, CA>,
        texHandler: TexHandler<B>,
    ) => void | Promise<void>;

export type TexProcessOptions<B extends TexBackend> = B extends 'mathjax'
    ? {
          inline?: boolean | undefined;
          options?: Partial<MathjaxConversionOptions> | undefined;
      }
    : {
          inline?: boolean | undefined;
          options?: TexConfiguration<B, never> | undefined;
      };

// Compile-time unit tests

assert<
    Equals<
        keyof TexConfiguration<'mathjax'>,
        keyof FullTexConfiguration<'mathjax'>
    >
>();

assert<
    Equals<keyof TexConfiguration<'katex'>, keyof FullTexConfiguration<'katex'>>
>();

assert<
    Equals<
        keyof TexConfiguration<'custom'>,
        keyof FullTexConfiguration<'custom'>
    >
>();

assert<
    Equals<keyof TexConfiguration<'none'>, keyof FullTexConfiguration<'none'>>
>();
