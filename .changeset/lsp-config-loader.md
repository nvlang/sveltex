---
'@nvl/sveltex-language-server': minor
---

The language server now resolves and live-reloads the user's SvelTeX
configuration:

- locates `svelte.config.{js,mjs,cjs,ts,mts,cts}` from the workspace
  root,
- runs it in a short-lived child process to extract the SvelTeX
  preprocessor's configuration (so the host editor's Node process is
  never blocked or polluted),
- watches the resolved config file and its transitively-imported
  files, debouncing reloads on change,
- surfaces load outcomes (success, transient failure, missing config)
  in the LSP output channel.

Also fixes a `completionItem/resolve -32603` error that surfaced when
the forwarded child language server returned `null` from `resolve`.
