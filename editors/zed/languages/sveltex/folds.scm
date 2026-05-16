; Code folding for SvelTeX (`.sveltex`) in Zed.
;
; Only the multi-line structural blocks the `sveltex` grammar owns are made
; foldable; folding within an embedded language is contributed by that
; language's own fold query.

(frontmatter) @fold

(verbatim_environment) @fold

(display_math) @fold
