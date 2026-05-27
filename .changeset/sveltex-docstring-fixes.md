---
'@nvl/sveltex': patch
---

Polish the TSDoc across the public type surface — these comments ship in the
`.d.ts` files, so they drive editor IntelliSense (and now the generated API
reference on the docs site). No runtime behavior changes.

- The `getDefault*` helpers now document their type parameters.
- `@defaultValue` tags with a simple literal value (`true`, `'src/sveltex'`,
  `[]`, …) are written inline rather than as a fenced block.
- `MathBackend`'s union is reordered so `'mathjax'` comes first.
- Fixed a broken `verbatim` link, a dropped second `@remarks` block on the
  micromark `options`, an unresolvable `{@link CodeHandler}`, and a
  `node-poppler` typo.
