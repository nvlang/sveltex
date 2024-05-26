// Types
import { type Equals, typeAssert } from '$deps.js';
import type { TexHandler } from '$handlers/TexHandler.js';
import type {
    CssConfiguration,
    FullCssConfiguration,
    PreAndPostTransformations,
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
    ? WithCss<B, CA> &
          WithTransformations<B> & {
              katex?:
                  | Omit<import('katex').KatexOptions, 'displayMode'>
                  | undefined;
          }
    : B extends 'mathjax'
      ? WithCss<B, CA> &
            WithTransformations<B> & {
                outputFormat?: 'svg' | 'chtml' | undefined;
                mathjax?: MathjaxConfiguration | undefined;
            }
      : B extends 'custom'
        ? WithTransformations<B> & Record<string, unknown>
        : B extends 'none'
          ? WithTransformations<B> & Record<string, unknown>
          : never;

interface WithCss<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> {
    /**
     * KaTeX/MathJax need CSS to work properly. By default, Sveltex takes care
     * of this itself. This property allows you to configure this behavior.
     */
    css?: CssConfiguration<CA> | undefined | null;
}

interface WithFullCssConfiguration<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> {
    css: FullCssConfiguration<CA>;
}

interface WithTransformations<T extends TexBackend> {
    /**
     * Transformations to apply to
     * - the tex before passing it to the TeX backend for processing, or to
     * - the output produced by the TeX backend.
     */
    transformations?:
        | PreAndPostTransformations<TexProcessOptionsWithoutTransformations<T>>
        | undefined;
}

interface WithTransformationsRequiredNonNullable<T extends TexBackend> {
    transformations: RequiredNonNullable<
        PreAndPostTransformations<TexProcessOptionsWithoutTransformations<T>>
    >;
}

type TexProcessOptionsWithoutTransformations<B extends TexBackend> =
    B extends 'mathjax'
        ? TexProcessOptions<B>
        : Omit<TexProcessOptions<B>, 'options'> & {
              options?: Omit<
                  TexProcessOptions<B>['options'],
                  'transformations'
              >;
          };

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
    ? WithFullCssConfiguration<B> &
          WithTransformationsRequiredNonNullable<B> &
          RequiredNonNullable<
              Omit<TexConfiguration<B, CA>, 'transformations' | 'css'>
          >
    : WithTransformationsRequiredNonNullable<B> & TexConfiguration<B, CA>;

export type PossibleTexCssApproach<B extends TexBackend> = B extends 'mathjax'
    ? 'hybrid' | 'none'
    : B extends 'katex'
      ? 'cdn' | 'hybrid' | 'none'
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

export type TexProcessOptions<
    B extends TexBackend,
    CA extends PossibleTexCssApproach<B> = PossibleTexCssApproach<B>,
> = B extends 'mathjax'
    ? {
          inline?: boolean | undefined;
          options?: Partial<MathjaxConversionOptions> | undefined;
      }
    : {
          inline?: boolean | undefined;
          options?: TexConfiguration<B, CA> | undefined;
      };

// Compile-time unit tests

typeAssert<
    Equals<
        keyof TexConfiguration<'mathjax'>,
        keyof FullTexConfiguration<'mathjax'>
    >
>();

typeAssert<
    Equals<keyof TexConfiguration<'katex'>, keyof FullTexConfiguration<'katex'>>
>();

typeAssert<
    Equals<
        keyof TexConfiguration<'custom'>,
        keyof FullTexConfiguration<'custom'>
    >
>();

typeAssert<
    Equals<keyof TexConfiguration<'none'>, keyof FullTexConfiguration<'none'>>
>();
