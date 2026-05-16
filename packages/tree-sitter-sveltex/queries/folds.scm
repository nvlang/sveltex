; Code folding for the SvelTeX (`.sveltex`) grammar.
;
; Only the multi-line structural blocks the `.sveltex` grammar owns are made
; foldable here; folding *within* embedded languages is contributed by the
; injected grammars' own fold queries.
;
; The `@fold` capture marks a node as a foldable region (the tree-sitter and
; Zed convention).

; A frontmatter block folds to its opening fence.
(frontmatter) @fold

; A verbatim environment (`<tex>…</tex>`, `<verbatim>…</verbatim>`, ...) folds
; to its opening tag.
(verbatim_environment) @fold

; A display-math block (`$$…$$` or `\[…\]`) folds to its first line.
(display_math) @fold
