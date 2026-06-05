---
'@nvl/sveltex': minor
---

Enable GFM for the `unified` markdown backend by default: tables, strikethrough,
task lists, and footnotes now render out of the box, instead of being silently
emitted as raw text. This brings the recommended backend in line with what the
others already do. GFM autolink-literals are intentionally left out, since
autolinks clash with Svelte component syntax (SvelTeX disables them on every
backend). The docs gain a backend feature-support matrix.
