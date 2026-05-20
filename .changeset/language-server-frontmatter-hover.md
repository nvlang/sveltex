---
'@nvl/sveltex-language-server': minor
---

Enrich the frontmatter hover for top-level keys in `.sveltex` files: the
hover body now appends one section per frontmatter-processing step the
key takes part in — what it inserts into `<svelte:head>` (for `<title>`,
`<meta>`, `<link>`, `<base>`, `<noscript>` keys) and its entry in the
`metadata` export — each with the `frontmatter: { … }` toggle that
switches that step off.

The `imports` key gets a dedicated section describing the `import`
statements it generates. Nested-block keys (inside `meta` / `base` /
`link`) and value hovers continue to show the plain entry summary.
