; Document outline for SvelTeX (`.sveltex`) in Zed.
;
; The `sveltex` grammar does not parse Markdown headings (they live inside the
; opaque `markdown_chunk` nodes that are delegated to the Markdown grammar),
; so the outline surfaces the structural blocks the grammar *does* own: the
; frontmatter block and each verbatim environment. This gives a quick jump
; target for the LaTeX/TikZ figures and metadata in a document.
;
; `@item` marks an outline entry; `@name` is the text shown for it.

; The frontmatter block.
(frontmatter
  (frontmatter_fence) @name) @item

; Each verbatim environment, named by its tag (`tex`, `verbatim`, ...).
(verbatim_environment
  (verbatim_tex_open_tag (tag_name) @name)) @item

(verbatim_environment
  (verbatim_plain_open_tag (tag_name) @name)) @item
