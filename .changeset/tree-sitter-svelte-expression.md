---
'@nvl/tree-sitter-sveltex': minor
---

Recognise Svelte mustache expressions (`{...}`) as a top-level construct
distinct from `markdown_chunk`. The body of each expression is exposed as
a `svelte_expression_body` node so editor injections can hand it to a
JavaScript grammar for highlighting; the braces themselves are matched by
the LR grammar.

Brace-depth tracking with string-literal awareness handles the awkward
cases — strings containing `}`, nested object literals, template literals
with `${...}`, multi-line expressions. Backslash-escaped braces (`\{` /
`\}`) remain plain Markdown.

Svelte block-tag sigils (`{#if}` / `{/if}` / `{:else}` / `{@const}`) are
parsed as ordinary mustache expressions whose body happens to start with
`#`/`:`/`/`/`@`. First-class block-tag parsing is a separate follow-up;
in the meantime the JavaScript injection will flag the sigils as syntax
errors, which is the expected fallback.
