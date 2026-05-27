---
'@nvl/sveltex-language-server': patch
---

Two robustness fixes surfaced while bringing the server to full coverage:

- **Go-to-definition no longer returns a stale origin range.** When a
  `LocationLink`'s `originSelectionRange` could not be mapped back to the
  source, it leaked through in virtual-document coordinates; it is now dropped.
- **`LspProxy.start()` no longer hangs when the child dies mid-handshake.** A
  child language server that crashes or exits during `initialize` now rejects
  startup (and tears the proxy down to a clean not-running state) instead of
  hanging on a response that will never arrive.
