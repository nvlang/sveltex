---
'@nvl/tree-sitter-sveltex': minor
---

Recognise Svelte mustache expressions and block tags as first-class
top-level constructs.

`{ … }` mustache expressions surface as a `svelte_expression` node with a
`svelte_expression_body` child, ready for a JavaScript injection. Brace
depth is tracked with string-literal awareness, so embedded `}` inside
`'…'` / `"…"` / `` `…` `` does not end the expression prematurely;
backslash-escaped braces (`\{` / `\}`) remain plain Markdown.

Block tags get their own grammar rules with named fields:

- `{@const}`, `{@html}`, `{@render}`, `{@debug}` — the `@`-commands.
- `{#if condition} … {:else if c2} … {:else} … {/if}` — conditional
  branches via `svelte_branch_else_if` and `svelte_branch_else`.
- `{#each items as item, i (key)} … {:else} … {/each}` — iteration; the
  head is kept as one opaque expression body for the JS injection.
- `{#await promise} … {:then value} … {:catch err} … {/await}` — async
  via `svelte_branch_then` and `svelte_branch_catch` (both supporting an
  empty binding).
- `{#key expr} … {/key}` — re-render trigger.
- `{#snippet name(args)} … {/snippet}` — Svelte 5 snippet declaration.

Block content is recursive: any block may contain math, verbatim
environments, mustache expressions, more blocks, and Markdown. All
opening / continuation / closing delimiters share the
`svelte_block_tag` alias so a single highlight query covers every
flavour.
