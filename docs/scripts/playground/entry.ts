// File description: Entry point for the playground browser bundle.
//
// Re-exports `sveltex` from the monorepo SOURCE (not the published
// `@nvl/sveltex` package, which is v0.4.x and lacks the `trace` method the
// playground relies on). `scripts/build-playground.mjs` bundles this with
// esbuild into a single browser-ready ESM file.

export { sveltex } from '../../../packages/sveltex/src/base/Sveltex.js';
