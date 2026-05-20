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

The hover heading now shows what SvelTeX actually renders for the
key, with `〈value〉` / `〈href〉` / `〈target〉` placeholders standing
in for the parts that come from the user's frontmatter — e.g. for
`color-scheme`:

```
**`color-scheme`** — renders `<meta name="color-scheme" content="〈value〉">`
```

rather than the previously misleading `renders <meta name="color-scheme">`
(which omitted the `content` attribute) or `renders <base>` (which
suggested an empty element). The summaries for `base`, `meta`, `link`
and `imports` also now spell out the required sub-fields each one
expects.
