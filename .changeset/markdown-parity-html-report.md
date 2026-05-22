---
'@nvl/tree-sitter-sveltex': patch
---

Add a browser-readable HTML companion to the markdown parity bench
(`packages/tree-sitter-sveltex/scripts/parity-markdown-html.mjs`, dev-only,
`pnpm parity:markdown:html`). For each corpus example it renders three
side-by-side panels — TextMate, the tree-sitter fork, and clean upstream —
each showing the source as syntax-highlighting coloured by the shared parity
kind, so a span one grammar tags `emphasis` but another leaves plain (or tags
`html-block`) shows up as a column-to-column colour difference, with divergent
runs underlined. The report defaults to TM-vs-fork divergent examples grouped
into collapsible per-corpus sections with an overview stats table and a JS
toggle for full-parity examples; it is self-contained (inline CSS + JS).

To keep HTML iteration cheap, tokenization is dumped to a JSON cache first and
the HTML is rendered from that cache (`--render-only` re-renders in well under
a second). The script imports `parity-markdown.mjs`'s tokenizers and
classifiers rather than re-deriving the kind mappings, so the colours and the
numeric report can never disagree. The report and its cache are gitignored.
