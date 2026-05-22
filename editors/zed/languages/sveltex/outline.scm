; Document outline for SvelTeX (`.sveltex`) in Zed.
;
; SvelTeX's Markdown headings — the natural outline of a document — live inside
; the injected Markdown grammar (the `sveltex` grammar delegates Markdown to it
; via opaque `markdown_chunk` nodes), so they are invisible to this query. The
; SvelTeX language server provides the heading outline instead, via
; `textDocument/documentSymbol`; set `document_symbols = "on"` for the `SvelTeX`
; language in your Zed settings to use it (this matches the VS Code outline):
;
;     "languages": { "SvelTeX": { "document_symbols": "on" } }
;
; This tree-sitter query is only the fallback when that setting is off. It
; surfaces the frontmatter block alone — verbatim environments are intentionally
; omitted to keep the outline uncluttered.
;
; `@item` marks an outline entry; `@name` is the text shown for it.

; The frontmatter block. Capture only the OPENING fence via the `open:` field —
; a `frontmatter` node has two `frontmatter_fence` children (the opening and
; closing `---`/`+++`), so an unconstrained `(frontmatter_fence) @name` would
; list the same block twice.
(frontmatter
  open: (frontmatter_fence) @name) @item
