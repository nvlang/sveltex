---
'@nvl/sveltex-language-server': patch
---

Region-detection and reload improvements:

- **Recognise verbatim `aliases`.** The resolved verbatim-tag set now includes
  each environment's `aliases`, not just the record keys — so an aliased env
  (e.g. `<tikz>` for a `tex`-typed `Tex`) is correctly detected as a verbatim
  region (its body blanked, and `tex` types forwarded to TexLab) instead of
  being mis-delegated to `svelte-language-server` as markup.
- **Watch the config's dependency graph.** A live config reload now also fires
  when a file the `svelte.config.*` statically imports changes (a separate
  `sveltex.config.js`, a shared helper module), via a server-side watcher —
  which also brings live reload to clients (Zed, standalone) that register no
  file watcher of their own.
- **Don't resurrect closed documents during reload.** The config-reload
  resync now re-checks each document's liveness around its async proxy
  close/open, so a document the editor closes mid-reload is no longer
  re-opened in the Svelte proxy as a phantom virtual document with stale
  diagnostics.
