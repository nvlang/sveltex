---
'@nvl/sveltex': minor
---

Add a `frontmatter` configuration option controlling which of SvelTeX's
three frontmatter-processing steps run. Each toggles independently —
`head` (the generated `<svelte:head>`), `metadata` (the
`export const metadata` module-script export), and `imports` (the
`imports` frontmatter key) — or all at once via `frontmatter: false`.

This makes the `<svelte:head>` injection opt-out: set
`frontmatter: { head: false }` to build the document's `<head>` yourself
while still reading the frontmatter from the `metadata` export. The
frontmatter block is still parsed, stripped from the output, and passed
to transformers regardless. Resolves #24.
