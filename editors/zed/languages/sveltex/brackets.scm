; Bracket matching for SvelTeX (`.sveltex`) in Zed.
;
; Zed highlights the partner of the bracket under the cursor using the
; `@open` / `@close` capture pair. Only the structural delimiters the
; `sveltex` grammar owns are listed; bracket matching *within* an embedded
; language is contributed by that language's own `brackets.scm`.

; A frontmatter block's opening and closing fences.
(frontmatter
  open: (frontmatter_fence) @open
  close: (frontmatter_fence) @close)

; A verbatim environment's opening and closing tags.
(verbatim_environment
  open: (verbatim_tex_open_tag) @open
  close: (verbatim_close_tag) @close)

(verbatim_environment
  open: (verbatim_plain_open_tag) @open
  close: (verbatim_close_tag) @close)

; The `<` … `>` of a verbatim tag.
(verbatim_tex_open_tag "<" @open ">" @close)
(verbatim_plain_open_tag "<" @open ">" @close)
(verbatim_close_tag "</" @open ">" @close)

; The `<` … `>` of a plain HTML / Svelte element tag. (These are standalone
; tag nodes, not a matched open/close pair, so only the intra-tag delimiters
; are paired — like the verbatim tags above.)
(html_open_tag "<" @open ">" @close)
(html_self_closing_tag "<" @open "/>" @close)
(html_close_tag "</" @open ">" @close)
