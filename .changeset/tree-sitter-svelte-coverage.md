---
'@nvl/tree-sitter-sveltex': minor
---

Parse Svelte mustache expressions, block tags, and `@`-commands as
first-class top-level constructs (previously absorbed into
`markdown_chunk`):

- `{ … }` mustache expressions (`svelte_expression_body` for JS injection)
- `{#if}`/`{#each}`/`{#await}`/`{#key}`/`{#snippet}` blocks with named
  fields for each head's sub-parts (`{#each}` → `iterable`/`binding`/
  `index`/`key`; `{#snippet}` → `name`/`params`; `{#await}` →
  `promise`/`keyword`/`binding`)
- `{:else}`/`{:else if}`/`{:then}`/`{:catch}` continuation branches
- `{@const}`/`{@html}`/`{@render}`/`{@debug}`/`{@attach}` commands
- bindingless `{#each items}` / `{#each items, index}` (chess-board form)

The external scanner tracks brace/paren/bracket nesting and string
literals so inner punctuation in `{#each foo(a, b) as item}` or
`{#await parse("foo as bar") then x}` doesn't break the boundary
detection. All block-tag delimiters share a `svelte_block_tag` alias
for a single highlight query.

README note about the upstream `tree-sitter@0.25.0` build patch
needed on Node 22+ (see `patches/tree-sitter@0.25.0.patch`).
