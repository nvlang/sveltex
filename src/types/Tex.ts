import type { TexHandler } from '$handlers';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import type {
    MathjaxConfig,
    MathjaxConversionOptions,
} from '$types/utils/MathjaxOptions.js';

export type TexBackend =
    | 'katex'
    | 'mathjax-node'
    | 'mathjax-full'
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
    : B extends 'mathjax-full'
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
 * - `katex`: The module's `Options` type.
 * - `mathjax`: Type with an `options` property of type `MarkedOptions` and an
 *   `extensions` property of type `MarkedExtension[]`.
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the tex handler's
 * `configure` function.
 */
export type TexConfiguration<B extends TexBackend> = B extends 'katex'
    ? Omit<import('katex').KatexOptions, 'displayMode'>
    : B extends 'mathjax-full'
      ? {
            outputFormat?: 'svg' | 'chtml' | undefined;
            mathjaxConfig?: MathjaxConfig | undefined;
        }
      : B extends 'mathjax-node'
        ? {
              mathjaxNodeConfig?: import('mathjax-node').MathjaxNodeConfig;
              inputConfig?: Omit<
                  import('mathjax-node').TypesetInput,
                  'math' | 'format'
              >;
          }
        : B extends 'custom'
          ? Record<string, unknown>
          : B extends 'none'
            ? Record<string, unknown>
            : never;

export type FullTexConfiguration<B extends TexBackend> = TexConfiguration<B>;

/**
 * Type of the function that processes a tex string.
 *
 * @typeParam B - Tex backend.
 */
export type TexProcessFn<B extends TexBackend> =
    /**
     * @param tex - The tex to process.
     * @param inline - Whether to parse the tex as inline or block.
     * @param texHandler - The tex handler to use to process the tex.
     * @returns The processed tex, or a promise resolving to it.
     */
    (
        tex: string,
        options: TexProcessOptions<B>,
        texHandler: TexHandler<B>,
    ) => string | Promise<string>;

/**
 * Type of the function that configures a tex processor of the specified type.
 *
 * @typeParam B - Tex backend.
 */
export type TexConfigureFn<B extends TexBackend> = (
    opts: TexConfiguration<B>,
    texHandler: TexHandler<B>,
) => void | Promise<void>;

export type TexProcessOptions<B extends TexBackend> = B extends 'mathjax-full'
    ? {
          inline?: boolean | undefined;
          options?: Partial<MathjaxConversionOptions> | undefined;
      }
    : {
          inline?: boolean | undefined;
          options?: Partial<TexConfiguration<B>> | undefined;
      };

/**
 * Type of the factory function that creates a tex handler.
 * @typeParam B - Tex backend.
 * @returns A function that returns a promise that resolves to a tex
 * handler of the specified type.
 */
export type TexHandlerFactory<B extends TexBackend> = B extends 'custom'
    ? (
          processor: TexProcessor<B>,
          process: TexProcessFn<B>,
          configure: TexConfigureFn<B>,
          configuration: TexConfiguration<B>,
      ) => TexHandler<B> | Promise<TexHandler<B>>
    : (config?: TexConfiguration<B>) => TexHandler<B> | Promise<TexHandler<B>>;

/**
 * Object that maps the names of supported tex processors to a factory that
 * creates a tex handler of that type.
 */
export type TexHandlerFactories = {
    [B in TexBackend]: TexHandlerFactory<B>;
};
