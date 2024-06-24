// File description: contains type definitions for the,`SveltexConfig`
// interface, which is used to configure the SvelTeX,preprocessor.

/* eslint-disable tsdoc/syntax */
/**
 * This file, `SveltexConfig.d.ts`, contains type definitions for the
 * `SveltexConfig` interface, which is used to configure the SvelTeX
 * preprocessor.
 *
 * Author: N. V. Lang GitHub: [nvlang](https://github.com/nvlang)
 *
 * @privateRemarks
 * The TSDoc comments in this file are very important for the IntelliSense the
 * user will see when configuring SvelTeX in their Svelte project.
 */

import type {
    TexConfiguration,
    FullTexConfiguration,
} from '$types/handlers/Tex.js';
import type {
    CodeBackend,
    CodeConfiguration,
    FullCodeConfiguration,
} from '$types/handlers/Code.js';
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
} from '$types/handlers/Markdown.js';
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
} from '$types/handlers/Math.js';
import type {
    FullVerbatimConfiguration,
    VerbatimConfiguration,
} from '$types/handlers/Verbatim.js';

/**
 * Supported TeX engines.
 */
export type SupportedTexEngine =
    | 'pdflatexmk'
    | 'lualatex'
    | 'lualatexmk'
    | 'pdflatex'
    | 'xelatex';
// | 'xelatexmk';

export interface BackendChoices<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
> {
    /**
     * Backend to use to parse Markdown. Affects extensibility.
     *
     * - [`'marked'`](https://npmjs.com/package/marked)
     *
     * ```sh
     *       npm add -D marked
     * ```
     *
     * - [`'markdown-it'`](https://npmjs.com/package/markdown-it)
     *
     * ```sh
     *       npm add -D markdown-it
     * ```
     *
     * - [`'micromark'`](https://npmjs.com/package/micromark)
     *
     * ```sh
     *       npm add -D micromark
     * ```
     *
     * - [`'unified'`](https://npmjs.com/package/unified) (with
     *   [`remark-parse`](https://npmjs.com/package/remark-parse),
     *   [`remark-rehype`](https://npmjs.com/package/remark-rehype),
     *   [`remark-retext`](https://www.npmjs.com/package/remark-retext),
     *   [`rehype-stringify`](https://npmjs.com/package/rehype-stringify), and
     *   [`@types/mdast`](https://npmjs.com/package/@types/mdast))
     *
     * ```sh
     *       npm add -D unified remark-parse remark-rehype remark-retext rehype-stringify "@types/mdast"
     * ```
     *
     *
     * @defaultValue
     * ```ts
     * 'none'
     * ```
     */
    markdownBackend?: M | undefined;

    /**
     * Backend to use for processing code blocks and inline code snippets.
     *
     * -   `'shiki'` _(recommended)_: Syntax highlighting with
     *     [Shiki](https://shiki.style/). Install:
     *
     * ```sh
     *       <pnpm|bun|npm|yarn> add -D shiki "@shikijs/transformers"
     * ```
     *
     * -   `'starry-night'`: Syntax highlighting with
     *     [`starry-night`](https://github.com/wooorm/starry-night). Install:
     *
     * ```sh
     *       <pnpm|bun|npm|yarn> add -D "@wooorm/starry-night" hast-util-find-and-replace hast-util-to-html
     * ```
     *
     * -   `'highlight.js'`: Syntax highlighting with
     *     [highlight.js](https://github.com/highlightjs/highlight.js). Install:
     *
     * ```sh
     *       <pnpm|bun|npm|yarn> add -D highlight.js
     * ```
     *
     * -   `'escape'`: Escape special HTML characters and curly brackets in
     *     code blocks, but don't apply syntax highlighting. By default, code
     *     blocks will be surrounded by `<pre><code>` tags, and inline code
     *     snippets will be surrounded by `<code>` tags.
     *
     * The following backends do not escape special HTML characters nor curly
     * brackets in code blocks:
     * -   `'none'`: Leave code blocks as they are. NB: Special HTML characters
     *     and curly brackets will _not_ be escaped with this backend, and code
     *     blocks or spans will _not_ be surrounded by any tags. Because SvelTeX
     *
     * @defaultValue
     * ```ts
     * 'none'
     * ```
     */
    codeBackend?: C | undefined;

    /* eslint-disable tsdoc/syntax */
    /**
     * Engine to use to render math (e.g., `$$x^2$$`).
     *
     * @defaultValue `'none'`.
     *
     * @remarks
     * -   `'katex'`: Install:
     *
     *     ```sh
     *     <pnpm|bun|npm|yarn> add -D katex
     *     ```
     *
     * -   `'mathjax'`: Install:
     *
     *     ```sh
     *     <pnpm|bun|npm|yarn> add -D mathjax
     *     ```
     */
    /* eslint-enable tsdoc/syntax */
    mathBackend?: T | undefined;
}

/**
 * Sveltex configuration options.
 */
export interface SveltexConfiguration<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
> {
    /**
     * Configuration options for the markdown processor.
     *
     * ⚠ **Warning**: These options, and their meaning, depend on the specific
     * markdown backend in use. For documentation of the options beyond what
     * IntelliSense may provide, please refer to the documentation of the
     * backend in question:
     * - `unified`: [Website](https://unifiedjs.com/) /
     *   [GitHub](https://github.com/unifiedjs/unified)
     * - `markdown-it`: [Docs](https://markdown-it.github.io/markdown-it/) /
     *   [GitHub](https://github.com/markdown-it/markdown-it)
     * - `micromark`: [GitHub](https://github.com/micromark/micromark)
     * - `marked`: [Docs](https://marked.js.org/using_advanced) /
     *   [GitHub](https://github.com/markedjs/marked)
     */
    markdown?: MarkdownConfiguration<M> | undefined;

    /**
     * Configuration options for the syntax highlighter.
     *
     * ⚠ **Warning**: These options, and their meaning, depend on the specific
     * "code backend" (i.e., syntax highlighter) in use. For documentation of
     * the options beyond what IntelliSense may provide, please refer to the
     * documentation of the backend in question:
     *
     * -   `shiki`: [Website](https://shiki.style) /
     *     [GitHub](https://github.com/shikijs/shiki)
     * -   `starry-night`: [GitHub](https://github.com/wooorm/starry-night)
     * -   `highlight.js`: [Docs](https://highlightjs.readthedocs.io/en/latest/)
     *     / [GitHub](https://github.com/highlightjs/highlight.js) /
     *     [Website](https://highlightjs.org)
     */
    code?: CodeConfiguration<C> | undefined;

    /**
     * Configuration options for the math processor (KaTeX or MathJax).
     *
     * ⚠ **Warning**: These options depend on the specific TeX backend in use.
     * For example, if you are using KaTeX, different options will be available
     * than if you are using MathJax. Similarly, the meanings of the options may
     * differ between backends, since they are taken directly from the backend
     * in question (or at most slightly adapted). For documentation of the
     * options beyond what IntelliSense may provide, please refer to the
     * documentation of the backend in question:
     *
     * -   `katex`: [Docs](https://katex.org/docs/options.html) /
     *     [GitHub](https://github.com/KaTeX/KaTeX)
     * -   `mathjax`: [Docs](https://docs.mathjax.org/en/latest/) /
     *     [GitHub](https://github.com/mathjax/MathJax-src)
     */
    math?: MathConfiguration<T> | undefined;

    /**
     * Configuration options for the TeX processor.
     */
    tex?: TexConfiguration | undefined;

    /**
     * Define "verbatim" environments. These are environments in which the
     * content is processed in a specified way by SvelTeX before being passed on
     * to the Svelte compiler. The content will not be processed by the
     * markdown, code, or math processor (with the exception that it may be
     * passed on to the code processor if the verbatim environment's `type` is
     * `'code'`).
     *
     * Define verbatim environments by providing a key-value pair where the key
     * is the name of the environment and the value is an object describing how
     * to process the content of the environment. The key will be used as the
     * HTML tag with which to identify the environment, though aliases can also
     * be configured.
     *
     * @example
     *
     * ```ts
     * {
     *     Example: {
     *         type: 'tex',
     *     },
     * }
     * ```
     *
     * Now, you can write the following in any Svelte file on which SvelTeX will
     * run:
     *
     * ```html
     * <Example ref="figure-1">
     * \begin{tikzpicture}
     *     \draw (0, 0) circle (1);
     * \end{tikzpicture}
     * </Example>
     * ```
     */
    verbatim?: VerbatimConfiguration | undefined;

    /**
     * File extensions which will be processed by the preprocessor.
     *
     * @remarks Be sure to include these in your `svelte.config.js` file.
     *
     * @defaultValue `['.sveltex']`
     */
    extensions?: undefined | `.${string}`[];
}

/**
 * Sveltex configuration options, with all properties required.
 */
export interface FullSveltexConfiguration<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
> {
    extensions: `.${string}`[];
    markdown: FullMarkdownConfiguration<M>;
    code: FullCodeConfiguration<C>;
    math: FullMathConfiguration<T>;
    tex: FullTexConfiguration;
    verbatim: FullVerbatimConfiguration;
}
