// Types
import type { TexHandler } from '$handlers';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import type {
    FirstTwoLevelsRequiredNotUndefined,
    MathjaxConfiguration,
    MathjaxConversionOptions,
    RequiredNonNullable,
} from '$types/utils';

/**
 * Supported TeX backends.
 */
export type TexBackend =
    | 'katex'
    | 'mathjax-node'
    | 'mathjax'
    | 'custom'
    | 'none';

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
      : B extends 'mathjax-node'
        ? object
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
 * - `mathjax-node`: Type with an optional `mathjaxNodeConfiguration` property
 *   of type
 *   [`MathjaxNodeConfig`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/4354a1088a2881bf6613b98c84d18e614f08705e/types/mathjax-node/index.d.ts#L539C18-L539C35)
 *   and an optional `inputConfiguration` property of type
 *   [`TypesetInput`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/4354a1088a2881bf6613b98c84d18e614f08705e/types/mathjax-node/index.d.ts#L9)
 *   (without the `math` and `format` properties, however, since those are
 *   dynamically set by Sveltex).
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the tex handler's
 * `configure` function.
 */
export type TexConfiguration<B extends TexBackend> = B extends 'katex'
    ? TexConfigurationBase & {
          katex?: Omit<import('katex').KatexOptions, 'displayMode'> | undefined;
      }
    : B extends 'mathjax'
      ? TexConfigurationBase & {
            outputFormat?: 'svg' | 'chtml' | undefined;
            mathjaxConfiguration?: MathjaxConfiguration | undefined;
        }
      : B extends 'mathjax-node'
        ? TexConfigurationBase & {
              mathjaxNodeConfiguration?: import('mathjax-node').MathjaxNodeConfig;
              inputConfiguration?: Omit<
                  import('mathjax-node').TypesetInput,
                  'math' | 'format'
              >;
          }
        : B extends 'custom'
          ? Record<string, unknown>
          : B extends 'none'
            ? Record<string, unknown>
            : never;

export interface TexConfigurationBase {
    css?: LocalCssConfiguration | undefined;
}

export interface LocalCssConfiguration {
    /**
     * @defaultValue `'src/sveltex'`
     */
    dir?: string | undefined;
    /**
     * @defaultValue `true`
     */
    write?: boolean | undefined;
    /**
     * Whether to import the CSS file to which {@link dir | `path`} points in
     * the Svelte component.
     *
     * @defaultValue `true`
     */
    read?: boolean | undefined;
}

export interface CdnCssConfiguration {
    type: 'cdn';
    /**
     * The URL of the CSS file to use.
     */
    url?: string | undefined;
    /**
     * Whether to import the CSS file to which {@link url | `url`} points in the
     * Svelte component.
     *
     * @defaultValue `true`
     */
    read?: boolean | undefined;
}

/**
 * Return type of the
 * {@link TexHandler.configuration | `TexHandler.configuration`} getter.
 *
 * @typeParam B - The type of the tex processor.
 * @returns If {@link B | `B`} is `'mathjax'` or `'mathjax-node'`, return
 * {@link TexConfiguration | `TexConfiguration<B>`} with all top-level
 * properties required and non-nullable. Otherwise, return
 * {@link TexConfiguration | `TexConfiguration<B>`} as-is.
 *
 * @remarks This is the type of the argument passed to the tex handler's
 * `configure` function.
 */
export type FullTexConfiguration<B extends TexBackend> = B extends
    | 'mathjax'
    | 'mathjax-node'
    | 'katex'
    ? RequiredNonNullable<TexConfiguration<B>> &
          FirstTwoLevelsRequiredNotUndefined<TexConfigurationBase>
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
