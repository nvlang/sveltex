// Types
import type { TexHandler } from '$handlers';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import type {
    MathjaxConfiguration,
    MathjaxConversionOptions,
    RequiredNonNullable,
} from '$types/utils';
import {
    FullKatexCssConfiguration,
    FullMathjaxCssConfiguration,
    KatexCssConfiguration,
    MathjaxCssConfiguration,
} from '$types/handlers/misc.js';

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
      ? MathDocument<unknown, unknown, unknown>
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
export type TexConfiguration<B extends TexBackend> = B extends 'katex'
    ? { css?: KatexCssConfiguration | undefined } & {
          katex?: Omit<import('katex').KatexOptions, 'displayMode'> | undefined;
      }
    : B extends 'mathjax'
      ? { css?: MathjaxCssConfiguration | undefined } & {
            outputFormat?: 'svg' | 'chtml' | undefined;
            mathjaxConfiguration?: MathjaxConfiguration | undefined;
        }
      : B extends 'custom'
        ? Record<string, unknown>
        : B extends 'none'
          ? Record<string, unknown>
          : never;

/**
 * Return type of the
 * {@link TexHandler.configuration | `TexHandler.configuration`} getter.
 *
 * @typeParam B - The type of the tex backend.
 */
export type FullTexConfiguration<B extends TexBackend> = B extends 'mathjax'
    ? RequiredNonNullable<TexConfiguration<B>> & {
          css: FullMathjaxCssConfiguration;
      }
    : B extends 'katex'
      ? RequiredNonNullable<TexConfiguration<B>> & {
            css: FullKatexCssConfiguration;
        }
      : TexConfiguration<B>;

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
export type TexConfigureFn<B extends TexBackend> =
    /**
     * Function to configure a {@link TexHandler | `TexHandler`} instance.
     *
     * @param opts - The configuration options to apply to the tex handler.
     * @param texHandler - The tex handler to configure.
     * @returns `void`, or a promise resolving to it.
     */
    (
        opts: TexConfiguration<B>,
        texHandler: TexHandler<B>,
    ) => void | Promise<void>;

export type TexProcessOptions<B extends TexBackend> = B extends 'mathjax'
    ? {
          inline?: boolean | undefined;
          options?: Partial<MathjaxConversionOptions> | undefined;
      }
    : {
          inline?: boolean | undefined;
          options?: TexConfiguration<B> | undefined;
      };
