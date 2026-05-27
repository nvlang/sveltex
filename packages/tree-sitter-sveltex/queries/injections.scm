; Language injections for the SvelTeX (`.sveltex`) grammar.
;
; The `.sveltex` grammar parses only the top-level structure; every embedded
; language is delegated to an existing grammar through the injections below.
; This is the whole point of the grammar — Markdown, Svelte and LaTeX are NOT
; reimplemented here.
;
; Capture conventions (shared by tree-sitter, Zed, Neovim, Helix):
;   * @injection.content  — the node whose text is reparsed,
;   * @injection.language — a node whose *text* names the language, or
;   * (#set! injection.language "name") — a fixed language name.
; `injection.combined` joins several sibling content nodes into one virtual
; document before parsing (used so all Markdown chunks form one document).

; ── Markdown prose ───────────────────────────────────────────────────────
;
; Every `markdown_chunk` is delegated to the SvelTeX markdown FORK
; (`markdown_sveltex`, vendored at `packages/tree-sitter-markdown-sveltex`).
; `injection.combined` stitches all chunks of a document back together, so the
; embedded Markdown parser sees one continuous document and block constructs
; (lists, tables, reference links, ...) that happen to straddle a `.sveltex`
; construct still resolve correctly.
;
; The fork is the standard `markdown` grammar with two SvelTeX deviations from
; CommonMark — indented code blocks disabled, and underscore emphasis ending in
; a digit (`_italic 1_`) recognised — and is renamed to avoid clashing with the
; editor's built-in `markdown`/`markdown-inline` grammars. It in turn injects
; `markdown_inline_sveltex` for inline spans, the fenced-code languages for
; ``` blocks, and `html`/`svelte` for embedded markup — so Svelte `<script>`,
; logic blocks and mustache tags are handled downstream, exactly as in a plain
; `.svelte`/`.md` setup.
((markdown_chunk) @injection.content
  (#set! injection.language "markdown_sveltex")
  (#set! injection.combined))

; ── Frontmatter ──────────────────────────────────────────────────────────
;
; The fenced frontmatter block carries an optional language keyword
; (`yaml`/`toml`/`json`); when present, the keyword node's text names the
; embedded language directly.
(frontmatter
  language: (frontmatter_language) @injection.language
  content: (frontmatter_content) @injection.content)

; A `---`-fenced frontmatter block with no keyword defaults to YAML, matching
; SvelTeX's own default. The `!language` constraint keeps this from also
; matching the keyword form above; `#eq?` distinguishes it from the `+++`
; form below.
(frontmatter
  open: (frontmatter_fence) @_fence
  content: (frontmatter_content) @injection.content
  !language
  (#eq? @_fence "---")
  (#set! injection.language "yaml"))

; A `+++`-fenced frontmatter block is always TOML (the SvelTeX shorthand); it
; never carries a language keyword.
(frontmatter
  open: (frontmatter_fence) @_fence
  content: (frontmatter_content) @injection.content
  (#eq? @_fence "+++")
  (#set! injection.language "toml"))

; ── Math ─────────────────────────────────────────────────────────────────
;
; All four delimiter styles carry LaTeX math. The `latex` grammar parses math
; mode happily even without the surrounding `$`/`\(` delimiters.
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
; A `<tex>`/`<latex>`/`<tikz>` environment holds a full LaTeX document
; fragment; delegate it to the `latex` grammar.
((tex_verbatim_body) @injection.content
  (#set! injection.language "latex"))

; The opening/closing tags of every verbatim environment are HTML-like Svelte
; markup; hand them to the `svelte` grammar so attributes (which may contain
; Svelte expressions) are highlighted consistently with the rest of the file.
((verbatim_tex_open_tag) @injection.content
  (#set! injection.language "svelte"))

((verbatim_plain_open_tag) @injection.content
  (#set! injection.language "svelte"))

((verbatim_close_tag) @injection.content
  (#set! injection.language "svelte"))

; A `<verb>`/`<verbatim>` environment is intentionally opaque (SvelTeX escapes
; its contents rather than rendering them), so `plain_verbatim_body` is left
; un-injected — it is plain text.

; ── Plain HTML / Svelte element tags ───────────────────────────────────────
;
; `<div>`, `<p>`, `<Counter>`, `</div>`, `<br/>`, … are carved out of the
; Markdown stream by the grammar (so the element body is a *fresh*
; `markdown_chunk` — see the note at the top — and the closing tag is its own
; node). Each tag is delegated to the `svelte` grammar, exactly like the
; verbatim tags above, so element names, attributes and any Svelte expressions
; inside them are highlighted consistently. This is what makes `</div>`
; highlighted (CommonMark leaves it inert) and lets Markdown flow through the
; element without the CommonMark HTML-block suppression.
((html_open_tag) @injection.content
  (#set! injection.language "svelte"))

((html_self_closing_tag) @injection.content
  (#set! injection.language "svelte"))

((html_close_tag) @injection.content
  (#set! injection.language "svelte"))

; ── Svelte mustache expressions ──────────────────────────────────────────
;
; A `{ … }` expression in prose. The body (between the braces, exclusive)
; is a JavaScript expression in Svelte's syntax; delegate to the JS
; grammar. This rule covers plain mustaches AND the body of every
; `{#if cond}` / `{@const x = …}` / `{:then v}` / `{:catch e}` / `{#await
; promise}` / `{#key expr}` / `{#snippet …}` head, since they all share
; `svelte_expression_body` for the JS-expression slot.
((svelte_expression_body) @injection.content
  (#set! injection.language "javascript"))

; ── `{#each}` head fields ────────────────────────────────────────────────
;
; The `iterable` and `key` sub-bodies are JS expressions; inject JS into
; them. The `binding` is a Svelte-side identifier (or destructuring
; pattern) — it's syntactically valid JS in most cases, but injecting JS
; would highlight a destructuring like `{name, age}` as a block statement
; rather than a parameter pattern, which is wrong. Leave it un-injected.
((svelte_each_iterable) @injection.content
  (#set! injection.language "javascript"))

((svelte_each_key) @injection.content
  (#set! injection.language "javascript"))

; ── `{#snippet}` and `{#await}` head fields ──────────────────────────────
;
; The snippet `params` list is a JS function-parameter list (identifiers,
; defaults, destructuring, rest). The `await` `promise` is a JS expression;
; the optional shorthand `binding` is a single identifier so injection is
; unnecessary.
((svelte_snippet_params) @injection.content
  (#set! injection.language "javascript"))

((svelte_await_promise) @injection.content
  (#set! injection.language "javascript"))
