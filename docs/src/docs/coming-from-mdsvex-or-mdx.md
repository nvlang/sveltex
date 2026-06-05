---
title: Coming from mdsvex or MDX
description: Reusing a remark/rehype setup from mdsvex or MDX, and the SvelTeX-specific details to know.
---

# Coming from mdsvex or MDX

[mdsvex] and [MDX] are both built on the [unified] (remark/rehype) ecosystem,
which SvelTeX supports too. With the `unified` markdown backend, most of an
existing setup carries over; the rest of this page covers the parts that differ.

## Reusing your remark/rehype plugins

Pick the `unified` backend and move your `remarkPlugins` and `rehypePlugins`
across — they take the same [`PluggableList`](https://github.com/unifiedjs/unified#pluggablelist)
shape (a plugin, or a `[plugin, options]` tuple) that mdsvex and MDX use, and run
at the same point in the pipeline. `remarkRehypeOptions`, `rehypeStringifyOptions`,
and `retextPlugins` are available too.

```js
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';

export default await sveltex(
    { markdownBackend: 'unified', codeBackend: 'shiki', mathBackend: 'katex' },
    {
        markdown: {
            remarkPlugins: [remarkToc],
            rehypePlugins: [rehypeSlug],
        },
    },
);
```

Drop these from what you bring over, since SvelTeX does the work itself and a
plugin would duplicate or fight it:

-   **math** plugins (`remark-math` with `rehype-katex` or `rehype-mathjax`) —
    handled by the [`mathBackend`](math);
-   **syntax-highlighting** plugins (e.g. `rehype-prism`, `rehype-pretty-code`) —
    handled by the [`codeBackend`](code);
-   **`remark-gfm`** — SvelTeX enables GFM for the `unified` backend already (see
    [Markdown](markdown#commonmark-differences));
-   anything that turns on **MDX/JSX syntax** — it conflicts with SvelTeX's own
    parsing (see the warning under [Markdown › Configuration](markdown#configuration)).

To remap rendered Markdown elements (say, `h1` → your own component), use a
`rehype` plugin — the same approach available in mdsvex. SvelTeX has no
`MDXProvider`-style component map.

## Setup

```js
// svelte.config.js
const config = {
    extensions: ['.svelte', '.sveltex'],
    preprocess: [
        await sveltex(/* … */), // async; two arguments; before vitePreprocess
    ],
};
```

`sveltex(...)` is **async** (so `await` it) and takes **two** arguments — the
backend choices first, then the configuration. List it **before** other markup
preprocessors such as `vitePreprocess`. See [Getting Started](getting-started#setup);
the `sv` add-on wires this up for you.

## Layouts

SvelTeX has no `layout` option. A `.sveltex` file is treated exactly like a
regular `.svelte` file, except that SvelTeX preprocesses it first (so a route
page is, for instance, `+page.sveltex`); wrap routes with SvelteKit's
`+layout.svelte` as you would for any `.svelte` page, which nests per directory.
The frontmatter is available as the
[`metadata`](markdown#metadata-export) export, and SvelTeX builds the page's
[`<svelte:head>`](markdown#head-elements) from it by default.

## Frontmatter

Like mdsvex, SvelTeX exposes the frontmatter as a `metadata` export; read values
with `{metadata.title}` (or `{metadata['some-key']}`). It parses YAML, TOML, and
JSON — the format is chosen by the opening fence: `---` for YAML, `---toml` for
TOML, `---json` for JSON (all close with `---`).

```sveltex
---toml
title = "Example"
---
```

Each of the three steps — the `<svelte:head>`, the `metadata` export, and the
`imports` key — can be toggled via the
[`frontmatter`](markdown#disabling-frontmatter-processing) option.

## Syntax highlighting

Choose a [`codeBackend`](code) — Shiki, starry-night, or highlight.js — and
SvelTeX manages the theme CSS. Because SvelTeX runs the highlighter itself, don't
also add a Markdown highlighting plugin.

## Math

SvelTeX renders `$…$` and `$$…$$` with a [`mathBackend`](math) (KaTeX or MathJax)
and compiles the [`<tex>`](tex) / `<tikz>` components to SVG with a local TeX
distribution — so you don't wire up `remark-math` yourself.

The delimiters are configurable through [`math.delims`](math): set
`delims.dollars` to `false` to leave `$…$`/`$$…$$` to the Markdown processor
entirely, or `delims.inline.singleDollar` to `false` to keep `$$…$$` while
treating single `$` as ordinary text. `\(…\)` and `\[…\]` have their own toggles.

To print a literal dollar sign outside math, escape it: `\$`. Inside math, where
`\$` doesn't apply, fence the expression with _n_ ≥ 2 dollar signs and use up to
_n_ − 1 dollars inside — e.g. `$$\text{Let $x = 2$}$$` — mirroring how backticks
work in Markdown.

## Markdown dialect

SvelTeX turns off two CommonMark constructs to stay predictable next to component
markup: **indented code blocks** (mdsvex and MDX do this too) and **autolinks**
like `<https://…>` (as MDX does). Use fenced code blocks and explicit
`[links](…)` instead. See [CommonMark differences](markdown#commonmark-differences).

[mdsvex]: https://mdsvex.pngwn.io/
[MDX]: https://mdxjs.com/
[unified]: https://unifiedjs.com/
