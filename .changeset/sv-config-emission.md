---
'@nvl/sveltex-sv': minor
---

The add-on now always emits `sveltex.config.js` (never `.ts`),
sidestepping a `tsx`/loader rabbit hole and giving the SvelTeX
language server a single, stable filename to resolve. Raises
`engines.node` from `>=18` to `>=22` to match the rest of the SvelTeX
toolchain.
