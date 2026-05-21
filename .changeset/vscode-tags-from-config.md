---
'sveltex': minor
---

The VS Code extension now derives its TextMate grammar's verbatim tag
list from the user's `sveltex.config.js` / `svelte.config.js` by default,
so editor highlighting stays in step with the build and the LSP without
the user having to mirror tag names in two places.

How it picks tags now (in priority order):

1. An explicit `sveltex.latexTags` / `sveltex.escapeTags` user setting,
   if you've ever set one — respected verbatim. Existing configurations
   that wrote the lists by hand keep working unchanged.
2. The LSP-resolved list, pushed via the new `sveltex/resolvedTags`
   notification immediately after the language server starts and after
   every config reload — driven entirely by your `sveltex.config.js`.
3. The hard-coded defaults (`['tex', 'latex', 'tikz']` and
   `['verb', 'verbatim']`) — until the LSP connects, and when no user
   setting exists.

A user who adds `MyVerb: { type: 'escape', ... }` to their config now
gets `<MyVerb>` body highlighting in the editor without also touching
`sveltex.escapeTags`. Removing that env from the config quietly removes
the corresponding highlight too.
