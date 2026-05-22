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

`extension.toml`'s `[grammars.sveltex]` block points Zed at this monorepo and
the grammar's subdirectory (`packages/tree-sitter-sveltex`). Zed clones the
repository at the pinned `rev` and compiles the grammar itself.

> **Maintainers:** the `rev` in `extension.toml` must be a *pushed* commit SHA
> of `nvlang/sveltex` — Zed builds the grammar from the remote, not the
> working tree. Bump it whenever the grammar changes.

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

**Semantic highlighting.** Keep `semantic_tokens` enabled (the default): it lets
the language server colour `escape`/`code` verbatim bodies, which the static
grammar can't (it only recognises the hard-coded `tex`/`latex`/`tikz` and
`verb`/`verbatim` tag names — see the
[verbatim docs](https://sveltex.dev/docs/verbatim#editor-syntax-highlighting)).

## License

MIT
