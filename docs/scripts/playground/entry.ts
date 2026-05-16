// File description: Entry point for the playground browser bundle.
//
// Re-exports `sveltex` from the monorepo SOURCE (not the published
// `@nvl/sveltex` package, which is v0.4.x and lacks the `trace` method the
// playground relies on). `scripts/build-playground.mjs` bundles this with
// esbuild into a single browser-ready ESM file.
//
// Also re-exports `mathjaxRequire`: the MathJax v4 component-loader hook that
// makes MathJax's lazily-loaded components and font data resolvable inside the
// bundled Web Worker. `worker.ts` passes it to SvelTeX as the MathJax
// `loader.require` override (see `scripts/playground/mathjax-loader.ts`).

export { sveltex } from '../../../packages/sveltex/src/base/Sveltex.js';
export { mathjaxRequire } from './mathjax-loader.js';
