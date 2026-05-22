; Injections for the SvelTeX markdown FORK (inline grammar
; `markdown_inline_sveltex`).
;
; Zed's built-in `markdown-inline` injections.scm only injects `latex_block`.
; This fork ADDS the `html_tag` -> svelte injection: inline HTML/Svelte tags in
; prose (`<Counter/>`, `<span class="x">`, `</div>`, …) are delegated to the
; Svelte grammar so their attributes and contents are highlighted consistently
; with the rest of the `.sveltex` file.

((html_tag) @injection.content
  (#set! injection.language "svelte"))

((latex_block) @injection.content
  (#set! injection.language "latex"))
