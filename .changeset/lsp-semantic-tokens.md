---
'@nvl/sveltex-language-server': minor
---

Emit `textDocument/semanticTokens` for the body of every user-configured
verbatim region so editors that don't recognise the tag (notably Zed,
where the tree-sitter grammar can't be parameterised) still colour it.

How the body is tokenised:

- **Standard tags** (`tex`, `latex`, `tikz`, `verb`, `verbatim`,
  case-insensitive) — skipped. The editor grammars (TextMate in VS Code,
  tree-sitter in Zed) already paint them with full LaTeX / fenced-code
  colouring; emitting tokens here would *replace* that with something
  coarser.
- **Custom latex-typed tags** (those in the user's `latexTags`) — the
  body is tokenised through the bundled `text.tex.latex` TextMate
  grammar (vendored from `jlelong/vscode-latex-basics`) via
  `vscode-textmate`. TextMate scopes are mapped onto a small LSP
  vocabulary (`comment`, `function`, `keyword`, `string`, `number`,
  `operator`, `variable`). Punctuation and whitespace are left
  un-tokenised so the editor's static grammar (if any) shines through
  for those ranges.
- **Custom non-latex verbatim** (escape / code / noop) — one flat
  `string` token per body line. Literal text gets a uniform colour, no
  syntactic distinctions to make.

The LaTeX TextMate grammar is loaded lazily on first request and cached
for the life of the server process.
