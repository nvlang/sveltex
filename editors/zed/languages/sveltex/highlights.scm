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

; ── Svelte mustache + block tags ─────────────────────────────────────────

; The bare `{` / `}` of a `{ … }` mustache expression.
(svelte_expression ["{" "}"] @punctuation.bracket)

; All block-tag delimiters (`{@const`, `{#if`, `{:else}`, `{/each}`, ...)
; are aliased to `svelte_block_tag` in the grammar, so one capture covers
; the whole family. `@keyword` lights them up consistently with Zed's
; built-in Svelte highlighting of the same constructs.
(svelte_block_tag) @keyword

; `{#each ... as ...}` head fields: the `as` keyword and the binding /
; index identifiers (Svelte-side parameter patterns, not JS references).
(svelte_each_as) @keyword
(svelte_each_binding) @variable.parameter
(svelte_each_index) @variable.parameter
