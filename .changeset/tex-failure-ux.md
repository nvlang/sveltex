---
'@nvl/sveltex': minor
---

Fail clearly when a `<TeX>` component can't be compiled, instead of crashing the
build or silently shipping a broken page. A missing TeX engine or converter
(e.g. `pdflatex`, `dvisvgm`) now throws an actionable, per-file error naming the
tool and linking to the new "System prerequisites" docs; a `<TeX>` body that
contains `\documentclass` or `\begin{document}` is rejected up front; and errors
during markup processing are propagated rather than swallowed (which previously
left the original, unprocessed markup in the output).
