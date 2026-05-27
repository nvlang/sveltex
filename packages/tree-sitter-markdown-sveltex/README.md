# @nvl/tree-sitter-markdown-sveltex

A **SvelTeX fork** of the [tree-sitter Markdown grammar][upstream] — the split
(block + inline) [tree-sitter] grammar by [MDeiml] now maintained under
[tree-sitter-grammars]. It is vendored here, at upstream rev
[`9a23c1a`][upstream] (the same revision Zed pins for its built-in Markdown),
with two deliberate deviations from CommonMark and renamed grammars so it can
be injected by [`@nvl/tree-sitter-sveltex`](../tree-sitter-sveltex) in place of
the editor's built-in CommonMark grammar.

> [!WARNING]
> **This package is in alpha** and exists to serve SvelTeX's editor tooling.
> It is not a general-purpose Markdown grammar; if you want one, use
> [upstream][upstream] directly.

## Why a fork?

SvelTeX's Markdown processing differs from CommonMark in two small but
user-visible ways, and the editor grammar has to match so that highlighting
reflects what SvelTeX will actually compile:

- **Indented code blocks are disabled.** Four-space-indented prose stays a
  paragraph (and its inline markup keeps being highlighted) instead of becoming
  an indented code block. Use fenced code blocks (```` ``` ````) for code.
- **Underscore emphasis ending in a digit is recognised.** `_italic 1_` /
  `_italic1_` parse as emphasis, while intraword underscores between
  alphanumerics (`snake_case`, `1_2`) stay non-emphasis, per CommonMark's
  intraword rule.

Everything else — HTML blocks (`<script>` / `<style>` / `<pre>` and comments),
fenced code, and the GFM extensions (task lists, strikethrough, pipe tables,
front-matter) — is unchanged from upstream.

## Renamed grammars

The two grammars are renamed from `markdown` / `markdown_inline` to
**`markdown_sveltex`** / **`markdown_inline_sveltex`** so they do not clash
with an editor's built-in `markdown` / `markdown-inline` grammars when both are
installed. The exported C symbols, the Node binding, and the directory names
are renamed to match; consumers inject `markdown_sveltex` (see
`../tree-sitter-sveltex/queries/injections.scm`).

## The two-grammar parse model

Like upstream, this is **two** grammars. Parse a document with the block
grammar first, then run the inline grammar over the ranges the block grammar
marked as `inline` nodes (via `ts_parser_set_included_ranges`). See the
upstream [standalone-usage notes][upstream-standalone] and the `bindings/`
folder for an example.

## Extensions

Upstream's compile-time extension flags (environment variables, toggled at
`tree-sitter generate` time) are preserved. The SvelTeX build uses the
defaults: GFM (task lists, strikethrough, pipe tables) and YAML/TOML
front-matter are **on**; the optional Obsidian-style **tags** (`#tag`) and
**wiki-link** (`[[…]]`) extensions are **off** (SvelTeX does not enable them).

## Layout

```
tree-sitter-markdown/         the block grammar (grammar.js, src/, test/)
tree-sitter-markdown-inline/  the inline grammar (grammar.js, src/, test/)
common/common.js              shared rules + the extension flags
bindings/                     Node / Rust / … language bindings
scripts/test.js               runs `tree-sitter test` over both grammars
```

## Development

```sh
pnpm install
pnpm test          # tree-sitter test, both grammars
# regenerate after editing a grammar.js:
cd tree-sitter-markdown        && npx tree-sitter generate
cd tree-sitter-markdown-inline && npx tree-sitter generate
```

## Credits & license

Forked from [`tree-sitter-grammars/tree-sitter-markdown`][upstream] by
[MDeiml] and contributors. MIT licensed, as upstream.

[tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[upstream]: https://github.com/tree-sitter-grammars/tree-sitter-markdown
[upstream-standalone]: https://github.com/tree-sitter-grammars/tree-sitter-markdown#standalone-usage
[tree-sitter-grammars]: https://github.com/tree-sitter-grammars
[MDeiml]: https://github.com/MDeiml
