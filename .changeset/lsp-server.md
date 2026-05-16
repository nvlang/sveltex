---
'sveltex': minor
---

Add a SvelTeX language server. The VS Code extension now starts a full
language server (the new `@nvl/sveltex-language-server` package). For the
delegated regions of a `.sveltex` file it proxies the Svelte language
server — diagnostics, hover, completion, go-to-definition, references,
rename and more — while suppressing it inside verbatim, code, math and
frontmatter regions, and it adds native Markdown features (document
symbols, folding ranges, selection ranges). The server core is
transport-agnostic, so it can also back a future Zed extension.
