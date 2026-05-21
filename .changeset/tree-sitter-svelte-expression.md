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

- `{@const}`, `{@html}`, `{@render}`, `{@debug}`, `{@attach}` — the
  `@`-commands (the last is Svelte 5.29+).
- `{#if condition} … {:else if c2} … {:else} … {/if}` — conditional
  branches via `svelte_branch_else_if` and `svelte_branch_else`.
- `{#each items as item, i (key)} … {:else} … {/each}` — iteration; the
  head is kept as one opaque expression body for the JS injection. Also
  supports the bindingless `{#each expr}` / `{#each expr, index}` forms
  (chess-board / N-times iteration per the upstream docs).
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

The `{#each}` head is further decomposed into named fields:
`iterable`, `as`, `binding`, optional `index`, optional `key`. The
external scanner tracks brace / paren / bracket nesting and string
literals so a `,` inside `(item.id, count)` or an `as` inside
`"name as alias"` doesn't fire prematurely. The JavaScript injection
applies only to `iterable` and `key`; `binding` and `index` are
Svelte-side parameter patterns, kept un-injected so JS doesn't
mis-render `{ name, age }` destructuring as a block statement.

`{#snippet name(params)}` decomposes into `name` (an identifier
captured as `@function` in highlights) and `params` (the parameter
list inside the parens, captured as a `svelte_snippet_params` node
that gets the JS injection — so destructuring patterns like
`{#snippet box({width, height})}` parse and highlight correctly).

`{#await promise}` gains a shorthand-form decomposition: the
`promise` is its own node (with JS injection) and, when the
shorthand `{#await … then value}` / `{#await … catch error}` form
is used, the keyword and binding surface as `svelte_await_keyword`
and `svelte_await_binding` fields. The promise scanner detects the
` then `/` catch ` boundary while respecting nested calls
(`promise.then(transform)` doesn't trigger the boundary inside the
expression) and string literals.
