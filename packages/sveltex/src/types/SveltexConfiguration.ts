// File description: contains type definitions for the,`SveltexConfig`
// interface, which is used to configure the SvelTeX,preprocessor.

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

import type { TexConfiguration, FullTexConfiguration } from './handlers/Tex.js';
import type {
    CodeBackend,
    CodeConfiguration,
    FullCodeConfiguration,
} from './handlers/Code.js';
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
} from './handlers/Markdown.js';
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
} from './handlers/Math.js';
import type {
    FullVerbatimConfiguration,
    VerbatimConfiguration,
} from './handlers/Verbatim.js';

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
     *   [`remark-retext`](https://www.npmjs.com/package/remark-retext), and
     *   [`rehype-stringify`](https://npmjs.com/package/rehype-stringify).
     *
     * ```sh
     *       npm add -D unified remark-parse remark-rehype remark-retext rehype-stringify
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
     *       <pnpm|bun|npm|yarn> add -D shiki
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
     *     <pnpm|bun|npm|yarn> add -D mathjax-full
     *     ```
     */
    mathBackend?: T | undefined;
}

/**
 * Controls which parts of the frontmatter block SvelTeX turns into generated
 * code.
 *
 * Every `.sveltex` file may begin with a _frontmatter_ block — metadata
 * delimited by `---` (YAML), `+++` (TOML), or a `---`-delimited block whose
 * opening fence reads `---json`. By default, SvelTeX uses that metadata in
 * three independent ways; each can be switched off here.
 *
 * Switching a step off never stops the frontmatter block from being parsed
 * and removed from the rendered output, and never stops the parsed values
 * from being handed to your markdown and math transformers — it only
 * suppresses the corresponding _generated code_.
 *
 * @see The {@link SveltexConfiguration.frontmatter | `frontmatter`} option,
 * which accepts this object (or a plain boolean).
 */
export interface FrontmatterConfiguration {
    /**
     * Whether to add a `<svelte:head>` block built from the frontmatter,
     * containing — wherever the corresponding keys are present — a `<title>`,
     * `<meta>`, `<link>`, `<base>`, and/or `<noscript>` element.
     *
     * Set this to `false` to keep full control over your document's `<head>`.
     * The frontmatter values remain available through the other frontmatter
     * steps — so you can, for instance, read `title` from the `metadata`
     * export and build a `<title>` that appends your site's name to it.
     *
     * @defaultValue `true`
     */
    head?: boolean | undefined;

    /**
     * Whether to add an `export const metadata = { ... }` statement to the
     * module script (`<script module>`), exposing the whole frontmatter as a
     * single object. This is what lets a SvelteKit `load` function — or any
     * module that imports the page — read the page's frontmatter.
     *
     * @defaultValue `true`
     */
    metadata?: boolean | undefined;

    /**
     * Whether to honor the special `imports` frontmatter key, which lets a
     * document declare `import` statements from within its frontmatter. When
     * enabled, those `import` statements are added to the instance script
     * (`<script>`).
     *
     * @defaultValue `true`
     */
    imports?: boolean | undefined;
}

/**
 * {@link FrontmatterConfiguration | `FrontmatterConfiguration`}, with all
 * properties required.
 */
export interface FullFrontmatterConfiguration {
    head: boolean;
    metadata: boolean;
    imports: boolean;
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
     * Configuration options for the **TeX-to-SVG pipeline** — the full
     * TeX toolchain SvelTeX uses to render `tex`-type
     * [verbatim environments](verbatim) (TikZ diagrams, commutative
     * diagrams, anything you would put inside a `standalone` document) to
     * static SVGs at build time. Distinct from the
     * {@link math | `math`} backend, which renders inline / display math
     * inside markdown with KaTeX or MathJax.
     *
     * Covers the TeX engine (`pdflatex`, `lualatex`, `xelatex`, …) and
     * its arguments; the SVG conversion step (`dvisvgm` or Poppler);
     * the output and cache directories; SVG optimisation (via
     * [SVGO](https://github.com/svg/svgo)); and console output
     * verbosity. See the
     * [TeX page](https://sveltex.dev/docs/tex) for the full reference.
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

    /**
     * Controls how SvelTeX processes the _frontmatter_ block at the top of a
     * `.sveltex` file.
     *
     * - `true` _(default)_: perform every frontmatter-processing step.
     * - `false`: disable frontmatter processing entirely. The block is still
     *   parsed and stripped from the output, and still handed to your
     *   transformers — but no code is generated from it.
     * - an object: enable or disable each step individually. See
     *   {@link FrontmatterConfiguration | `FrontmatterConfiguration`}.
     *
     * @example
     * Keep the frontmatter usable from your markup and `load` functions, but
     * stop SvelTeX from injecting a `<svelte:head>` — so you can build the
     * document's `<head>` yourself:
     *
     * ```ts
     * { frontmatter: { head: false } }
     * ```
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    frontmatter?: boolean | FrontmatterConfiguration | undefined;
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
    frontmatter: FullFrontmatterConfiguration;
}
