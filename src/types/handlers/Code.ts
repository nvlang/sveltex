// Types
import type { CodeHandler } from '$handlers/CodeHandler.js';
import type { RequiredNonNullable, SimpleEscapeInstruction } from '$types';
import { CodeTheme, FullCodeTheme } from '$types/handlers/misc.js';

/**
 * Union type of supported code backends.
 */
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
 * - `escapeOnly`: `object`.
 * - `custom`: `object`.
 * - `none`: `object`.
 *
 * @remarks This is the type of the `processor` property of the code handler.
 */
export type CodeProcessor<B extends CodeBackend> = B extends 'highlight.js'
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
     *     wrapClassPrefix: 'abc-',
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
 * - `escapeOnly`: {@link SimpleEscapeInstruction | `SimpleEscapeInstruction`}.
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the code handler's
 * `configure` function, together with {@link GeneralCodeConfiguration | `GeneralCodeConfiguration`}.
 */
export type SpecificCodeConfiguration<B extends CodeBackend> =
    B extends 'highlight.js'
        ? Partial<import('highlight.js').HLJSOptions>
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

                /**
                 * Custom grammars to register.
                 */
                customLanguages?: import('@wooorm/starry-night').Grammar[];

                /**
                 * Options to pass to the `createStarryNight` function.
                 */
                // options?: import('@wooorm/starry-night').Options;
            }
          : B extends 'prismjs'
            ? { languages?: string[] | 'all' }
            : B extends 'escapeOnly'
              ? SimpleEscapeInstruction
              : B extends 'custom'
                ? Record<string, unknown>
                : B extends 'none'
                  ? Record<string, unknown>
                  : never;

export type ThemableCodeBackend = 'highlight.js' | 'starry-night';

type SpecificCodeAndThemeConfiguration<B extends CodeBackend> =
    B extends ThemableCodeBackend
        ? SpecificCodeConfiguration<B> & {
              /**
               * Configure the theme to use for syntax highlighting.
               */
              theme?: CodeTheme<B, 'cdn' | 'self-hosted' | 'none'> | undefined;
          }
        : SpecificCodeConfiguration<B>;

type FullSpecificCodeAndThemeConfiguration<B extends CodeBackend> =
    B extends ThemableCodeBackend
        ? SpecificCodeConfiguration<B> & {
              /**
               * Configure the theme to use for syntax highlighting.
               */
              theme: FullCodeTheme<B, 'cdn' | 'self-hosted' | 'none'>;
          }
        : SpecificCodeConfiguration<B>;

/**
 * Type of the input passed to the {@link CodeHandler | `CodeHandler`}'s
 * {@link CodeHandler.configure | `configure`} method.
 *
 * @typeParam B - Code backend.
 */
export type CodeConfiguration<B extends CodeBackend> =
    GeneralCodeConfiguration & SpecificCodeAndThemeConfiguration<B>;

/**
 * Return type of the {@link CodeHandler | `CodeHandler`}'s
 * {@link CodeHandler.configuration | `configuration`} getter.
 *
 * @typeParam B - Code backend.
 */
export type FullCodeConfiguration<B extends CodeBackend> =
    RequiredNonNullable<GeneralCodeConfiguration> &
        FullSpecificCodeAndThemeConfiguration<B>;

/**
 * Type of the {@link CodeHandler | `CodeHandler`}'s
 * {@link CodeHandler.process | `process`} function.
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

/**
 * Type of the options object that may be passed to the
 * {@link CodeHandler | `CodeHandler`}'s {@link CodeHandler.process | `process`}
 * function.
 */
export interface CodeProcessOptions {
    /**
     * The language of the code.
     *
     * @defaultValue Backend-specific, but generally speaking something like
     * `'plaintext'`.
     */
    lang?: string | undefined;

    /**
     * Whether to parse the code as inline or block.
     *
     * @defaultValue `false`
     */
    inline?: boolean | undefined;

    /**
     * Additional information to pass to the code handler. When set by
     * {@link CodeHandler.consumeDelims | `CodeHandler.consumeDelims`}, this is
     * the string following the language flag in a code block, or undefined if
     * no such string is present. How this property is used is
     * configuraton-specific. By default, it isn't used at all.
     */
    info?: string | undefined;

    /**
     * Whether to wrap the code in a `<code>` (or `<pre><code>`) tag or not.
     *
     * @defaultValue `true`
     * @internal
     */
    _wrap?: boolean | undefined;
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
