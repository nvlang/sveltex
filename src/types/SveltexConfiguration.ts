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
import { TexEscapeSettings } from '$types/utils/Escape.js';
import type { RequiredNotNullOrUndefined } from '$types/utils/utility-types.js';

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
     *   [`remark-rehype`](https://npmjs.com/package/remark-rehype), and
     *   [`rehype-stringify`](https://npmjs.com/package/rehype-stringify))
     *
     * ```sh
     *       npm add -D unified remark-parse remark-rehype rehype-stringify
     * ```
     *
     *
     * @defaultValue `'none'`
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
     * -   `'escapeOnly'`: Escape special HTML characters and curly brackets in
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
     * Engine to use to render "basic" TeX blocks (e.g., `$x^2$`).
     *
     * @defaultValue `'none'`.
     *
     * @remarks
     * - `'katex'`:
     *   - Make sure you have `katex` installed as a devDependency (or regular
     *     dependency).
     *   - Make sure you include the [KaTeX CSS
     *     file](https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css)
     *     in your HTML file.
     *   - See also: https://katex.org/docs/browser.html
     *   - **NB**: If you're only using KaTeX within SvelTeX, you don't actually
     *     have to load any scripts for KaTeX, since the rendering will take
     *     place during preprocessing. This is also why it suffices to have
     *     KaTeX as a devDependency (as opposed to a regular dependency).
     * - `'mathjax'`:
     *   - Make sure you have `mathjax-full` installed as a devDependency (or
     *     regular dependency).
     *   - Make sure you include the MathJax CSS file in your HTML file.
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
     * Configuration options for the markdown parser (e.g., `marked`, `unified`,
     * `markdown-it`, or `micromark`).
     *
     * ⚠ **Warning**: These options, and their meaning, depend on the specific
     * markdown backend in use. For documentation of the options beyond what
     * IntelliSense may provide, please refer to the documentation of the
     * backend in question:
     * - `marked`: [Docs](https://marked.js.org/using_advanced) /
     *   [GitHub](https://github.com/markedjs/marked)
     * - `markdown-it`: [Docs](https://markdown-it.github.io/markdown-it/) /
     *   [GitHub](https://github.com/markdown-it/markdown-it)
     * - `micromark`: [GitHub](https://github.com/micromark/micromark)
     * - `unified`: [Website](https://unifiedjs.com/) /
     *   [GitHub](https://github.com/unifiedjs/unified)
     */
    markdown?: MarkdownConfiguration<M>;

    /**
     * Configuration options for the syntax highlighter (e.g., `highlight.js` or
     * `starry-night`).
     *
     * ⚠ **Warning**: These options, and their meaning, depend on the specific
     * "code backend" (i.e., syntax highlighter) in use. For documentation of
     * the options beyond what IntelliSense may provide, please refer to the
     * documentation of the backend in question:
     *
     * - `highlight.js`: [Docs](https://highlightjs.readthedocs.io/en/latest/) /
     *   [GitHub](https://github.com/highlightjs/highlight.js) /
     *   [Website](https://highlightjs.org)
     * - `starry-night`: [GitHub](https://github.com/wooorm/starry-night)
     * - `prismjs`: [Docs](https://prismjs.com/) /
     *   [GitHub](https://github.com/PrismJS/prism)
     */
    code?: CodeConfiguration<C>;

    /**
     * Configuration options for the TeX processor (KaTeX or MathJax). This is
     * the TeX processor that will be used to, for example, render math in
     * SvelTeX files.
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
    math?: MathConfiguration<T>;

    /**
     * Configuration options for the TeX processor.
     */
    tex?: TexConfiguration;

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
     *
     *     }
     * }
     * ```
     */
    verbatim?: VerbatimConfiguration;

    general?: {
        /**
         * File extensions which will be processed by the preprocessor.
         *
         * @remarks Be sure to include these in your `svelte.config.js` file.
         *
         * @defaultValue `['.sveltex']`
         */
        extensions?: undefined | `.${string}`[];

        // /**
        //  * Verbatim environments.
        //  *
        //  * @remarks The keys are the names of the environments, and the values
        //  * describe how to process the inner content of the environment.
        //  *
        //  * @example
        //  * ```ts
        //  * { Verbatim: { escapeBraces: true, escapeHtml: true } }
        //  * ```
        //  *
        //  * This environment would then be used as follows:
        //  * ```html
        //  * <Verbatim>
        //  * Content.
        //  * </Verbatim>
        //  * ```
        //  *
        //  * @defaultValue
        //  * ```ts
        //  * {
        //  *     Code: {
        //  *         type: 'code',
        //  *         defaultAttributes: {
        //  *             inline: false,
        //  *             lang: 'plaintext',
        //  *         }
        //  *     },
        //  *     TeX: {
        //  *         type: 'tex',
        //  *         aliases: ['tex', 'LaTeX', 'latex'],
        //  *         defaultAttributes: {
        //  *             inline: false,
        //  *         }
        //  *     }
        //  * }
        //  * ```
        //  */
        // verbatimEnvironments?:
        //     | undefined
        //     | Record<string, VerbatimEnvironmentConfiguration>;

        /**
         * General options surrounding SvelTeX's LaTeX support.
         */
        math?: undefined | Omit<TexEscapeSettings, 'enabled'>;
    };
}

/**
 * Sveltex configuration options, with all properties required.
 */
export interface FullSveltexConfiguration<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
> {
    general: NonNullable<
        RequiredNotNullOrUndefined<SveltexConfiguration<M, C, T>['general']>
    > & { math: { enabled: boolean } };
    markdown: FullMarkdownConfiguration<M>;
    code: FullCodeConfiguration<C>;
    math: FullMathConfiguration<T>;
    tex: FullTexConfiguration;
    verbatim: FullVerbatimConfiguration;
}
