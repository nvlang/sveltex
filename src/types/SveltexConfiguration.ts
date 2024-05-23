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
    AdvancedTexBackend,
    AdvancedTexConfiguration,
    FullAdvancedTexConfiguration,
} from '$types/handlers/AdvancedTex.js';
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
    FullTexConfiguration,
    TexBackend,
    TexConfiguration,
} from '$types/handlers/Tex.js';
import type {
    FullVerbatimConfiguration,
    VerbatimConfiguration,
} from '$types/handlers/Verbatim.js';
import { TexEscapeSettings } from '$types/utils/Escape.js';
import type { RequiredNonNullable } from '$types/utils/utility-types.js';

/**
 * Supported TeX engines.
 */
export type SupportedTexEngine =
    | 'lualatex'
    | 'pdflatex'
    | 'tex'
    | 'latexmk'
    | 'lualatexmk';

export interface BackendChoices<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
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

    /* eslint-disable tsdoc/syntax */
    /**
     * Backend to use for processing code blocks and inline code snippets.
     *
     * The following backends escape special HTML characters and curly brackets
     * in code blocks:
     * - [`'highlight.js'`](https://github.com/highlightjs/highlight.js): Syntax
     *   highlighting with Highlight.js. Install:
     *
     * ```sh
     *       npm add -D highlight.js
     * ```
     *
     * - [`'starry-night'`](https://github.com/wooorm/starry-night): Syntax
     *   highlighting with Starry Night. Install:
     *
     * ```sh
     *       npm add -D "@wooorm/starry-night"
     * ```
     *
     * - [`'prismjs'`](https://github.com/PrismJS/prism): Syntax highlighting
     *   with Prism. Install:
     *
     * ```sh
     *       npm add -D prismjs
     * ```
     *
     * > ⚠ **Warning**: Prism is currently not well supported by SvelTeX, due to
     * > the fact that, at the time of writing, it doesn't yet use ES modules.
     * > As a result of this (and probably my lack of familiarity with Prism),
     * > Prism cannot load any languages or plugins within SvelTeX. Accordingly,
     * > I wouldn't recommend it for use with SvelTeX at the time of writing.
     *
     * - `'escapeOnly'`: Escape special HTML characters and curly brackets in
     *   code blocks, but don't apply syntax highlighting. By default, code
     *   blocks will be surrounded by `<pre><code>` tags, and inline code
     *   snippets will be surrounded by `<code>` tags.
     *
     * The following backends do not escape special HTML characters nor curly
     * brackets in code blocks:
     * - `'none'`: Leave code blocks as they are.
     *
     * Lastly, the following backend allows for custom code handling:
     * - `'custom'`: Use a custom `CodeHandler`.
     *
     * @defaultValue `'none'`
     */
    /* eslint-enable tsdoc/syntax */
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
    texBackend?: T | undefined;

    /**
     * Distribution to use to render "advanced" TeX blocks (e.g.,
     * `<TeX>\tikz{...}</TeX>` or `<TikZ>...</TikZ>`).
     *
     * - `'none'`: No distribution will be used.
     * - `'local'`: A local TeX distribution will be used.
     * - `'custom'`: *(Experimental, not recommended.)* A custom
     *   `AdvancedTexHandler` will be used.
     *
     * @remarks If `'local'` is selected, a local TeX distribution must be
     * installed. You can download a distribution from the [LaTeX
     * Project](https://www.latex-project.org/get/).
     *
     * @defaultValue `'none'`.
     */
    advancedTexBackend?: A | undefined;
}

/**
 * Sveltex configuration options.
 */
export interface SveltexConfiguration<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
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
     * Configuration options for the TeX processor (e.g., KaTeX or MathJax).
     * This is the TeX processor that will be used to, for example, render math
     * in SvelTeX files.
     *
     * ⚠ **Warning**: These options depend on the specific TeX backend in use.
     * For example, if you are using KaTeX, different options will be available
     * than if you are using MathJax. Similarly, the meanings of the options may
     * differ between backends, since they are taken directly from the backend
     * in question (or at most slightly adapted). For documentation of the
     * options beyond what IntelliSense may provide, please refer to the
     * documentation of the backend in question:
     *
     * - `katex`: [Docs](https://katex.org/docs/options.html) /
     *   [GitHub](https://github.com/KaTeX/KaTeX)
     * - `mathjax`: [Docs](https://docs.mathjax.org/en/latest/) /
     *   [GitHub](https://github.com/mathjax/MathJax-src)
     */
    tex?: TexConfiguration<T>;

    /**
     * Configuration options for the advanced TeX processor.
     */
    advancedTex?: AdvancedTexConfiguration<A>;

    /**
     *
     */
    verbatim?: VerbatimConfiguration;

    general?: {
        /**
         * Code which will surround the preprocessor output.
         *
         * @remarks Because of how SvelTeX works internally, these "delimiters"
         * can appear more than once within the output of a single file.
         *
         * @example
         * ```ts
         * {
         *     wrap: {
         *         begin: '<div class="sveltex-output">',
         *         end: '</div>',
         *     }
         * }
         * ```
         */
        wrap?:
            | undefined
            | {
                  /**
                   * @defaultValue `''` (empty string)
                   */
                  begin: string;

                  /**
                   * @defaultValue `''` (empty string)
                   */
                  end: string;
              };

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
        //  *         type: 'advancedTex',
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
        tex?: undefined | Omit<TexEscapeSettings, 'enabled'>;
    };
}

/**
 * Sveltex configuration options, with all properties required.
 */
export interface FullSveltexConfiguration<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
> {
    general: NonNullable<
        RequiredNonNullable<SveltexConfiguration<M, C, T, A>['general']>
    > & { tex: { enabled: boolean } };
    markdown: FullMarkdownConfiguration<M>;
    code: FullCodeConfiguration<C>;
    tex: FullTexConfiguration<T>;
    advancedTex: FullAdvancedTexConfiguration<A>;
    verbatim: FullVerbatimConfiguration;
}
