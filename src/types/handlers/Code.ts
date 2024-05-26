// Types
import type { HighlightJsThemeName, StarryNightThemeName } from '$data/code.js';
import type { CodeHandler } from '$handlers/CodeHandler.js';
import type { SimpleEscapeInstruction } from '$types/handlers/Verbatim.js';
import type { CssConfiguration } from '$types/handlers/misc.js';
import type { RequiredNonNullable } from '$types/utils/utility-types.js';

/**
 * Union type of supported code backends.
 */
export type CodeBackend =
    | 'highlight.js'
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
    : B extends 'starry-night'
      ? Awaited<
            ReturnType<typeof import('@wooorm/starry-night').createStarryNight>
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
              options: FullCodeProcessOptions & { wrapClassPrefix: string },
          ) => [string, string]);
}

/**
 * Type of the configuration object used to configure the code processor.
 *
 * @typeParam B - Syntax highlighting backend.
 * @returns Depending on `B`:
 * - `highlight.js`: The module's `HLJSOptions` type.
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
              theme?: CodeTheme<B> | undefined;
          }
        : SpecificCodeConfiguration<B>;

type FullSpecificCodeAndThemeConfiguration<B extends CodeBackend> =
    B extends ThemableCodeBackend
        ? SpecificCodeConfiguration<B> & {
              /**
               * Configure the theme to use for syntax highlighting.
               */
              theme: FullCodeTheme<B>;
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
 *
 */
export type FullCodeProcessOptions = RequiredNonNullable<
    Omit<CodeProcessOptions, 'info' | 'lang'>
> &
    Pick<CodeProcessOptions, 'info' | 'lang'>;

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

export type FullCodeTheme<
    B extends CodeBackend,
    T extends 'cdn' | 'self-hosted' | 'none' = 'cdn' | 'self-hosted' | 'none',
> = RequiredNonNullable<CodeTheme<B, T>>;

export type CodeTheme<
    B extends CodeBackend,
    T extends 'cdn' | 'self-hosted' | 'none' = 'cdn' | 'self-hosted' | 'none',
> = {
    /**
     * - `'cdn'`: Load the theme's stylesheet from a CDN with a `<link>` tag in
     *   `<svelte:head>`.
     * - `'self-hosted'`: Fetch the theme's stylesheet from a CDN once, write it
     *   to the local filesystem, and then import it with a `<link>` tag in
     *   `<svelte:head>`. Cache invalidation goes by the filename, which in turn
     *   might depend on the code backend's semver version string. This means
     *   that manual modifications to the stylesheet will always be preserved,
     *   since new versions of the stylesheet will have different filenames. It
     *   furthermore enables the user to customize the stylesheet to their
     *   liking and have those changes persist across updates by simply renaming
     *   the stylesheet in accordance with the version of the code backend
     *   currently in use.
     * - `'none'`: Do none of the above.
     */
    type?: T | undefined;
} & CssConfiguration<T> &
    CodeThemeWithoutCssConfiguration<B>;

export interface CodeThemeWithoutCssConfiguration<B extends CodeBackend> {
    /**
     * Name of the theme to use.
     *
     * @defaultValue `'default'`
     */
    name?:
        | (B extends 'starry-night'
              ? StarryNightThemeName
              : B extends 'highlight.js'
                ? HighlightJsThemeName
                : never)
        | undefined;

    /**
     * - `'light'`: Fetch the light theme.
     * - `'dark'`: Fetch the dark theme.
     * - `'both'`: Fetch CSS file that uses
     *   [`prefers-color-scheme`](https://developer.mozilla.org/docs/Web/CSS/%40media/prefers-color-scheme)
     *   to dynamically pick the theme mode.
     *
     * @defaultValue `'both'`
     * @remarks Only applicable to `starry-night` themes.
     */
    mode?: B extends 'starry-night' ? 'light' | 'dark' | 'both' : never;

    /**
     * Whether to fetch the minified version of the theme.
     *
     * @defaultValue `true`
     */
    min?: B extends 'highlight.js' ? boolean | undefined : never;
}
