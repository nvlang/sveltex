// Types
import { type Equals, typeAssert } from '$deps.js';
import type { MathHandler } from '$handlers/MathHandler.js';
import type {
    CdnConfiguration,
    FullCssConfiguration,
    HybridCssConfiguration,
    NoneConfiguration,
} from '$types/handlers/Css.js';
import type { Transformers } from '$types/handlers/Handler.js';
import type {
    MathjaxConfiguration,
    MathjaxConversionOptions,
} from '$types/utils/MathjaxOptions.js';
import type { RequiredNotNullOrUndefined } from '$types/utils/utility-types.js';

/**
 * Supported math backends.
 */
export type MathBackend = 'katex' | 'mathjax' | 'custom' | 'none';

/**
 * Type of the processor used to parse math.
 *
 * @typeParam T - The type of the math processor.
 * @returns Depending on `T`:
 * - `katex`: `null`.
 * - `mathjax`: `null`.
 * - `custom`: `unknown`.
 * - `none`: `null`.
 *
 * @remarks This is the type of the `processor` property of the math handler.
 */
export type MathProcessor<B extends MathBackend> = B extends 'katex'
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
 * Type of the configuration object used to configure the math processor.
 *
 * @typeParam T - The type of the math processor.
 * @returns Depending on `T`:
 * - `katex`: The module's `KatexOptions` type.
 * - `mathjax`: Type with an optional `outputFormat` property of type
 *   `'svg' | 'chtml'` and an optional `mathjaxConfiguration` property of type
 *   {@link MathjaxConfiguration | `MathjaxConfiguration`}.
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the math handler's
 * `configure` function.
 */
export type MathConfiguration<B extends MathBackend> = B extends 'katex'
    ? WithTransformers<B> & SveltexKatexConfig
    : B extends 'mathjax'
      ? SveltexMathjaxConfig & WithTransformers<B>
      : B extends 'custom'
        ? WithTransformers<B> & Record<string, unknown>
        : B extends 'none'
          ? WithTransformers<B> & Record<string, unknown>
          : never;

interface SveltexKatexConfig {
    katex?: Omit<import('katex').KatexOptions, 'displayMode'> | undefined;
    /**
     * KaTeX needs CSS to work properly. By default, Sveltex takes care
     * of this itself. This property allows you to configure this behavior.
     */
    css?:
        | ({
              /**
               * Controls how to manage the CSS for MathJax.
               *
               * -   `'cdn'`: Load the CSS and the fonts from a CDN at run-time
               *     with a `<link>` element in `<svelte:head>`.
               * -   `'hybrid'`: Self-host the CSS, but use a CDN for the fonts.
               * -   `'none'`: Don't manage CSS for MathJax.
               *
               * @defaultValue
               * ```ts
               * 'cdn'
               * ```
               */
              type?: 'cdn' | 'hybrid' | 'none' | undefined;
          } & (CdnConfiguration | HybridCssConfiguration | NoneConfiguration))
        | undefined
        | null;
}

interface SveltexMathjaxConfig {
    outputFormat?: 'svg' | 'chtml' | undefined;
    mathjax?: MathjaxConfiguration | undefined;
    /**
     * MathJax needs CSS to work properly. By default, Sveltex takes care
     * of this itself. This property allows you to configure this behavior.
     */
    css?:
        | ({
              /**
               * Controls how to manage the CSS for MathJax.
               *
               * - `'hybrid'`: Self-host the CSS, but use a CDN for the fonts.
               * - `'none'`: Don't manage CSS for MathJax.
               *
               * @defaultValue
               * ```ts
               * 'hybrid'
               * ```
               */
              type?: 'hybrid' | 'none' | undefined;
          } & (HybridCssConfiguration | NoneConfiguration))
        | undefined
        | null;
}

interface WithFullCssConfiguration<
    B extends MathBackend,
    CA extends PossibleMathCssApproach<B> = PossibleMathCssApproach<B>,
> {
    css: FullCssConfiguration<CA>;
}

interface WithTransformers<T extends MathBackend> {
    /**
     * Transformers to apply to
     * - the tex before passing it to the math backend for processing, or to
     * - the output produced by the math backend.
     */
    transformers?:
        | Transformers<MathProcessOptionsWithoutTransformers<T>>
        | undefined;
}

interface WithTransformersRequiredNonNullable<T extends MathBackend> {
    transformers: RequiredNotNullOrUndefined<
        Transformers<MathProcessOptionsWithoutTransformers<T>>
    >;
}

type MathProcessOptionsWithoutTransformers<B extends MathBackend> =
    B extends 'mathjax'
        ? MathProcessOptions<B>
        : Omit<MathProcessOptions<B>, 'options'> & {
              options?: Omit<MathProcessOptions<B>['options'], 'transformers'>;
          };

/**
 * Return type of the
 * {@link MathHandler.configuration | `MathHandler.configuration`} getter.
 *
 * @typeParam B - The type of the math backend.
 */
export type FullMathConfiguration<B extends MathBackend> = B extends
    | 'mathjax'
    | 'katex'
    ? WithFullCssConfiguration<B> &
          WithTransformersRequiredNonNullable<B> &
          RequiredNotNullOrUndefined<
              Omit<MathConfiguration<B>, 'transformers' | 'css'>
          >
    : WithTransformersRequiredNonNullable<B> & MathConfiguration<B>;

export type PossibleMathCssApproach<B extends MathBackend> = B extends 'mathjax'
    ? 'hybrid' | 'none'
    : B extends 'katex'
      ? 'cdn' | 'hybrid' | 'none'
      : never;

/**
 * Type of the function that processes a tex string.
 *
 * @typeParam B - Math backend.
 */
export type MathProcessFn<B extends MathBackend> =
    /**
     * @param tex - The tex content to process, without delimiters (e.g. `x^2`).
     * @param options - Options describing how to process the tex content (e.g.,
     * whether to process it as inline or display math).
     * @param mathHandler - The math handler to use to process the tex.
     * @returns The processed tex, or a promise resolving to it.
     */
    (
        tex: string,
        options: MathProcessOptions<B>,
        mathHandler: MathHandler<B>,
    ) => string | Promise<string>;

/**
 * Type of the function that configures a {@link MathHandler | `MathHandler`}
 * instance with backend {@link B | `B`} .
 *
 * @typeParam B - Math backend.
 */
export type MathConfigureFn<B extends MathBackend> =
    /**
     * Function to configure a {@link MathHandler | `MathHandler`} instance.
     *
     * @param opts - The configuration options to apply to the math handler.
     * @param mathHandler - The math handler to configure.
     * @returns `void`, or a promise resolving to it.
     */
    (
        opts: MathConfiguration<B>,
        mathHandler: MathHandler<B>,
    ) => void | Promise<void>;

export type MathProcessOptions<B extends MathBackend> = B extends 'mathjax'
    ? {
          inline?: boolean | undefined;
          options?: Partial<MathjaxConversionOptions> | undefined;
      }
    : {
          inline?: boolean | undefined;
          options?: MathConfiguration<B> | undefined;
      };

// Compile-time unit tests

typeAssert<
    Equals<
        keyof MathConfiguration<'mathjax'>,
        keyof FullMathConfiguration<'mathjax'>
    >
>();

typeAssert<
    Equals<
        keyof MathConfiguration<'katex'>,
        keyof FullMathConfiguration<'katex'>
    >
>();

typeAssert<
    Equals<
        keyof MathConfiguration<'custom'>,
        keyof FullMathConfiguration<'custom'>
    >
>();

typeAssert<
    Equals<keyof MathConfiguration<'none'>, keyof FullMathConfiguration<'none'>>
>();
