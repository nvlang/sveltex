# @nvl/sveltex-math-language-server

## 0.2.1

### Patch Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`9a2095d`](https://github.com/nvlang/sveltex/commit/9a2095d6d0a53f0883d80ae84ec02d475d0dc6ea)
  Thanks [@nvlang](https://github.com/nvlang)! - Refresh dependencies. The
  peer/runtime-facing changes are both in `@nvl/sveltex`: the `svelte` floor
  (`^5.55.7` → `^5.55.9`) and the optional `katex` peer range, widened to
  `^0.16 || ^0.17` (the test suite now runs against katex `0.17`). Everything
  else is a dev-dependency bump (`katex`, `markdown-it`, `knip`, `tsdown`, …).
  (`@nvl/sveltex-language-server`, `@nvl/tree-sitter-sveltex`,
  `@nvl/tree-sitter-markdown-sveltex`, and `vscode-sveltex` got the same refresh
  and ride their other changesets.)

## 0.2.0

### Minor Changes

- [`aa69190`](https://github.com/nvlang/sveltex/commit/aa691900e9279da6fd643994c3d1a838fe4f001b)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/sveltex-math-language-server`, plus the wiring in
  `@nvl/sveltex-language-server` that forwards math and LaTeX regions to it.

    The SvelTeX language server now offers TeX-math and LaTeX assistance. The
    new `@nvl/sveltex-math-language-server` package provides command/macro
    completion (triggered on `\`) and hover for the math inside `$…$` / `$$…$$`
    regions, accurately scoped to the project's math backend (KaTeX or MathJax —
    their command sets differ, and the lists are extracted from each engine's
    own package source). The hover shows a command's signature, the Unicode
    symbol it renders (e.g. `∮ (contour integral)`), a one-line description and
    the providing package. The language server forwards math regions to it, and
    forwards LaTeX verbatim regions (`<tex>` / `<latex>` / `<tikz>`) to
    [TexLab](https://github.com/latex-lsp/texlab) when a `texlab` binary is on
    `PATH`. Both are skipped gracefully when unavailable.
