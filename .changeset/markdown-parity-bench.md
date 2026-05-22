---
'@nvl/tree-sitter-markdown-sveltex': patch
---

Fix the Node binding for the forked Markdown grammar so it can be loaded at
all. `bindings/node/binding.cc` still called the upstream entry points
`tree_sitter_markdown()` / `tree_sitter_markdown_inline()`, but the fork
renamed its grammars to `markdown_sveltex` / `markdown_inline_sveltex`, so the
actual exported symbols are `tree_sitter_markdown_sveltex()` /
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
