---
'@nvl/sveltex': minor
---

Stop reconfiguration from silently leaving stale state behind:

- Stale self-hosted stylesheets from a previous backend, version, or output
  format (e.g. a `mathjax@….css` left in `static/sveltex/` after switching to
  KaTeX) now trigger a build-time warning, so you can remove them instead of
  shipping them unknowingly. SvelTeX won't delete them for you — that directory
  is part of your repo.
- Code config is now checked for options belonging to another backend (e.g. a
  `shiki` block while `codeBackend` is `'highlight.js'`), which were previously
  ignored silently; a warning is emitted instead.
