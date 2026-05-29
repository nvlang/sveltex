---
'@nvl/sveltex': minor
---

Make block code listings keyboard-accessible by default. A code block can scroll
horizontally, and [WCAG 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
requires that scrolling be keyboard-operable, so SvelTeX now adds `tabindex="0"`,
`role="figure"` (the ARIA role for code snippets — and, unlike `role="region"`,
not a landmark, so code-heavy pages don't flood the landmark menu), and a
language-aware `aria-label` (e.g. `"TypeScript code block"`, resolved through
`langAlias` and the new `@nvl/tag-to-code-lang` dependency) to each generated
`<pre>`. A scoped `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->`
precedes each one, so Svelte's false-positive warning is silenced there only —
never for your own markup. Inline code spans are untouched.

Configure or turn it off with the new `code.a11y` option — `true` (default),
`false`, or `{ role, label }` to customise the ARIA role and the accessible-name
builder (e.g. to localise it). Shiki's own `tabindex` is left off, since this
treatment applies the attribute uniformly across every code backend.
