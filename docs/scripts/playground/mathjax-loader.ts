// File description: Browser-safe loader for MathJax v4's component system,
// used by the docs "pipeline playground".
//
// MathJax v4 splits itself into many small components (`input/tex`,
// `output/chtml`, `adaptors/liteDOM`, the accessibility extensions, ...) plus
// per-glyph-group font-data files. SvelTeX's `MathHandler` loads these lazily
// at runtime through MathJax's *loader*: `MathJax.config.loader.require(url)`,
// where `url` is a component specifier such as
// `@mathjax/src/bundle/input/tex.js` or
// `@mathjax/mathjax-newcm-font/chtml/dynamic/calligraphic.js`.
//
// In Node, that `require` hook is `(file) => import(file)` and resolves
// against `node_modules`. In a browser Web Worker there is no module
// resolver, so a bare specifier passed to a runtime `import()` would fail.
//
// This module provides a `require` hook that works in the bundled worker.
// `scripts/build-playground.mjs` supplies the generated virtual module
// `virtual:mathjax-components`, an object mapping every shippable MathJax
// component / font-data specifier to a thunk `() => import('<literal path>')`.
// Because each `import()` argument is a string literal, esbuild can statically
// resolve it and bundle the component into the playground bundle. The hook
// below normalises whatever specifier MathJax hands it and looks it up there.
//
// `worker.ts` passes `mathjaxRequire` to SvelTeX as
// `math.mathjax.loader.require`; `MathHandler` deep-merges it into MathJax's
// loader configuration, overriding the Node-only default.

// The generated map: specifier -> `() => import('<absolute file path>')`.
// `build-playground.mjs` resolves and supplies this virtual module.
import { components } from 'virtual:mathjax-components';

// Ambient shape of the bundler-generated virtual module. The real module is
// produced by `build-playground.mjs`'s `mathjaxComponentsPlugin`.
declare module 'virtual:mathjax-components' {
    /** Maps each MathJax component specifier to a lazy `import()` thunk. */
    export const components: Record<string, () => Promise<unknown>>;
}

/**
 * Normalises a MathJax component specifier into the key form used by the
 * generated `components` map.
 *
 * MathJax's loader emits specifiers in a handful of shapes depending on the
 * path filters that ran (see `@mathjax/src`'s loader `PathFilters`):
 *
 *   - bare package specifiers, e.g. `@mathjax/src/bundle/input/tex.js`;
 *   - already-prefixed `[mathjax]/...` forms, if a filter did not expand them;
 *   - occasionally a trailing query/hash.
 *
 * The generated map is keyed by the bare package specifier with a `.js`
 * extension, so this strips any `[...]/` prefix, query, or hash and ensures
 * the `.js` suffix.
 */
function normalizeSpecifier(spec: string): string {
    const s = spec
        .trim()
        // Drop any `?query` / `#hash` suffix.
        .replace(/[?#].*$/u, '')
        // Drop a leading `[name]/` path-prefix marker, if present.
        .replace(/^\[[^\]]*\]\//u, '');
    // Ensure a file extension (MathJax's `addExtension` filter adds `.js`).
    return /\.[^/]+$/u.test(s) ? s : `${s}.js`;
}

/**
 * MathJax loader `require` hook for the playground bundle.
 *
 * Resolves a MathJax component / font-data specifier to the corresponding
 * statically-bundled module. Returns the module namespace (MathJax's component
 * files are side-effecting bundles that register themselves on the global
 * `MathJax`; the namespace itself is unused but kept so the loader can `await`
 * it).
 *
 * @param file - The component specifier emitted by MathJax's loader.
 * @returns A promise resolving to the loaded component module.
 * @throws If the specifier is not one of the components bundled into the
 * playground -- which would indicate the bundler's component list is stale.
 */
export async function mathjaxRequire(file: string): Promise<unknown> {
    const key = normalizeSpecifier(file);
    const load = components[key];
    if (!load) {
        throw new Error(
            `[playground] MathJax requested component "${file}" ` +
                `(normalised: "${key}"), which is not bundled. ` +
                'The bundler\'s MathJax component list may be out of date.',
        );
    }
    return load();
}
