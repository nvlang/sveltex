# @nvl/tree-sitter-sveltex

## 0.3.0

### Minor Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`41a1541`](https://github.com/nvlang/sveltex/commit/41a15416e69d85b476a8180977085d0d088bb43a)
  Thanks [@nvlang](https://github.com/nvlang)! - Vendor a forked tree-sitter
  Markdown grammar and inject it in place of the editor's built-in CommonMark
  grammar.

    The new `@nvl/tree-sitter-markdown-sveltex` package is the upstream
    `tree-sitter-grammars/tree-sitter-markdown` split grammar (block + inline)
    at rev `9a23c1a` — the same rev Zed pins for its built-in — with two SvelTeX
    deviations from CommonMark and renamed grammars (`markdown_sveltex`,
    `markdown_inline_sveltex`) so they do not clash with the editor's built-in
    `markdown`/`markdown-inline`:
    - indented code blocks are disabled, so 4-space-indented prose stays a
      paragraph (and its inline markup keeps rendering) instead of becoming a
      code block; and
    - underscore emphasis ending in a digit (`_italic 1_`, `_italic1_`) is now
      recognised, while intraword `_` between alphanumerics (`snake_case`,
      `1_2`) stays non-emphasis per CommonMark.

    HTML blocks (`<script>`/`<style>`/`<pre>` and comments), fenced code and all
    other CommonMark behaviour are unchanged. The `.sveltex` grammar now
    delegates each `markdown_chunk` to `markdown_sveltex` rather than the
    built-in `markdown`.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`049ca07`](https://github.com/nvlang/sveltex/commit/049ca07d96ffb1502e00ce58704d6eaa9919594d)
  Thanks [@nvlang](https://github.com/nvlang)! - Carve plain HTML / Svelte
  element tags (`<div>`, `<Counter>`, `</p>`, `<br/>`) out of the Markdown
  stream as standalone inline nodes, leaving each element's body as a fresh
  `markdown_chunk`. This is a deliberate departure from CommonMark's "HTML
  block" rule: Markdown now flows _through_ the tags (the body gets its own
  Markdown injection instead of being suppressed), and close tags become their
  own nodes so they can be injected to `svelte` and highlighted. Void elements,
  self-closing components, and intentionally unclosed/mismatched tags all parse
  without forcing well-nesting.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`8987115`](https://github.com/nvlang/sveltex/commit/8987115c548d21f480d8e8a84e08c6d2a038df81)
  Thanks [@nvlang](https://github.com/nvlang)! - Parse Svelte mustache
  expressions, block tags, and `@`-commands as first-class top-level constructs
  (previously absorbed into `markdown_chunk`):
    - `{ … }` mustache expressions (`svelte_expression_body` for JS injection)
    - `{#if}`/`{#each}`/`{#await}`/`{#key}`/`{#snippet}` blocks with named
      fields for each head's sub-parts (`{#each}` → `iterable`/`binding`/
      `index`/`key`; `{#snippet}` → `name`/`params`; `{#await}` →
      `promise`/`keyword`/`binding`)
    - `{:else}`/`{:else if}`/`{:then}`/`{:catch}` continuation branches
    - `{@const}`/`{@html}`/`{@render}`/`{@debug}`/`{@attach}` commands
    - bindingless `{#each items}` / `{#each items, index}` (chess-board form)

    The external scanner tracks brace/paren/bracket nesting and string literals
    so inner punctuation in `{#each foo(a, b) as item}` or
    `{#await parse("foo as bar") then x}` doesn't break the boundary detection.
    All block-tag delimiters share a `svelte_block_tag` alias for a single
    highlight query.

    README note about the upstream `tree-sitter@0.25.0` build patch needed on
    Node 22+ (see `patches/tree-sitter@0.25.0.patch`).

### Patch Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`2280b0d`](https://github.com/nvlang/sveltex/commit/2280b0ddd8f5b6ce27d6d1619cd2d57289c6667d)
  Thanks [@nvlang](https://github.com/nvlang)! - Add a browser-readable HTML
  companion to the markdown parity bench
  (`packages/tree-sitter-sveltex/scripts/parity-markdown-html.mjs`, dev-only,
  `pnpm parity:markdown:html`). For each corpus example it renders three
  side-by-side panels — TextMate, the tree-sitter fork, and clean upstream —
  each showing the source as syntax-highlighting coloured by the shared parity
  kind, so a span one grammar tags `emphasis` but another leaves plain (or tags
  `html-block`) shows up as a column-to-column colour difference, with divergent
  runs underlined. The report defaults to TM-vs-fork divergent examples grouped
  into collapsible per-corpus sections with an overview stats table and a JS
  toggle for full-parity examples; it is self-contained (inline CSS + JS).

    To keep HTML iteration cheap, tokenization is dumped to a JSON cache first
    and the HTML is rendered from that cache (`--render-only` re-renders in well
    under a second). The script imports `parity-markdown.mjs`'s tokenizers and
    classifiers rather than re-deriving the kind mappings, so the colours and
    the numeric report can never disagree. The report and its cache are
    gitignored.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`8cb8a4d`](https://github.com/nvlang/sveltex/commit/8cb8a4d2fdf4b96cce295d87bd6a7aabd74c0de5)
  Thanks [@nvlang](https://github.com/nvlang)! - Fix an unsigned-integer
  underflow in the external scanner's `{#each … as BINDING}` and `(KEY)` /
  `(PARAMS)` scanners: an unbalanced `}` or `)` inside the binding/key (e.g.
  `{#each x as [a}]}`) drove a depth counter below zero, making the scanner
  swallow the rest of the document into a single error node. The brace/paren
  decrements are now guarded like their sibling bracket cases.

    Also widens the scanner's fixed tag-name buffer (32 → 64 bytes) so a long
    element/component name is recognised rather than silently treated as plain
    text; an over-long name still falls through safely to "not a tag".

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`30af4e3`](https://github.com/nvlang/sveltex/commit/30af4e3d5bfab9cbaa91c04756fbbb456a30ed0f)
  Thanks [@nvlang](https://github.com/nvlang)! - Require a verbatim
  environment's close tag to match its open tag, the way SvelTeX's own
  back-referenced `</\1>` matching does. Previously any verbatim close tag ended
  the environment, so `<tex>…</latex>` parsed as a complete (LaTeX-highlighted)
  `tex` environment even though SvelTeX would not compile it as one. Now the
  body runs until the matching `</tex>` (compared case-insensitively, like
  SvelTeX's `i` flag): a non-matching `</latex>` is part of the body, and an
  environment with no matching close is left incomplete — matching how SvelTeX
  actually parses the source. The external scanner records the open tag name
  (and is now serialized/deserialized) to enforce this.

## 0.2.0

### Minor Changes

- [`716a0a2`](https://github.com/nvlang/sveltex/commit/716a0a2bf61ad3e8b9afaa1daa13b19dc18e065b)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/tree-sitter-sveltex`.

    A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
    `.sveltex` documents. The grammar parses the top-level structure (YAML /
    TOML / JSON frontmatter, Markdown prose, inline / display math, `<tex>` /
    `<latex>` / `<tikz>` and `<verb>` / `<verbatim>` environments) and delegates
    every embedded language to an existing grammar via
    [tree-sitter injections](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html#language-injection):
    Markdown to `tree-sitter-markdown`, math and `tex`-type verbatim bodies to
    `tree-sitter-latex`, frontmatter to the appropriate data-format grammar.

    The split into `frontmatter` / `markdown` / `math` / `verbatim` mirrors the
    `RegionKind`s the SvelTeX language server computes. The grammar is used by
    the bundled Zed extension and any other editor whose highlighting pipeline
    accepts tree-sitter grammars.
