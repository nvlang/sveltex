---
'@nvl/sveltex-language-server': minor
'vscode-sveltex': patch
---

Two related fixes for custom verbatim envs:

**`noop`-typed envs are now visible to `svelte-language-server`.** Per
the SvelTeX docs, `type: 'noop'` "passes the body to Svelte unchanged",
so the body should travel into the virtual `.svelte` document the LSP
hands to `svelte-language-server`. Previously the LSP classified all
verbatim regions as kind `'verbatim'`, which is blanked from the
virtual document — Svelte never saw `<MyNoop>` bodies. Now the body
is delegated (kind `'svelte'`) while the wrapper tags stay blanked, so
the proxy sees the body without tripping over the SvelTeX wrapper tags
(which are rewritten at build time and aren't real Svelte components).

**Custom `escape`- and `code`-typed envs get flat semantic-token
coloring in non-VS-Code clients.** A scoped `textDocument/
semanticTokens/full` provider emits one `string` token per body line
of a custom escape- or code-typed verbatim region (e.g. `<MyEscape>`,
`<MyCode>`). Tex- and noop-typed envs and the standard hardcoded
`tex|latex|tikz|verb|verbatim` are skipped — those are handled by the
editor grammars directly (TM regen in VS Code, native tree-sitter
captures in Zed). The provider is advertised only when the client's
`initializationOptions.client` is anything other than `'vscode'`; VS
Code stays on the TM-only path so its grammar regeneration isn't
overridden by semantic tokens.
