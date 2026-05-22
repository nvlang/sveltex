---
'@nvl/sveltex': patch
'@nvl/sveltex-math-language-server': patch
'@nvl/sv-sveltex': patch
---

Refresh in-range (caret) dependencies via a repo-wide `pnpm up`. The only
runtime-facing change is `@nvl/sveltex`'s `svelte` floor (`^5.55.7` →
`^5.55.9`); the rest are dev-dependency bumps. (`@nvl/sveltex-language-server`,
`@nvl/tree-sitter-sveltex`, `@nvl/tree-sitter-markdown-sveltex`, and
`vscode-sveltex` got the same refresh and ride their other changesets.)
