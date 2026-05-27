# @nvl/sv-sveltex

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

- [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64)
  Thanks [@nvlang](https://github.com/nvlang)! - The add-on now always emits
  `sveltex.config.js` (never `.ts`), sidestepping a `tsx`/loader rabbit hole and
  giving the SvelTeX language server a single, stable filename to resolve.
  Raises `engines.node` from `>=18` to `>=22` to match the rest of the SvelTeX
  toolchain.
