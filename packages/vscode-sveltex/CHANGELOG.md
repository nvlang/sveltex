# Change Log

## 2.0.0

### Major Changes

- [`47b6bc1`](https://github.com/nvlang/sveltex/commit/47b6bc1a27125114887fcec89b0211714024f85e)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/sveltex-language-server`. The VS Code extension now starts a full
  language server (the new `@nvl/sveltex-language-server` package). For the
  delegated regions of a `.sveltex` file it proxies the Svelte language server —
  diagnostics, hover, completion, go-to-definition, references, rename and more
  — while suppressing it inside verbatim, code, math and frontmatter regions. It
  also adds native features computed directly from the source: a Markdown
  heading outline, folding ranges, selection ranges, and — in the YAML / TOML /
  JSON frontmatter block — context-aware hover and completion for the
  frontmatter keys (`title`, `meta`, `base`, `link`, …) and standard `<meta>`
  names, each documented with a link to MDN. The server core is
  transport-agnostic, so the same core backs both the VS Code extension and a
  Zed extension.

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

### Patch Changes

- Updated dependencies
  [[`b6617c0`](https://github.com/nvlang/sveltex/commit/b6617c0ae23c873e6866e86434198e197d9256ae),
  [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64),
  [`47b6bc1`](https://github.com/nvlang/sveltex/commit/47b6bc1a27125114887fcec89b0211714024f85e),
  [`aa69190`](https://github.com/nvlang/sveltex/commit/aa691900e9279da6fd643994c3d1a838fe4f001b)]:
    - @nvl/sveltex-language-server@0.2.0
    - @nvl/sveltex-math-language-server@0.2.0

## [1.0.3] - 2025-04-29

### Documentation

- Fixed link to screenshot in `README.md`.

### Build

- Reduce extension size by not bundling unnecessary files.

## [1.0.2] - 2024-07-09

### Fixes

- Increased specificity of scopes of some pattern injections to avoid conflicts
  with e.g. the comment or string scopes within script blocks.

### Dev Dependencies

- Updated `@types/node`: `^20.14.9` → `^20.14.10`.

## [1.0.1] - 2024-06-30

### Documentation

- Improved `README.md` for rendering on the VS Code Marketplace.

## [1.0.0] - 2024-06-30

### Features

- Added basic support for SvelTeX syntax highlighting.
