---
'@nvl/sveltex': patch
---

Two correctness fixes:

- Config diagnostics now report the offending value of a nested option. An
  invalid `css.type` such as `'cdn'` was reported as `Instead, got undefined`
  instead of naming the actual value.
- The `marked` backend no longer turns `<https://…>` into a corrupt
  `href="…%3E"` link. Autolinks are disabled (their `<…>` clashes with Svelte
  components), and bare-URL linking is now disabled too, matching the other
  backends.
