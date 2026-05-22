---
'@nvl/tree-sitter-markdown-sveltex': minor
'@nvl/tree-sitter-sveltex': minor
---

Vendor a forked tree-sitter Markdown grammar and inject it in place of the
editor's built-in CommonMark grammar.

The new `@nvl/tree-sitter-markdown-sveltex` package is the upstream
`tree-sitter-grammars/tree-sitter-markdown` split grammar (block + inline) at
rev `9a23c1a` — the same rev Zed pins for its built-in — with two SvelTeX
deviations from CommonMark and renamed grammars (`markdown_sveltex`,
`markdown_inline_sveltex`) so they do not clash with the editor's built-in
`markdown`/`markdown-inline`:

- indented code blocks are disabled, so 4-space-indented prose stays a
  paragraph (and its inline markup keeps rendering) instead of becoming a
  code block; and
- underscore emphasis ending in a digit (`_italic 1_`, `_italic1_`) is now
  recognised, while intraword `_` between alphanumerics (`snake_case`, `1_2`)
  stays non-emphasis per CommonMark.

HTML blocks (`<script>`/`<style>`/`<pre>` and comments), fenced code and all
other CommonMark behaviour are unchanged. The `.sveltex` grammar now delegates
each `markdown_chunk` to `markdown_sveltex` rather than the built-in `markdown`.
