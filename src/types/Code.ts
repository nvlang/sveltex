import type { CodeHandler } from '$handlers';
import { SimpleEscapeInstruction } from './SveltexConfig.js';
import type { RequiredNonNullable } from '$types';

export type CodeBackend =
    | 'highlight.js'
    | 'prismjs'
    | 'starry-night'
    | 'escapeOnly'
    | 'custom'
    | 'none';

/**
 * Type of the processor used to parse code.
 *
 * @typeParam B - Syntax highlighting backend.
 * @returns Depending on `B`:
 * - `highlight.js`: The module's `HLJSApi` type.
 * - `prismjs`: `{prism: Prism; loadLanguages: LoadLanguages }`, where `Prism`
 *   and `LoadLanguages` are types from the `prismjs` module.
 * - `starry-night`: Awaited return type of the module's `createStarryNight`
 *   function.
 * - `custom`: `unknown`.
 * - `none`: `null`.
 *
 * @remarks This is the type of the `processor` property of the code handler.
 */
export type CodeProcessorOf<B extends CodeBackend> = B extends 'highlight.js'
    ? import('highlight.js').HLJSApi
    : B extends 'prismjs'
      ? {
            prism: typeof import('prismjs');
            loadLanguages: typeof import('prismjs/components');
        }
      : B extends 'starry-night'
        ? Awaited<
              ReturnType<
                  typeof import('@wooorm/starry-night').createStarryNight
              >
          >
        : B extends 'escapeOnly'
          ? object
          : B extends 'custom'
            ? object
            : B extends 'none'
              ? object
              : never;

export interface GeneralCodeConfiguration {
    /**
     * Prefix to use for the language class name of the wrapper tag(s).
     *
     * @defaultValue
     * ```ts
     * 'language-'
     * ```
     *
     * @example
     * Setting
     *
     * ```ts
     * {
     *     classPrefix: 'abc-',
     * }
     * ```
     *
     * will result in output like
     *
     * ```html
     * <pre><code class="abc-javascript">
     * ...
     * </code></pre>
     * ```
     *
     */
    wrapClassPrefix?: string | undefined;

    /**
     * Defines what HTML tags (or, more generally, strings) to use to wrap code
     * found in SvelTeX markdown.
     */
    wrap?:
        | undefined
        | ((
              options: CodeProcessOptions & { wrapClassPrefix: string },
          ) => [string, string]);
}

/**
 * Type of the configuration object used to configure the code processor.
 *
 * @typeParam B - Syntax highlighting backend.
 * @returns Depending on `B`:
 * - `highlight.js`: The module's `HLJSOptions` type.
 * - `prismjs`: `{ plugins?: string[]; languages?: string[] | 'all' }`.
 * - `starry-night`: `{ customLanguages?: Grammar[]; options?: Options }`, where
 *   `Options` and `Grammar` are types from the `@wooorm/starry-night` module.
 * - `custom`: `unknown`.
 * - `none`: `null`.
 *
 * @remarks This is the type of the argument passed to the code handler's
 * `configure` function, together with {@link GeneralCodeConfiguration | `GeneralCodeConfiguration`}.
 */
export type SpecificCodeConfiguration<B extends CodeBackend> =
    B extends 'highlight.js'
        ? Partial<import('highlight.js').HLJSOptions>
        : B extends 'prismjs'
          ? { languages?: string[] | 'all' }
          : B extends 'starry-night'
            ? {
                  /**
                   * Languages to register. If `'all'`, all languages are
                   * registered. If `'common'`, some ≈35 common languages are
                   * registered.
                   *
                   * If an array of strings is provided, each string should be a
                   * scope name to register. The supported scope names can be found
                   * on the `starry-night`
                   * [README](https://github.com/wooorm/starry-night/?tab=readme-ov-file#languages)
                   * on GitHub.
                   *
                   * @remarks The scopes upon which any given scope depends will be
                   * registered automatically.
                   *
                   * @defaultValue None.
                   */
                  languages?: string[] | 'all' | 'common';
                  customLanguages?: import('@wooorm/starry-night').Grammar[];
                  options?: import('@wooorm/starry-night').Options;
              }
            : B extends 'escapeOnly'
              ? SimpleEscapeInstruction & {
                    /**
                     * What HTML tags (or, more generally, strings) to use to wrap
                     * code found in SvelTeX markdown.
                     *
                     * A function can also be provided that takes the code (before
                     * escaping it) and the parsed
                     * {@link CodeProcessOptions | `CodeProcessOptions`} as input
                     * and returns an array of two strings to use as the opening and
                     * closing tags, respectively.
                     *
                     * @remarks
                     * Setting this to `undefined` will activate the default
                     * wrapping; setting it to `null` will disable wrapping.
                     *
                     * @defaultValue
                     * ```ts
                     * {
                     *     inline: ['<code>', '</code>'],
                     *     block: ['<pre><code>', '</code></pre>'],
                     * }
                     * ```
                     */
                    // wrap?:
                    //     | WrapDescription
                    //     | { inline: WrapDescription; block: WrapDescription }
                    //     | undefined
                    //     | null;
                }
              : B extends 'custom'
                ? Record<string, unknown>
                : B extends 'none'
                  ? Record<string, unknown>
                  : never;

export type CodeConfiguration<B extends CodeBackend> =
    GeneralCodeConfiguration & SpecificCodeConfiguration<B>;

export type FullCodeConfiguration<B extends CodeBackend> =
    RequiredNonNullable<GeneralCodeConfiguration> &
        SpecificCodeConfiguration<B>;

/**
 * Type of the function that processes a code string.
 *
 * @typeParam B - Code backend.
 */
export type CodeProcessFn<B extends CodeBackend> =
    /**
     * @param code - The code to process.
     * @param inline - Whether to parse the code as inline or block.
     * @param codeHandler - The code handler to use to process the
     * code.
     * @returns The processed code, or a promise resolving to it.
     */
    (
        code: string,
        options: CodeProcessOptions | undefined,
        codeHandler: CodeHandler<B>,
    ) => string | Promise<string>;

export interface CodeProcessOptions {
    lang?: string | undefined;
    inline?: boolean | undefined;
    info?: string | undefined;
}

/**
 * Type of the function that configures a code processor of the specified
 * type.
 *
 * @typeParam B - Code backend.
 */
export type CodeConfigureFn<B extends CodeBackend> = (
    config: CodeConfiguration<B>,
    codeHandler: CodeHandler<B>,
) => void | Promise<void>;

/**
 * Type of the factory function that creates a code handler.
 * @typeParam B - Code backend.
 * @returns A function that returns a promise that resolves to a code
 * handler of the specified type.
 */
export type CodeHandlerFactory<B extends CodeBackend> = B extends 'custom'
    ? (
          processor: CodeProcessorOf<B>,
          process: CodeProcessFn<B>,
          configure: CodeConfigureFn<B>,
          configuration: SpecificCodeConfiguration<B>,
      ) => CodeHandler<B> | Promise<CodeHandler<B>>
    : (
          config?: SpecificCodeConfiguration<B>,
      ) => CodeHandler<B> | Promise<CodeHandler<B>>;

/**
 * Object that maps the names of supported code processors to a factory that
 * creates a code handler of that type.
 */
export type CodeHandlerFactories = {
    [B in CodeBackend]: CodeHandlerFactory<B>;
};
