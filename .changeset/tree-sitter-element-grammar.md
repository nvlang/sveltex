---
'@nvl/tree-sitter-sveltex': minor
---

Carve plain HTML / Svelte element tags (`<div>`, `<Counter>`, `</p>`,
`<br/>`) out of the Markdown stream as standalone inline nodes, leaving
each element's body as a fresh `markdown_chunk`. This is a deliberate
departure from CommonMark's "HTML block" rule: Markdown now flows
*through* the tags (the body gets its own Markdown injection instead of
being suppressed), and close tags become their own nodes so they can be
injected to `svelte` and highlighted. Void elements, self-closing
components, and intentionally unclosed/mismatched tags all parse without
forcing well-nesting.
