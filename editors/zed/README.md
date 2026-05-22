# Zed extension for SvelTeX

[SvelTeX](https://sveltex.dev) (`.sveltex`) language support for the
[Zed](https://zed.dev) editor.

## What it provides

- A **`SvelTeX` language**, bound to the `.sveltex` file extension.
- **Syntax highlighting**, via the [`tree-sitter-sveltex`](../../packages/tree-sitter-sveltex)
  grammar, with tree-sitter **injections** delegating embedded languages:
  Markdown prose, LaTeX math, `<tex>`/`<tikz>` verbatim environments, Svelte
  markup, and YAML/TOML/JSON frontmatter.
- **Brackets, folding and outline** queries.
- The **`@nvl/sveltex-language-server` LSP**, launched over stdio, for
  diagnostics and the language features it forwards from the Svelte language
  server.

## Layout

```
extension.toml              extension manifest: grammar + language-server wiring
Cargo.toml / src/lib.rs     Rust (compiled to Wasm); launches the language server
languages/sveltex/
  config.toml               language config: comments, brackets, autoclose
  highlights.scm            highlighting of the structural delimiters
  injections.scm            delegation to Markdown / LaTeX / Svelte / YAML / …
  brackets.scm              bracket matching
  folds.scm                 foldable regions
  outline.scm               document outline
```

## How the grammar is wired

`extension.toml` declares three tree-sitter grammars, all built from this
monorepo:

- `[grammars.sveltex]` — the `.sveltex` grammar itself, from
  `packages/tree-sitter-sveltex`.
- `[grammars.markdown_sveltex]` and `[grammars.markdown_inline_sveltex]` — the
  forked Markdown block/inline grammars, from
  `packages/tree-sitter-markdown-sveltex`, injected into every Markdown chunk
  in place of Zed's built-in `markdown`/`markdown-inline`.

Zed clones the repository at each block's pinned `rev` and compiles the
grammars itself.

> **Maintainers:** every `rev` in `extension.toml` must be a *pushed* commit
> SHA of `nvlang/sveltex` — Zed builds the grammars from the remote, not the
> working tree. Bump the relevant `rev`(s) whenever a grammar changes.

## How the language server is wired

`src/lib.rs` implements `language_server_command`. It resolves
`@nvl/sveltex-language-server` **workspace-first**:

1. If the project has the package in its `node_modules`, that copy is used —
   so the editor and any CLI/CI use of SvelTeX agree on one server version.
2. Otherwise the extension installs the package with Zed's npm helpers.

It then launches `node …/bin/server.js --stdio`.

## Installing as a dev extension

1. From this directory (`editors/zed`), install the `wasm32-wasip1`
   target and check that the extension compiles:
   ```sh
   cd editors/zed
   rustup target add wasm32-wasip1
   cargo build --release --target wasm32-wasip1
   ```
2. In Zed, run **`zed: install dev extension`** and select this directory
   (`editors/zed`). Zed compiles the Wasm extension and the grammar.
3. Open a `.sveltex` file.

Recommended companion language extensions for full injection highlighting:
**LaTeX**, **Svelte**, and **TOML** (Markdown, YAML and JSON are built in).

## Recommended settings

**Document outline.** The `.sveltex` outline (and breadcrumbs) is best sourced
from the language server, which lists the document's **Markdown headings** —
matching the VS Code extension. Zed otherwise uses the tree-sitter
`outline.scm`, which can't see Markdown headings (they're delegated to an
injected grammar) and so only lists the frontmatter block. Enable the language
server's symbols for the `SvelTeX` language in your Zed `settings.json`:

```json
{
  "languages": {
    "SvelTeX": { "document_symbols": "on" }
  }
}
```

**Semantic highlighting.** Zed has `semantic_tokens` **off by default** — set it
to `"combined"` so the language server can colour `escape`/`code` verbatim
bodies, which the static grammar can't (it only recognises the hard-coded
`tex`/`latex`/`tikz` and `verb`/`verbatim` tag names — see the
[verbatim docs](https://sveltex.dev/docs/verbatim#editor-syntax-highlighting)).

## License

MIT
