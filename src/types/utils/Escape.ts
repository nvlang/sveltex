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
