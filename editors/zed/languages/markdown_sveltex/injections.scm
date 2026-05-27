; Injections for the SvelTeX markdown FORK (block grammar `markdown_sveltex`).
;
; Adapted from Zed's built-in `crates/languages/src/markdown/injections.scm`
; and the upstream MDeiml `tree-sitter-markdown/queries/injections.scm`.
;
; Zed will NOT reuse the built-in `markdown` grammar's queries for a
; differently-named grammar, so every injection the built-in relied on is
; restated here against the fork's node names (which are identical to upstream —
; only the grammar *name* changed).
;
; NOTE (vs. the earlier disable-html-blocks prototype): this fork KEEPS
; CommonMark HTML blocks, so the `(html_block) -> html` injection is preserved.
; That is what keeps `<script>` / `<style>` / `<pre>` and HTML comments working.
; `<div>`-type element tags are already carved out upstream by the SvelTeX
; grammar itself, so the markdown fork does not need to touch them.

; ── Inline prose ───────────────────────────────────────────────────────────
;
; Each inline run is reparsed by the fork's inline grammar (which adds the
; `html_tag` -> svelte injection, see ../markdown_inline_sveltex/injections.scm).
((inline) @injection.content
  (#set! injection.language "markdown_inline_sveltex"))

; ── Fenced code ──────────────────────────────────────────────────────────────
;
; The info string names the embedded language.
(fenced_code_block
  (info_string
    (language) @injection.language)
  (code_fence_content) @injection.content)

; ── HTML blocks (KEPT) ───────────────────────────────────────────────────────
;
; `<script>` / `<style>` / `<pre>` blocks and HTML comments. Delegated to the
; Svelte grammar so `<script>`/`<style>` contents (JS/CSS) and Svelte markup are
; highlighted consistently with the rest of a `.sveltex` file.
((html_block) @injection.content
  (#set! injection.language "svelte"))

; ── Frontmatter metadata (parity with upstream) ──────────────────────────────
;
; SvelTeX's own grammar already handles frontmatter, so these only matter if the
; fork is ever used stand-alone on a plain Markdown buffer.
((minus_metadata) @injection.content
  (#set! injection.language "yaml"))

((plus_metadata) @injection.content
  (#set! injection.language "toml"))
