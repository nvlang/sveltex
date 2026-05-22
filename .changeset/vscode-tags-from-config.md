---
'vscode-sveltex': minor
'@nvl/sveltex-language-server': minor
---

The VS Code extension's TextMate grammar is now driven entirely by the
user's `sveltex.config.js` / `svelte.config.js` — the
`sveltex.latexTags` / `sveltex.escapeTags` extension settings are gone.
The language server reports the live verbatim tag list to the client
via a new `sveltex/resolvedTags` notification (sent on `initialized`
and after every config reload), keyed by type:

-   `latexTags` (`type: 'tex'`) — body highlighted as LaTeX via
    `text.tex.latex`.
-   `escapeTags` (`type: 'escape'`) — body highlighted as plain
    literal text via `markup.fenced_code.block.markdown`.
-   `codeTags` (`type: 'code'`) — body highlighted the same as
    `escape` (both look like literal text in the editor; the
    build-time backend decides what to actually do with it).
-   `noopTags` (`type: 'noop'`) — body handed to `source.svelte`
    (noop bodies pass through unchanged to the Svelte compiler, so
    they should look like ordinary Svelte markup in the editor).

A user who adds `MyTex: { type: 'tex' }` / `MyEscape: { type:
'escape' }` / `MyCode: { type: 'code' }` / `MyNoop: { type: 'noop' }`
to their config now gets the appropriate editor highlighting for each
— no other configuration step needed. A window reload may be required
once after first declaring a new tag for VS Code to pick up the
regenerated grammar.

Bug fix in passing: the existing single-line `<verb>…</verb>` /
`<verbatim>…</verbatim>` TextMate match incorrectly used the LaTeX
tag-name alternation; same-line plain verbatim envs weren't
highlighted as fenced code. Fixed.
