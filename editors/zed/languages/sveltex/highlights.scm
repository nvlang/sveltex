; Syntax highlighting for SvelTeX (`.sveltex`) in Zed.
;
; The `sveltex` tree-sitter grammar parses only the top-level structure; the
; bulk of a document's colour comes from the injected grammars (Markdown,
; LaTeX, Svelte, YAML/TOML/JSON — see `injections.scm`). The captures below
; colour just the structural delimiters the grammar itself owns.

; ── Frontmatter ──────────────────────────────────────────────────────────

(frontmatter_fence) @punctuation.delimiter
(frontmatter_language) @keyword

; ── Math ─────────────────────────────────────────────────────────────────

(math_delimiter) @punctuation.special

; ── Verbatim environments ────────────────────────────────────────────────

(verbatim_tex_open_tag ["<" ">"] @punctuation.bracket)
(verbatim_plain_open_tag ["<" ">"] @punctuation.bracket)
(verbatim_close_tag ["</" ">"] @punctuation.bracket)

(verbatim_tex_open_tag (tag_name) @tag)
(verbatim_plain_open_tag (tag_name) @tag)
(verbatim_close_tag (tag_name) @tag)

(verbatim_attributes) @attribute

; The body of a `<verb>` / `<verbatim>` environment is intentionally literal
; (SvelTeX escapes rather than renders it) and carries no injection.
(plain_verbatim_body) @text.literal
