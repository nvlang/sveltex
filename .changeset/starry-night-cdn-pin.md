---
'@nvl/sveltex': patch
---

Pin the starry-night CSS CDN `<link>` to the installed `@wooorm/starry-night`
version, like the highlight.js and KaTeX backends already do, instead of
hard-coding `@latest` (which could drift out of sync with the classes SvelTeX
emits).
