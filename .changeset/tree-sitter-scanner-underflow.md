---
'@nvl/tree-sitter-sveltex': patch
---

Fix an unsigned-integer underflow in the external scanner's
`{#each … as BINDING}` and `(KEY)` / `(PARAMS)` scanners: an unbalanced `}` or
`)` inside the binding/key (e.g. `{#each x as [a}]}`) drove a depth counter
below zero, making the scanner swallow the rest of the document into a single
error node. The brace/paren decrements are now guarded like their sibling
bracket cases.

Also widens the scanner's fixed tag-name buffer (32 → 64 bytes) so a long
element/component name is recognised rather than silently treated as plain
text; an over-long name still falls through safely to "not a tag".
