; Language injections for SvelTeX (`.sveltex`) in Zed.
;
; This is what makes the grammar useful: every embedded language is delegated
; to a grammar Zed already ships or that the user has installed as a language
; extension.
;
;   * Markdown          — built into Zed.
;   * YAML / JSON       — built into Zed.
;   * TOML              — the `toml` extension (recommended).
;   * LaTeX             — the `latex` extension (recommended for math/TeX).
;   * Svelte            — the `svelte` extension (recommended for verbatim
;                         tags; Svelte `<script>`/logic blocks inside prose
;                         are reached through the injected Markdown grammar).
;
; If an injection's language extension is not installed, Zed simply leaves
; that region un-highlighted — the rest of the file is unaffected.

; ── Markdown prose ───────────────────────────────────────────────────────
;
; Every `markdown_chunk` is delegated to Zed's Markdown grammar.
; `injection.combined` stitches all chunks of the document into one virtual
; Markdown document, so block constructs (lists, tables, reference links)
; that straddle a `.sveltex` construct still resolve. The Markdown grammar in
; turn injects fenced-code languages and HTML/Svelte.
((markdown_chunk) @injection.content
  (#set! injection.language "markdown")
  (#set! injection.combined))

; ── Frontmatter ──────────────────────────────────────────────────────────
;
; When the opening fence carries a `yaml`/`toml`/`json` keyword, that keyword
; node names the embedded language directly.
(frontmatter
  language: (frontmatter_language) @injection.language
  content: (frontmatter_content) @injection.content)

; A `---`-fenced block with no language keyword defaults to YAML (SvelTeX's
; default). The `!language` constraint keeps this from also firing on the
; keyword form handled above.
(frontmatter
  open: (frontmatter_fence) @_fence
  content: (frontmatter_content) @injection.content
  !language
  (#eq? @_fence "---")
  (#set! injection.language "yaml"))

; A `+++`-fenced block is always TOML (the SvelTeX shorthand); the `+++` form
; never carries a keyword.
(frontmatter
  open: (frontmatter_fence) @_fence
  content: (frontmatter_content) @injection.content
  (#eq? @_fence "+++")
  (#set! injection.language "toml"))

; ── Math ─────────────────────────────────────────────────────────────────
;
; All four delimiter styles carry LaTeX math.
((math_content_display) @injection.content
  (#set! injection.language "latex"))

((math_content_inline) @injection.content
  (#set! injection.language "latex"))

((math_content_bracket) @injection.content
  (#set! injection.language "latex"))

((math_content_paren) @injection.content
  (#set! injection.language "latex"))

; ── Verbatim environments ────────────────────────────────────────────────
;
; A `<tex>`/`<latex>`/`<tikz>` environment holds a LaTeX document fragment.
((tex_verbatim_body) @injection.content
  (#set! injection.language "latex"))

; The HTML-like opening/closing tags of every verbatim environment are
; delegated to the Svelte grammar so their attributes are highlighted
; consistently with the rest of the file.
((verbatim_tex_open_tag) @injection.content
  (#set! injection.language "svelte"))

((verbatim_plain_open_tag) @injection.content
  (#set! injection.language "svelte"))

((verbatim_close_tag) @injection.content
  (#set! injection.language "svelte"))

; `<verb>`/`<verbatim>` bodies are intentionally opaque and left un-injected.

; ── Svelte mustache expressions ──────────────────────────────────────────
;
; The body of a `{ … }` expression (the braces themselves are matched by the
; grammar) is a JavaScript expression — delegate to Zed's built-in JS
; grammar. Logic-block sigils (`#`/`/`/`:`/`@`) get flagged by the JS parser
; until first-class Svelte-block parsing lands in this grammar.
((svelte_expression_body) @injection.content
  (#set! injection.language "javascript"))
