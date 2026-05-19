---
'@nvl/sveltex': patch
---

Emit Svelte 5's `<script module>` for the frontmatter `metadata`
export, instead of the `<script context="module">` syntax that Svelte 5
deprecated (`script_context_deprecated`) and Svelte 6 removes. Building
a `.sveltex` page with frontmatter no longer logs a deprecation warning.
User-authored `<script context="module">` blocks are still recognized.
