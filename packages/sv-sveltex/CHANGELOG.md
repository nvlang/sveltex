# @nvl/sv-sveltex

## 0.2.0

### Minor Changes

- [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64)
  Thanks [@nvlang](https://github.com/nvlang)! - The add-on now always emits
  `sveltex.config.js` (never `.ts`), sidestepping a `tsx`/loader rabbit hole and
  giving the SvelTeX language server a single, stable filename to resolve.
  Raises `engines.node` from `>=18` to `>=22` to match the rest of the SvelTeX
  toolchain.
