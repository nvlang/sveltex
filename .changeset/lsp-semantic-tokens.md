---
'@nvl/sveltex-language-server': minor
---

Emit `textDocument/semanticTokens` for every verbatim region's body.

The editor-side grammars (TextMate in VS Code, the compiled tree-sitter
grammar in Zed) hardcode a fixed list of verbatim tag names. A user
who adds a custom verbatim env (`MyVerb: { type: 'escape', ... }`) to
their `sveltex.config.js` got build + LSP support, but the editor left
the body un-coloured because the static grammar didn't know about it.

The LSP already reads the verbatim tag list from the live config; it
now uses that list to emit semantic tokens marking each region's body
as `string`. Editors lay these on top of the static grammar, so
user-configured verbatim tags become visible in any LSP-supporting
editor — most importantly Zed, whose tree-sitter grammar can't be
parameterised at runtime.

Multi-line bodies are split into one token per line per the LSP
spec; clients without semantic-tokens support are unaffected.
