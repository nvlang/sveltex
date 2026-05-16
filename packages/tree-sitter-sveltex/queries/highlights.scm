; Syntax highlighting for the SvelTeX (`.sveltex`) grammar.
;
; This grammar parses only the top-level `.sveltex` structure; the bulk of a
; document's highlighting comes from the injected grammars (see
; `injections.scm`). The captures below colour just the structural delimiters
; that the `.sveltex` grammar itself owns: frontmatter fences, math delimiters
; and verbatim-environment tags.
;
; Capture names follow the standard tree-sitter highlight set so that the
; query works unchanged across editors (Zed, Neovim, Helix, ...).

; ── Frontmatter ──────────────────────────────────────────────────────────

; The `---` / `+++` fences delimiting a frontmatter block.
(frontmatter_fence) @punctuation.delimiter

; The optional `yaml` / `toml` / `json` keyword after the opening fence.
(frontmatter_language) @keyword

; ── Math ─────────────────────────────────────────────────────────────────

; The `$`, `$$`, `\(`, `\)`, `\[`, `\]` math delimiters.
(math_delimiter) @punctuation.special

; The math body itself is highlighted by the injected `latex` grammar; tag it
; as embedded so editors without that grammar still render it distinctly.
(math_content_display) @markup.math
(math_content_inline) @markup.math
(math_content_bracket) @markup.math
(math_content_paren) @markup.math

; ── Verbatim environments ────────────────────────────────────────────────

; The `<` / `>` / `</` punctuation of a verbatim environment's tags.
(verbatim_tex_open_tag ["<" ">"] @punctuation.bracket)
(verbatim_plain_open_tag ["<" ">"] @punctuation.bracket)
(verbatim_close_tag ["</" ">"] @punctuation.bracket)

; The tag name (`tex`, `verbatim`, ...).
(verbatim_tex_open_tag (tag_name) @tag)
(verbatim_plain_open_tag (tag_name) @tag)
(verbatim_close_tag (tag_name) @tag)

; A verbatim opening tag's attributes are kept opaque by the grammar; colour
; the whole blob as an attribute.
(verbatim_attributes) @attribute

; The body of a `<verb>` / `<verbatim>` environment is intentionally literal
; (SvelTeX escapes rather than renders it) and has no injection, so highlight
; it as plain raw text.
(plain_verbatim_body) @markup.raw
