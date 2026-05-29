---
'@nvl/sveltex': patch
---

Disable Shiki's `tabindex="0"` on the `<pre>` element by default — it tripped
Svelte's `a11y_no_noninteractive_tabindex` warning on every build. Set
`code.shiki.tabindex` back to `0` to restore keyboard-scrollable code blocks.
