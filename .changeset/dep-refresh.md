---
'@nvl/sveltex': patch
'@nvl/sveltex-math-language-server': patch
'@nvl/sv-sveltex': patch
---

Refresh dependencies. The peer/runtime-facing changes are both in
`@nvl/sveltex`: the `svelte` floor (`^5.55.7` → `^5.55.9`) and the optional
`katex` peer range, widened to `^0.16 || ^0.17` (the test suite now runs
against katex `0.17`). Everything else is a dev-dependency bump (`katex`,
`markdown-it`, `knip`, `tsdown`, …). (`@nvl/sveltex-language-server`,
`@nvl/tree-sitter-sveltex`, `@nvl/tree-sitter-markdown-sveltex`, and
`vscode-sveltex` got the same refresh and ride their other changesets.)
