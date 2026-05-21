---
'sveltex': patch
---

Fix multi-line `<tex>` / `<latex>` / `<tikz>` and `<verbatim>` blocks never
closing in the VS Code TextMate grammar. The nested `begin: ^ / while:`
sub-rule was consuming content line-by-line and shadowing the outer
`end:`, so the closing `</tex>` (etc.) never popped the
`meta.embedded.block.latex` scope — everything after the first opening
tag stayed highlighted as embedded LaTeX. Replaced with the standard
`begin / end` pair plus an `include: text.tex.latex` for the body.
