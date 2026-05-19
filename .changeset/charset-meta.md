---
'@nvl/sveltex': patch
---

Fix `charset` frontmatter handling to emit the HTML-correct
`<meta charset="…">` instead of the invalid `<meta name="charset"
content="…">`. The fix covers all three input shapes:

- top-level `charset: utf-8`,
- `meta:` mapping form (`meta: { charset: utf-8 }`),
- `meta:` array form (`meta: [{ name: charset, content: utf-8 }]`).

Duplicate `charset` entries are deduplicated (last one wins, with a
warning); other `<meta>` and `<meta http-equiv>` entries are preserved
when a `charset` is added (and vice versa).
