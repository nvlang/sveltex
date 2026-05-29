---
'@nvl/sveltex': minor
---

Stop reconfiguration from silently leaving stale state behind:

- Self-hosted stylesheets from a previous backend, version, or output format
  (e.g. a `mathjax@….css` left after switching to KaTeX) are now pruned from
  `static/sveltex/` automatically, so they no longer keep shipping in the build.
- Code config is now checked for options belonging to another backend (e.g. a
  `shiki` block while `codeBackend` is `'highlight.js'`), which were previously
  ignored silently; a warning is emitted instead.
