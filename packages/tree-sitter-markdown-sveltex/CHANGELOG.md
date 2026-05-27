# @nvl/tree-sitter-markdown-sveltex

## 0.4.0

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

### Patch Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`e3b3b0c`](https://github.com/nvlang/sveltex/commit/e3b3b0cae26e195f739469dfe8e91bbe03f5d626)
  Thanks [@nvlang](https://github.com/nvlang)! - Fix the Node binding for the
  forked Markdown grammar so it can be loaded at all. `bindings/node/binding.cc`
  still called the upstream entry points `tree_sitter_markdown()` /
  `tree_sitter_markdown_inline()`, but the fork renamed its grammars to
  `markdown_sveltex` / `markdown_inline_sveltex`, so the actual exported symbols
  are `tree_sitter_markdown_sveltex()` /
  `tree_sitter_markdown_inline_sveltex()`. On macOS the undefined references
  linked anyway (flat-namespace bundle) and resolved to a null pointer, so any
  Node consumer segfaulted on `require`. The binding now calls the suffixed
  symbols.

    Also adds a markdown-level grammar parity bench
    (`packages/tree-sitter-sveltex/scripts/parity-markdown.mjs`, dev-only) that
    compares the SvelTeX TextMate grammar against the tree-sitter Markdown stack
    over the CommonMark and GFM specs, a seeded fuzzer, and real-world READMEs,
    running both the fork and a clean upstream `tree-sitter-markdown@9a23c1a` to
    quantify what the fork's two CommonMark deviations fix.
