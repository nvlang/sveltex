# tree-sitter-sveltex

> [!WARNING]
> **This package is in alpha.** It is brand new and under active development.
> Its API, behaviour, and configuration may change at any time, and breaking
> changes should be expected before version `1.0.0`.

> [!IMPORTANT]
> **Node 22+ build note.** This grammar's `peerDependencies` lists
> [`tree-sitter`](https://www.npmjs.com/package/tree-sitter)`@^0.25.0`. On
> Node ≥ 22 the upstream `tree-sitter@0.25.0` package fails to compile from
> source because its `binding.gyp` pins `c++17` but Node 22's V8 headers
> require `c++20`. The fix lives on upstream master but has not been
> published. As a workaround, copy the one-line patch in
> [`patches/tree-sitter@0.25.0.patch`](https://github.com/nvlang/sveltex/blob/main/patches/tree-sitter@0.25.0.patch)
> into your own project's `patches/` directory and apply it via your package
> manager's patch mechanism (`pnpm` reads `patchedDependencies` in
> `pnpm-workspace.yaml`; `npm` uses [`patch-package`](https://www.npmjs.com/package/patch-package);
> `yarn` reads `resolutions` + `yarn patch`).
>
> A pre-built node binding for our own grammar **is** built from source on
> install via `node-gyp-build`, so once `tree-sitter` itself is installed
> (with the patch applied) everything else works.

A [tree-sitter] grammar for **SvelTeX** (`.sveltex`) documents.

A `.sveltex` file is a [Svelte](https://svelte.dev) component whose markup is
written in Markdown, with embedded LaTeX/math, fenced/inline code,
YAML/TOML/JSON frontmatter and SvelTeX "verbatim" environments. See the
[`@nvl/sveltex`](https://sveltex.dev) documentation for the language itself.

## Design

This grammar deliberately **does not reimplement Markdown, Svelte or LaTeX**.
It parses only the `.sveltex` *top-level* structure — the constructs a plain
Markdown grammar would mis-tokenise — and delegates every embedded language to
an existing grammar through [tree-sitter injections](queries/injections.scm):

| `.sveltex` construct | Grammar node(s) | Injected language |
| --- | --- | --- |
| YAML/TOML/JSON frontmatter | `frontmatter` / `frontmatter_content` | `yaml` / `toml` / `json` |
| Markdown prose | `markdown_chunk` | `markdown_sveltex` (combined) |
| Inline/display math `$…$`, `$$…$$`, `\(…\)`, `\[…\]` | `inline_math` / `display_math` | `latex` |
| `<tex>` / `<latex>` / `<tikz>` environments | `verbatim_environment` → `tex_verbatim_body` | `latex` (body), `svelte` (tags) |
| `<verb>` / `<verbatim>` environments | `verbatim_environment` → `plain_verbatim_body` | *(none — opaque)* |
| HTML / Svelte element tags `<div>`, `<Counter>`, `</p>`, `<br/>` | `html_open_tag` / `html_close_tag` / `html_self_closing_tag` | `svelte` (the element body is a fresh `markdown_chunk`) |
| Svelte mustache `{ expr }` | `svelte_expression` → `svelte_expression_body` | `javascript` |
| Svelte logic blocks `{#if}` / `{#each}` / `{#await}` / `{#key}` / `{#snippet}` (with `{:else}` / `{:then}` / `{:catch}` branches) | `svelte_block_*`, with named head fields (`iterable` / `binding` / `index` / `key`, `params`, `promise`) | `javascript` (expression slots) |
| Svelte `@`-commands `{@const}` / `{@html}` / `{@render}` / `{@debug}` / `{@attach}` | `svelte_at_*` | `javascript` |

Plain HTML / Svelte element tags are carved out of the Markdown stream as
standalone inline nodes, and Markdown flows *through* them: an element's body
becomes a fresh `markdown_chunk` rather than being suppressed as a CommonMark
"HTML block", and close tags become their own nodes so they can be highlighted
(`</div>`, which CommonMark leaves inert, is delegated to `svelte`). Svelte
mustache expressions, logic blocks and `@`-commands are likewise first-class
top-level constructs — previously absorbed into `markdown_chunk` — with named
fields for each block head's sub-parts so editors can inject JavaScript into
exactly the right slots.

Each `markdown_chunk` is delegated to the **vendored Markdown fork**
`markdown_sveltex` (see [`@nvl/tree-sitter-markdown-sveltex`](../tree-sitter-markdown-sveltex)),
not the editor's built-in CommonMark grammar; the fork in turn injects
`markdown_inline_sveltex`, the fenced-code languages, and `html` / `svelte`.

The split into `frontmatter` / `markdown` / `math` / `verbatim` mirrors the
`RegionKind`s the SvelTeX language server computes in
`packages/sveltex-language-server/src/core/regions.ts`.

### External scanner

`src/scanner.c` resolves the constructs an LR grammar cannot express:

- paired `$` / `$$` math fences (the same token opens and closes them);
- the matching `</tag>` of a verbatim environment, whose body is arbitrary
  text spanning many lines — the close tag must match the open tag
  (case-insensitively, like SvelTeX's own `</\1>` back-reference), so
  `<tex>…</latex>` is *not* closed by the wrong tag;
- the `---` / `+++` fences and body of frontmatter;
- HTML / Svelte element open / close / self-closing tags, and the maximal
  `markdown_chunk` runs that stop right before the next `.sveltex`-special
  token;
- Svelte mustache expressions, logic blocks and `@`-commands, tracking
  brace / paren / bracket nesting and string literals so inner punctuation
  (e.g. `{#each foo(a, b) as item}` or `{#await parse("a as b") then x}`)
  doesn't break boundary detection.

Crucially, the Markdown-chunk scanner **skips over fenced code blocks, inline
code spans and `<script>` / `<style>` blocks**, so a `$` inside any of those
(e.g. a `$state` rune, or `import x from '$lib/…'`) is *not* mistaken for a
math delimiter — matching SvelTeX's own escaper.

The scanner carries one small piece of state — the open verbatim tag name —
which it serializes and deserializes so that, under tree-sitter's speculative
parsing, a verbatim environment still closes only at its matching tag.

## Layout

```
grammar.js              the grammar definition
src/scanner.c           the external scanner
src/parser.c            the generated parser (committed; run `tree-sitter
                        generate` to regenerate)
queries/highlights.scm  syntax highlighting for the structural delimiters
queries/injections.scm  delegation to the embedded-language grammars
queries/folds.scm       foldable regions
test/corpus/            tree-sitter test corpus
```

## Development

```sh
npm install            # installs tree-sitter-cli
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse path/to/file.sveltex
```

## License

MIT
