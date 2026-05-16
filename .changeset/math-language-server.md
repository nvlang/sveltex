---
'sveltex': minor
---

The SvelTeX language server now offers TeX-math and LaTeX assistance. A new
`@nvl/sveltex-math-language-server` package provides command/macro completion
(triggered on `\`) and hover for the math inside `$…$` / `$$…$$` regions,
accurately scoped to the project's math backend (KaTeX or MathJax — their
command sets differ, and the lists are extracted from each engine's own
package source). The language server forwards math regions to it, and forwards
LaTeX verbatim regions (`<tex>` / `<latex>` / `<tikz>`) to
[TexLab](https://github.com/latex-lsp/texlab) when a `texlab` binary is on
`PATH`. Both are skipped gracefully when unavailable.
