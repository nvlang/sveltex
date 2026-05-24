---
'@nvl/tree-sitter-sveltex': patch
---

Require a verbatim environment's close tag to match its open tag, the way
SvelTeX's own back-referenced `</\1>` matching does. Previously any verbatim
close tag ended the environment, so `<tex>…</latex>` parsed as a complete
(LaTeX-highlighted) `tex` environment even though SvelTeX would not compile it
as one. Now the body runs until the matching `</tex>` (compared
case-insensitively, like SvelTeX's `i` flag): a non-matching `</latex>` is part
of the body, and an environment with no matching close is left incomplete —
matching how SvelTeX actually parses the source. The external scanner records
the open tag name (and is now serialized/deserialized) to enforce this.
