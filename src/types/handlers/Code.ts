/* eslint-disable tsdoc/syntax */
// Types
import type {
    HighlightJsLanguage,
    HighlightJsThemeName,
    StarryNightLanguage,
    StarryNightThemeName,
} from '$data/code.js';
import type { SimpleEscapeInstruction } from '$types/handlers/Verbatim.js';
import type { CssConfiguration } from '$types/handlers/Css.js';
import type {
    DeepRequiredDefined,
    RequiredDefinedNotNull,
    StringLiteralUnion,
} from '$types/utils/utility-types.js';
import type { Transformers } from '$types/handlers/Handler.js';

/**
 * Union type of supported code backends.
 */
export type CodeBackend =
    | 'highlight.js'
    | 'starry-night'
    | 'shiki'
    | 'escape'
    | 'none';

interface CommonCodeConfiguration {
    /**
     * Whether to add a class to the `<code>` tag with the name of the language
     * of the code it contains. If a string is provided, a class will be added
     * and the provided string will be used as the prefix for the class name.
     *
     * @defaultValue
     * ```ts
     * 'language-'
     * ```
     *
     * @example
     * ```html
     * <pre><code class="language-javascript">
     * ...
     * </code></pre>
     * ```
     */
    addLanguageClass?: boolean | string | undefined;

    /**
     * Transformers to apply to
     * - the inner content of the input which `CodeHandler` will receive for
     *   processing, or to
     * - the inner content of the output produced by the `CodeHandler` (or by
     *   whatever handler it forwards the content to).
     */
    transformers?: Transformers<CodeProcessOptionsBase> | undefined;

    /**
     * Sveltex supports inline code highlighting, provided that the inline code
     * span contains a special string of some sort that acts as a language tag
     * and possibly meta string. However, the question is what part of the
     * inline code span should be considered to be this special string (if any).
     *
     * Unfortunately, as far as I'm aware, there is no widespread convention for
     * this, let alone a formal specification. As such, this option allows you
     * to specify a custom function that will be used to extract the special
     * string from the inline code span:
     *
     * @param inlineCode - The inner content of the code span (i.e., if the code
     * span is `` `example` ``, it would receive the string `'example'`).
     * @param validLanguageTag - A function that takes a string and returns
     * `true` if that string is a valid language tag for the current code
     * handler, or `false` otherwise. Aliases defined in `langAlias` are also
     * taken into account.
     *
     * @returns An object with the following properties:
     *
     * - `lang?: string`: The language tag, if any.
     * - `meta?: string`: The meta string, if any.
     * - `code: string`: The code that should be highlighted.
     *
     * @remarks
     * Since this function only receives the inner content of the code span,
     * syntaxes such as `` `code`{js} `` are not supported.
     *
     * @defaultValue
     * ```ts
     * (inlineCode, validLanguageTag) => {
     *     let code = inlineCode;
     *     let lang: string | undefined;
     *     let meta: string | undefined;
     *     if (code.startsWith('{')) {
     *         const m = code.match(/^\{(.+?)\}\s(\s*\S[\w\W]*)$/);
     *         const specialCandidate = m?.[1];
     *         const codeCandidate = m?.[2];
     *         if (specialCandidate && codeCandidate) {
     *             const space = specialCandidate.match(/\s/)?.index;
     *             const tag = specialCandidate.slice(0, space);
     *             if (validLanguageTag(tag)) {
     *                 code = codeCandidate;
     *                 lang = tag;
     *                 if (space) meta = specialCandidate.slice(space + 1);
     *             }
     *         }
     *     } else {
     *         const m = code.match(/^([\w-]['\w-]*)\s(\s*\S[\w\W]*)$/);
     *         const tag = m?.[1];
     *         const codeCandidate = m?.[2];
     *         if (tag && codeCandidate && validLanguageTag(tag)) {
     *             code = codeCandidate;
     *             lang = tag;
     *         }
     *     }
     *     return { code, lang, meta };
     * };
     * ```
     */
    inlineMeta?:
        | ((
              inlineCode: string,
              validLanguageTag: (tag: string) => boolean,
          ) =>
              | {
                    lang?: string | undefined;
                    meta?: string | undefined;
                    code: string;
                }
              | null
              | undefined)
        | undefined
        | null;

    /**
     * Whether to append a newline to code blocks. Should have no visual impact
     * whatsoever, as `<pre><code>example</code></pre>` and
     * `<pre><code>example\n</code></pre>` render identically. Defaults to
     * `true` for the sake of CommonMark compliance.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    appendNewline?: boolean | undefined;
}

/**
 * Type of the configuration object used to configure the code processor.
 *
 * @typeParam B - Syntax highlighting backend.
 * @returns Depending on `B`:
 * - `highlight.js`: The module's `HLJSOptions` type.
 * - `starry-night`: `{ customLanguages?: Grammar[]; options?: Options }`, where
 *   `Options` and `Grammar` are types from the `@wooorm/starry-night` module.
 * - `escape`: {@link SimpleEscapeInstruction | `SimpleEscapeInstruction`}.
 * - `custom`: `Record<string, unknown>`.
 * - `none`: `Record<string, unknown>`.
 *
 * @remarks This is the type of the argument passed to the code handler's
 * `configure` function, together with {@link CommonCodeConfiguration | `GeneralCodeConfiguration`}.
 */
type SpecificCodeConfiguration<B extends CodeBackend> = B extends 'highlight.js'
    ? HighlightJsConfig
    : B extends 'starry-night'
      ? StarryNightConfig
      : B extends 'shiki'
        ? ShikiConfig
        : B extends 'escape'
          ? {
                escape?: SimpleEscapeInstruction | undefined;
            }
          : B extends 'none'
            ? object
            : never;

interface HighlightJsConfig {
    /**
     * Configure the theme to use for syntax highlighting.
     */
    theme?: CodeTheme<'highlight.js'> | undefined;

    /**
     * Options to pass to the `highlight` function from
     * `highlight.js`.
     */
    'highlight.js'?:
        | Partial<
              Omit<
                  import('highlight.js').HLJSOptions,
                  'noHighlightRe' | 'languageDetectRe'
              >
          >
        | undefined;

    /**
     * Record of language aliases.
     *
     * @example
     * ```ts
     * {
     *    'example-alias': 'JavaScript',
     * }
     * ```
     */
    langAlias?:
        | Record<string, StringLiteralUnion<HighlightJsLanguage>>
        | undefined;
}

interface StarryNightConfig {
    /**
     * Configure the theme to use for syntax highlighting.
     */
    theme?: CodeTheme<'starry-night'> | undefined;

    /**
     * Languages to register. If `'all'`, all languages are
     * registered. If `'common'`, some ≈35 common languages are
     * registered.
     *
     * If an array is provided, each entry will be treated as a
     * language or custom grammar to register. Furthermore, the
     * first entry of the array may be `'all'` or `'common'` to
     * extend the respective sets of languages.
     *
     * @defaultValue
     * ```ts
     * 'common'
     * ```
     */
    languages?:
        | (StarryNightLanguage | import('@wooorm/starry-night').Grammar)[]
        | [
              'common',
              ...(
                  | StarryNightLanguage
                  | import('@wooorm/starry-night').Grammar
              )[],
          ]
        | 'common'
        | ['all', ...import('@wooorm/starry-night').Grammar[]]
        | 'all'
        | undefined;

    /**
     * Default language.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    lang?: StarryNightLanguage | null | undefined;

    /**
     * Record of language aliases.
     *
     * @example
     * ```ts
     * {
     *    'example-alias': 'JavaScript',
     * }
     * ```
     */
    langAlias?:
        | Record<string, StringLiteralUnion<StarryNightLanguage>>
        | undefined;
}

interface ShikiConfig {
    /**
     * Default options for Shiki's highlighter.
     */
    shiki?:
        | (Omit<
              Partial<
                  import('shiki').CodeToHastOptions<
                      import('shiki').BundledLanguage,
                      import('shiki').BundledTheme
                  >
              >,
              'structure'
          > &
              // For some reason, the `theme` and `themes` props disappear after
              // `Omit`ting them from the `CodeToHastOptions` type, so we have
              // to add them again.
              Partial<
                  import('shiki').CodeOptionsThemes<
                      import('shiki').BundledTheme
                  >
              >)
        | undefined;

    /**
     * Customize how the meta string is parsed, if present. The result will be
     * merged into the `meta` prop that is passed to any plugins/transformers in
     * Shiki's pipeline.
     *
     * @defaultValue
     * ```ts
     * (metaString) => {
     *     return Object.fromEntries(
     *         metaString
     *             .split(' ')
     *             .reduce(
     *                 (
     *                     prev: [string, boolean | string][],
     *                     curr: string,
     *                 ) => {
     *                     const [key, value] = curr.split('=');
     *                     const isNormalKey =
     *                         key && /^[A-Z0-9]+$/i.test(key);
     *                     if (isNormalKey)
     *                         prev = [...prev, [key, value ?? true]];
     *                     return prev;
     *                 },
     *                 [],
     *             ),
     *     );
     * }
     * ```
     *
     * @example
     * Consider the following code block:
     *
     * ````md
     * ```js key1=value1 key2 key3=false
     * console.log('Hello, world!');
     * ```
     * ````
     *
     * The meta string is `'key1=value key2 key3=false'`, and the default
     * `parseMetaString` function will parse the meta string as follows:
     *
     * ```ts
     * {
     *     key1: 'value1',
     *     key2: true,
     *     key3: 'false'
     * }
     * ```
     */
    parseMetaString?:
        | ((
              metaString: string,
              code: string,
              lang: string,
          ) => Record<string, unknown> | undefined | null)
        | undefined
        | null;

    /**
     * Record of language aliases.
     *
     * @example
     * ```ts
     * {
     *    'example-alias': 'javascript',
     * }
     * ```
     */
    langAlias?:
        | Record<string, StringLiteralUnion<import('shiki').BundledLanguage>>
        | undefined;
}

export type CodeBackendWithCss = 'highlight.js' | 'starry-night';

/**
 * Type of the input passed to the {@link CodeHandler | `CodeHandler`}'s
 * {@link CodeHandler.configure | `configure`} method.
 *
 * @typeParam B - Code backend.
 */
export type CodeConfiguration<B extends CodeBackend> = CommonCodeConfiguration &
    SpecificCodeConfiguration<B>;

/**
 * Return type of the {@link CodeHandler | `CodeHandler`}'s `configuration`
 * getter.
 *
 * @typeParam B - Code backend.
 */
export type FullCodeConfiguration<B extends CodeBackend> =
    DeepRequiredDefined<CommonCodeConfiguration> &
        (B extends CodeBackendWithCss
            ? Omit<SpecificCodeConfiguration<B>, 'theme'> & {
                  theme: FullCodeTheme<B>;
              }
            : // Shiki's configuration specifies that either `theme` or `themes`
              // be set, but not both. This is by design, and it's good for the
              // user (intellisense, type safety, etc.), but unfortunately, TS
              // is making it very difficult to work with implementation-wise.
              // In particular, I've found it often complaining about `theme`
              // or `themes` not being a property of the Shiki configuration,
              // presumably because, well, only one of them can be a property of
              // the configuration, and which one that is cannot be determined a
              // priori. Because of this, I'm modifying the configuration type
              // to make it weaker; instead of
              // `... & ({ theme: ... } | { themes: ... })`, I'm changing it to
              // `... & { theme?: ... } & { themes?: ... }`. This comes with the
              // caveat of requiring some added care to ensure that the behavior
              // that the stronger type dictated is still enforced, but has the
              // benefit of making TS complain less.
              B extends 'shiki'
              ? SpecificCodeConfiguration<B> & {
                    shiki: Partial<
                        import('shiki').CodeOptionsMultipleThemes<
                            import('shiki').BundledTheme
                        >
                    > &
                        Partial<
                            import('shiki').CodeOptionsSingleTheme<
                                import('shiki').BundledTheme
                            >
                        >;
                }
              : B extends 'escape'
                ? DeepRequiredDefined<SpecificCodeConfiguration<B>>
                : SpecificCodeConfiguration<B>);
/**
 * Type of the {@link CodeHandler | `CodeHandler`}'s `process` function.
 *
 * @typeParam  B - Code backend.
 */
export type CodeProcessFn =
    /**
     * @param code - The code to process.
     * @param inline - Whether to parse the code as inline or block.
     * @returns The processed code, or a promise resolving to it.
     */
    (code: string, options: CodeProcessOptionsBase) => string | Promise<string>;

/**
 * Type of the options object that may be passed to the
 * {@link CodeHandler | `CodeHandler`}'s `process` function.
 */
export interface CodeProcessOptionsBase {
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
    metaString?: string | undefined;
}

export type FullCodeTheme<
    B extends CodeBackendWithCss,
    T extends 'cdn' | 'self-hosted' | 'none' = 'cdn' | 'self-hosted' | 'none',
> = RequiredDefinedNotNull<CodeTheme<B, T>>;

type CodeTheme<
    B extends CodeBackendWithCss,
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
    (B extends 'starry-night'
        ? CodeThemeConfigStarryNight
        : CodeThemeConfigHighlightJs);

interface CodeThemeConfigStarryNight {
    /**
     * Name of the theme to use.
     *
     * @defaultValue `'default'`
     */
    name?: StarryNightThemeName | undefined;

    /**
     * - `'light'`: Fetch the light theme.
     * - `'dark'`: Fetch the dark theme.
     * - `'both'`: Fetch CSS file that uses
     *   [`prefers-color-scheme`](https://developer.mozilla.org/docs/Web/CSS/%40media/prefers-color-scheme)
     *   to dynamically pick the theme mode.
     *
     * @defaultValue `'both'`
     */
    mode?: 'light' | 'dark' | 'both' | undefined;
}

interface CodeThemeConfigHighlightJs {
    /**
     * Name of the theme to use.
     *
     * @defaultValue `'default'`
     */
    name?: HighlightJsThemeName | undefined;

    /**
     * Whether to fetch the minified version of the theme.
     *
     * @defaultValue `true`
     */
    min?: boolean | undefined;
}
