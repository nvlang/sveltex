/* eslint-disable tsdoc/syntax */
import type { CodeProcessOptionsBase } from '$types/handlers/Code.js';
import type { MathBackend, MathProcessOptions } from '$types/handlers/Math.js';
import type { VerbatimProcessOptions } from '$types/handlers/Verbatim.js';
import type { Offsets } from '$types/utils/Ast.js';

/**
 * Vernacular:
 * - "snippet": A small segment (or fragment, part, excerpt... or, indeed,
 *   snippet) of a document that should be escaped and processed by a handler
 *   other than the markdown processor.
 * - "escaped snippet": A snippet that has been replaced with a UUID.
 * - "processed snippet": An escaped snippet that has been processed by a
 *   handler.
 */

export type InterpretedAttributes = Record<
    string,
    string | number | boolean | null | undefined
>;

export interface ParsedComponent {
    innerContent: string;
    selfClosing: boolean;
    attributes: InterpretedAttributes;
    tag: string;
}

export interface ProcessableSnippet<T extends SnippetType> {
    /**
     * The "inner" content of the snippet, i.e., the content that should be
     * passed, as-is, as the first argument of the appropriate handler's
     * `process` function. At the very least, this means that `innerContent`
     * should lack the outermost delimiters of the snippet.
     */
    innerContent: string;

    /**
     * Object that contains options that should be passed as the second argument
     * of the `process` function of the handler that should process the snippet.
     * For example, for a fenced code block, this could be the language tag and
     * the meta string, alongside `inline: false` to indicate that the
     * `innerContent` should be processed as a code block, not a code span.
     */
    optionsForProcessor: T extends 'code'
        ? CodeProcessOptionsBase
        : T extends 'math'
          ? MathProcessOptions<MathBackend>
          : T extends 'verbatim'
            ? Omit<VerbatimProcessOptions, 'filename'>
            : T extends 'frontmatter'
              ? {
                    /**
                     * @internal
                     * @defaultValue
                     * ```ts
                     * 'yaml'
                     * ```
                     */
                    type: 'yaml' | 'toml' | 'json';
                }
              : undefined;
}

export type PaddingInstruction =
    | boolean
    | string
    | number
    | [string | boolean | number, string | boolean | number];

export interface EscapeOptions {
    /**
     * Whether (or how) to pad the UUID generated for the snippet when inserting
     * it into the document.
     */
    pad?: PaddingInstruction | undefined;
    /**
     * Whether to include hyphens in the UUID generated for the snippet.
     *
     * @defaultValue `true`
     */
    hyphens?: boolean | undefined;
}

export interface UnescapeOptions {
    /**
     * Sveltex escapes "snippets" by replacing them with UUIDs before running
     * the markdown processor. This can often result in the UUIDs being wrapped
     * in paragraph tags. Setting this option to `true` will remove such tags,
     * if present.
     */
    removeParagraphTag: boolean;
}

/**
 * Description of a "snippet" in the original document.
 */
export interface OriginalSnippet<T extends SnippetType> {
    /**
     * The location of the snippet in the original document.
     * - `start` is the index of the first character of the snippet.
     * - `end` is the index of the character immediately following the
     *   snippet.
     */
    loc: Offsets;

    /**
     * The original content of the snippet, including the delimiters etc.
     * Essentially just the slice of the original document at
     * {@link loc | `loc`}.
     */
    outerContent: T extends 'svelte' | 'mustacheTag' | 'verbatim'
        ? string
        : string | undefined;
}

export type SnippetType =
    | 'math'
    | 'code'
    | 'svelte'
    | 'mustacheTag'
    | 'verbatim'
    | 'frontmatter';

export interface ProcessedSnippet {
    processed: string;
    unescapeOptions: UnescapeOptions;
}

export interface EscapableSnippet<T extends SnippetType = SnippetType>
    extends Snippet<T> {
    escapeOptions?: EscapeOptions | undefined;
    unescapeOptions?: UnescapeOptions | undefined;
}

export interface EscapedSnippet<T extends SnippetType = SnippetType>
    extends Snippet<T> {
    unescapeOptions?: UnescapeOptions | undefined;
}

export type ProcessableSnippetType =
    | 'code'
    | 'math'
    | 'verbatim'
    | 'frontmatter';

/**
 * A small segment (or fragment, part, excerpt... or, indeed, snippet) of a
 * document that should be escaped and processed by a handler other than the
 * markdown processor.
 */
export interface Snippet<T extends SnippetType = SnippetType> {
    /**
     * Snippet type. This is used to determine which handler, if any, should
     * process the snippet. Possible values are:
     * - `'math'`: Some TeX code to be rendered by MathJax or KaTeX.
     * - `'code'`: A code span or a fenced code block. This is forwarded to the
     *   `CodeHandler`.
     * - `'verbatim'`: A verbatim environment. This is forwarded to the
     *   `VerbatimHandler`, which checks for some errors and then may forward
     *   the snippet to:
     *   - `TexHandler`, if the verbatim environment was set up as a TeX
     *     component.
     *   - `CodeHandler`, if the verbatim environment was set up with
     *     `type` set to `code`.
     *   - Otherwise: the `VerbatimHandler` will take care of the processing
     *     itself (this is the case for `type` values `noop`,
     *     `escape`).
     * - `'mustacheTag'`: A mustache tag, like `{...}`.
     * - `'svelte'`: Svelte syntax (other than mustache tags), like
     *   `{@html ...}`, `{#if ...}`, `<svelte:head>`, `<script>`, `<style>`,
     *   etc.
     */
    type: T;
    /**
     * Describes the snippet in the original document.
     * - `loc` is the location of the snippet in the original document (given by
     *   the `start` and `end` offsets, i.e., the `indexOf` of the snippet and
     *   the `indexOf` of the snippet plus the snippet length, respectively).
     * - `outerContent` is the original content of the snippet, including the
     *   delimiters etc. Essentially just the slice of the original document at
     *   `loc`.
     */
    original: OriginalSnippet<T>;

    /**
     * Describes some basic properties of the snippet that were parsed by the
     * `escape` function.
     */
    processable: T extends ProcessableSnippetType
        ? ProcessableSnippet<T>
        : undefined;
}

export interface TexEscapeSettings {
    /**
     * @internal
     */
    enabled: boolean;

    /**
     * Enable or disable delimiters beyond `$$...$$` (or `$$$...$$$`,
     * `$$$$...$$$$`, etc.).
     */
    delims?: {
        /**
         * Delimiters that can be enabled or disabled whose content will always
         * be treated as _inline_ math.
         */
        inline?: {
            /**
             * TODO: Improve documentation here.
             *
             * Whether `$...$` should be treated as math (`true`) or not
             * (`false`).
             *
             * @remarks
             * You can always write `\$` to escape a dollar sign outside of math
             * mode. Inside of math mode, this won't work, but there are a few
             * possible remedies:
             *
             * -   If this option is set to `false`, you can surround the inline
             *     math with _n_ ≥ 2 dollar signs, and then use up to _n_ - 1
             *     consecutive dollar signs inside the math without having to
             *     worry about escaping them. This mirrors the behavior of
             *     backticks in markdown. For example: `$$\text{Let $x = 2$}$$`.
             *     Note, however, that `\n$$\n123\n$$\n` will be rendered as
             *     display math.
             *
             * @defaultValue
             * ```
             * true
             * ```
             */
            singleDollar?: boolean;

            /**
             * Whether `\(...\)` should be treated as math (`true`) or regular
             * text (`false`). If it _is_ interpreted as math, it will always be
             * interpreted as inline math.
             *
             * @defaultValue
             * ```
             * true
             * ```
             */
            escapedParentheses?: boolean;
        };
        /**
         * Delimiters that can be enabled or disabled whose content will always
         * be treated as _display_ math.
         */
        display?: {
            /**
             * Whether `\[...\]` should be treated as math (`true`) or regular
             * text (`false`). If it _is_ interpreted as math, it will always be
             * interpreted as display math.
             *
             * @defaultValue
             * ```
             * true
             * ```
             */
            escapedSquareBrackets?: boolean;
        };
    };
    /**
     * Controls when dollar-delimited math should be treated as display
     * math.
     *
     * - `'always'`: Always display `$$...$$` as display math.
     * - `'newline'`: Display `$$...$$` as display math iff it's on its own
     *   line(s) (i.e., if it matches `/^\s*\$\$.*?\$\$\s*$/msu`).
     * - `'fenced'`: Display `$$...$$` as display math iff the opening and
     *   closing delimiters each have an entire line for themselves.
     *
     * @defaultValue `'fenced'`
     *
     * @example
     * Consider the following markdown:
     *
     * ```md
     * text $$ a $$ text
     *
     * $$ b $$
     *
     * $$
     * c
     * $$
     * ```
     *
     * The following table shows how the `isDisplayMath` setting would
     * affect the rendering of the math blocks:
     *
     * |     | `'always'` | `'newline'` | `'fenced'` |
     * |-----|:----------:|:-----------:|:----------:|
     * | `a` | display    | inline      | inline     |
     * | `b` | display    | display     | inline     |
     * | `c` | display    | display     | display    |
     */
    doubleDollarSignsDisplay?: 'always' | 'newline' | 'fenced' | undefined;
}

export interface DirectiveEscapeSettings {
    /**
     * Whether markdown directives are being used in the document. In
     * particular, this setting should be set to `true` iff you're using curly
     * braces (`{...}`) in your markdown that are _not_ part of a Svelte
     * mustache tag, Svelte element directive, Svelte logic block, code block,
     * code span, math, or verbatim environment.
     *
     * @remarks
     * SvelTeX does _not_ actually transform markdown directives itself; this
     * must still be done by the markdown processor, which will usually require
     * some sort of plugin / extension.
     *
     * For some context on markdown directives, see:
     * - [Discussion in CommonMark
     *   forum](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444)
     * - [Description of directives
     *   syntax](https://www.npmjs.com/package/micromark-extension-directive#syntax)
     *   used in the `micromark-extension-directive` package. SvelTeX uses
     *   `micromark-extension-directive` internally to determine whether
     *   something should be interpreted as a directive or not.
     *
     * @see {@link bracesArePartOfDirective | `bracesArePartOfDirective`}
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    enabled?: boolean | undefined;

    /**
     * If {@link enabled | `markdown.directives.enabled`} is `true`, SvelTeX
     * uses
     * [`micromark-extension-directive`](https://www.npmjs.com/package/micromark-extension-directive)
     * internally to determine whether a pair of braces should be considered
     * part of a directive or not. I personally like the syntax for directives
     * proposed there, but for some it might feel too strict. Since, as far as I
     * know, there is no official spec regarding directives, it mostly just
     * boils down to personal preference (and whatever the tools you're using
     * expect). Accordingly, this setting is provided for those that may want to
     * loosen the syntax. (Note: You can't use this setting to make the syntax
     * _more_ strict.)
     *
     * If this setting is set to a function, said function will be used to
     * determine whether matched pairs of braces encountered in the document
     * should be considered part of a directive or not.
     *
     * @remarks
     * If set to `null`, this will be effectively equivalent to `() => false`.
     *
     * @remarks
     * ⚠ **Warning**: If you make the syntax for directives looser than that of
     * whatever plugin you're passing to your markdown processor to handle
     * directives, you can get unexpected results. For example, if you set this
     * setting to `() => true`, and are using
     * [`remark-directive`](https://github.com/remarkjs/remark-directive) (which
     * follows the same syntax for directives as
     * `micromark-extension-directive`) then the following markdown...
     *
     * ```markdown
     * ::: example { 1*2*3 }
     * text
     * :::
     * ```
     *
     * ...would become...
     *
     * ```html
     * <p>::: example { 1<em>2</em>3 }
     * text
     * :::</p>
     * ```
     *
     * ...before it is passed to the Svelte compiler. This is not only probably
     * not what you want, but also not valid Svelte, since `1<em>2</em>3` is not
     * valid JavaScript.
     *
     * @example
     * Suppose the following markdown is encountered:
     *
     * ```markdown
     * text 1
     * ::: directive {#id .class key=value}
     * content
     * :::
     * text 2
     * ```
     *
     * Then, in order to decide whether `{#id .class key=value}` should be
     * considered a Svelte mustache tag (in which case it would be escaped
     * before the markdown processor gets a chance to parse it) or a part of a
     * directive (in which case it wouldn't be escaped, so that the markdown
     * parser can parse it), the `bracesArePartOfDirective` function would be
     * called with the following arguments:
     *
     * ```ts
     * bracesArePartOfDirective({
     *     document: 'text 1\n'
     *         + '::: directive {#id .class key=value}\n'
     *         + 'content\n'
     *         + ':::\n'
     *         + 'text 2',
     *     innerContent: '#id .class key=value',
     *     loc: { start: 21, end: 42 },
     * });
     * ```
     *
     * Note that the `loc` object contains character offsets, and that
     * `document.slice(loc.start, loc.end)` would return the string `'{#id
     * .class key=value}'`, i.e., would include the braces.
     *
     * @example
     * The following function would _partially_ imitate the syntax of
     * `micromark-extension-directive`:
     *
     * ```ts
     * const bracesArePartOfDirective = ({
     *     document,
     *     loc,
     * }: {
     *     document: string;
     *     loc: { start: number; end: number };
     * }) => {
     *     const { end } = loc;
     *     const trimmed = document.slice(0, end);
     *     return directiveRegex.test(trimmed);
     * };
     * ```
     *
     * In the above, `directiveRegex` would be the following regex (presented
     * here in the extended regex format for readability):
     *
     * ```
     * (?:                 # -: directive must be preceded by whitespace or
     *                     #    start of string
     *     ^               # (start of string)
     *   | \s              # (whitespace)
     * )
     * :+                  # (colon, ≥1 times, greedy)
     * [a-zA-Z]            # (directive name must start with a letter)
     * (?:                 # -: rest of directive name
     *     [a-zA-Z0-9]*    # (directive name can be alphanumeric...)
     *   | [\w-]*          # (...and contain hyphens or underscores...)
     *     [a-zA-Z0-9]     # (...as long as it doesn't end with one)
     * )
     * (?:                 # -: optional label part
     *     \[              # (opening bracket)
     *     [^              # (not...)
     *         \]          # (...a closing bracket...)
     *         \r\n?       # (...or newline)
     *     ]*              # (≥0 times, greedy)
     *     \]              # (closing bracket)
     * )?
     * \{                  # (opening brace)
     *     [^              # (not...)
     *         \}          # (...a closing bracket...)
     *         \r\n?       # (...or newline)
     *     ]*              # (≥0 times, greedy)
     * \}                  # (closing brace)
     * $                   # (end of string)
     * ```
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    bracesArePartOfDirective?:
        | ((info: {
              document: string;
              innerContent: string;
              loc: { start: number; end: number };
          }) => boolean)
        | undefined
        | null;
}
