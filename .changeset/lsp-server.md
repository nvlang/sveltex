---
'sveltex': minor
---

Add a SvelTeX language server. The VS Code extension now starts a full
language server (the new `@nvl/sveltex-language-server` package). For the
delegated regions of a `.sveltex` file it proxies the Svelte language
server — diagnostics, hover, completion, go-to-definition, references,
rename and more — while suppressing it inside verbatim, code, math and
frontmatter regions. It also adds native features computed directly from the
source: a Markdown heading outline, folding ranges, selection ranges, and —
in the YAML / TOML / JSON frontmatter block — context-aware hover and
completion for the frontmatter keys (`title`, `meta`, `base`, `link`, …) and
standard `<meta>` names, each documented with a link to MDN. The server core
is transport-agnostic, so the same core backs both the VS Code extension and
a Zed extension.
