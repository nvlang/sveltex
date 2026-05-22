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
; Every `markdown_chunk` is delegated to the SvelTeX markdown FORK
; (`markdown_sveltex`, vendored at `packages/tree-sitter-markdown-sveltex` and
; defined as a Zed language under `../markdown_sveltex`). The fork is CommonMark
; with two SvelTeX deviations — indented code blocks disabled, and underscore
; emphasis ending in a digit recognised — but is otherwise the built-in
; Markdown grammar (HTML blocks, fenced code, inline injection all preserved).
; `injection.combined` stitches all chunks of the document into one virtual
; Markdown document, so block constructs (lists, tables, reference links)
; that straddle a `.sveltex` construct still resolve. The fork in turn injects
; fenced-code languages, `markdown_inline_sveltex` for inline runs, and
; HTML/Svelte.
((markdown_chunk) @injection.content
  (#set! injection.language "markdown_sveltex")
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

; ── Plain HTML / Svelte element tags ───────────────────────────────────────
;
; `<div>`, `<p>`, `<Counter>`, `</div>`, `<br/>`, … are carved out of the
; Markdown stream as standalone tag nodes (the element body stays a fresh
; `markdown_chunk` so Markdown flows through the element without CommonMark's
; HTML-block suppression, and the closing tag — which CommonMark leaves inert —
; becomes its own node). Delegate each tag to the Svelte grammar, like the
; verbatim tags above.
((html_open_tag) @injection.content
  (#set! injection.language "svelte"))

((html_self_closing_tag) @injection.content
  (#set! injection.language "svelte"))

((html_close_tag) @injection.content
  (#set! injection.language "svelte"))

; ── Svelte mustache expressions ──────────────────────────────────────────
;
; The body of a `{ … }` expression / `{@const}` / `{#if}` / `{:then}` /
; `{#await}` / `{#key}` / `{#snippet}` head is a JavaScript expression —
; delegate to Zed's built-in JS grammar.
((svelte_expression_body) @injection.content
  (#set! injection.language "javascript"))

; `{#each iterable as binding, index (key)}` decomposes the head into
; named fields. The `iterable` and `key` are JS expressions; the
; `binding` is a Svelte parameter pattern (destructuring or identifier),
; left un-injected so JS doesn't mis-render `{a, b}` as a block.
((svelte_each_iterable) @injection.content
  (#set! injection.language "javascript"))

((svelte_each_key) @injection.content
  (#set! injection.language "javascript"))

; `{#snippet name(params)}` — params are a JS function-parameter list
; (identifiers, defaults, destructuring, rest); the name itself is a
; single identifier and doesn't need an injection.
((svelte_snippet_params) @injection.content
  (#set! injection.language "javascript"))

; `{#await promise then|catch binding}` — the promise is a JS expression;
; the binding is a single identifier so we don't inject on it.
((svelte_await_promise) @injection.content
  (#set! injection.language "javascript"))
