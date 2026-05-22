---
'sveltex': patch
---

Disable indented (4-space) code blocks in the VS Code extension's
Markdown TextMate grammar, matching the forked tree-sitter grammar and
SvelTeX's own Markdown parsing: 4-space-indented prose stays a paragraph
(with its inline markup still highlighted) instead of being coloured as a
code block.
