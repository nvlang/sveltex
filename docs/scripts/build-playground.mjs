// File description: Builds the single-file browser ESM bundle of the SvelTeX
// preprocessor used by the docs "pipeline playground".
//
// SvelTeX cannot be naively bundled for the browser: `packages/sveltex/src/
// deps.ts` is a barrel module that statically re-exports Node builtins and
// Node-only npm packages (node-poppler has native bindings, plus svgo, glob,
// rimraf, find-cache-directory, node-fetch, ora). This script:
//
//   1. Uses `scripts/playground/entry.ts` as the entry, which re-exports
//      `sveltex` from the monorepo SOURCE (not the published v0.4.x package).
//   2. Aliases the `deps` barrel module to a hand-written browser shim
//      (`scripts/playground/deps.browser.ts`) that mirrors every export.
//   3. Marks the SvelTeX backend packages the playground never uses as
//      `external` (they are loaded via dynamic `import()` that never runs).
//   4. Resolves SvelTeX's bare dependency imports from
//      `packages/sveltex/node_modules`.
//
// Output: `docs/src/public/playground/sveltex-playground.mjs`. VitePress
// `srcDir` is `src`, so `src/public/` is served at the site root; the bundle
// is fetched at runtime as `/playground/sveltex-playground.mjs`.
//
// Wired to run before `vitepress dev` / `vitepress build` via the `predev` /
// `prebuild` scripts in `docs/package.json`.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const repoRoot = resolve(docsRoot, '..');

const sveltexPkg = resolve(repoRoot, 'packages/sveltex');
const realDeps = resolve(sveltexPkg, 'src/deps.ts');
const shimDeps = resolve(here, 'playground/deps.browser.ts');
const entry = resolve(here, 'playground/entry.ts');
const outfile = resolve(
    docsRoot,
    'src/public/playground/sveltex-playground.mjs',
);

// Backend packages SvelTeX loads via dynamic `import()`. The playground only
// uses the `marked` + `escape` + `katex` combination, so these are never
// executed; an unresolved `import()` that never runs is harmless. Marking them
// `external` keeps esbuild from trying to bundle them (some are Node-only).
//
// NOTE: `marked` and `katex` are intentionally NOT here -> they bundle in.
// NOTE: `micromark-*` util packages are NOT here -> they are needed and bundle.
// NOTE: the `micromark` package itself is NOT here -> `mdast-util-from-markdown`
//       (a core, always-bundled dependency) statically imports `postprocess` /
//       `preprocess` from it, so it must bundle.
// NOTE: `hast-util-*` packages are NOT here -> `deps.ts` statically imports
//       `hast-util-from-html` / `hast-util-to-html`, so they must bundle.
const external = [
    'shiki',
    '@mathjax/src',
    '@mathjax/src/*',
    'unified',
    'remark-parse',
    'remark-rehype',
    'remark-retext',
    'rehype-stringify',
    'markdown-it',
    'highlight.js',
    '@wooorm/starry-night',
    'hast-util-find-and-replace',
    // `TexComponent.ts` has a runtime `import('node-poppler')` (native
    // bindings) on the TeX-conversion path, which the playground never takes.
    'node-poppler',
];

/**
 * esbuild plugin that redirects the SvelTeX `deps` barrel module (imported
 * throughout the SvelTeX source as `../deps.js` / `../../deps.js`, all
 * resolving to `packages/sveltex/src/deps.ts`) to the browser shim.
 */
const depsAliasPlugin = {
    name: 'sveltex-deps-browser-alias',
    setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /(^|[\\/])deps(\.js|\.ts)?$/ }, (args) => {
            if (args.kind === 'entry-point') return null;
            const resolved = resolve(args.resolveDir, args.path);
            const isDepsBarrel =
                resolved === realDeps ||
                resolved === realDeps.replace(/\.ts$/, '.js') ||
                resolved === realDeps.replace(/\.ts$/, '');
            if (isDepsBarrel) {
                return { path: shimDeps };
            }
            return null;
        });
    },
};

/**
 * esbuild plugin that forces `decode-named-character-reference` to its
 * DOM-free `index.js` build.
 *
 * The package ships two builds: `index.dom.js` (keyed under the `browser`
 * export condition) does `document.createElement('i')` at module-init time,
 * and `index.js` (keyed under `worker`/`default`) uses a pure static lookup
 * table. The playground bundle runs inside a Web Worker, which has no
 * `document`, so the DOM build would throw the instant the bundle is imported.
 * A targeted alias is used instead of globally adding the `worker` export
 * condition, which would change resolution for unrelated packages too.
 */
const decodeEntitiesWorkerPlugin = {
    name: 'decode-named-character-reference-worker',
    setup(pluginBuild) {
        pluginBuild.onResolve(
            { filter: /^decode-named-character-reference$/ },
            async (args) => {
                // Avoid infinite recursion: the nested `resolve()` below
                // re-triggers this same `onResolve` filter.
                if (args.pluginData?.skipDecodeEntitiesWorkerPlugin) {
                    return null;
                }
                // Resolve the package normally (esbuild's `browser` platform
                // would pick `index.dom.js`), then swap it for the DOM-free
                // sibling `index.js`.
                const resolved = await pluginBuild.resolve(args.path, {
                    kind: 'import-statement',
                    resolveDir: args.resolveDir,
                    pluginData: { skipDecodeEntitiesWorkerPlugin: true },
                });
                if (resolved.errors.length > 0 || !resolved.path) {
                    return null;
                }
                return {
                    path: resolved.path.replace(
                        /index\.dom\.js$/,
                        'index.js',
                    ),
                };
            },
        );
    },
};

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    if (!(await exists(resolve(sveltexPkg, 'node_modules')))) {
        throw new Error(
            'packages/sveltex/node_modules is missing. Run a monorepo-root ' +
                '`pnpm install` before building the playground bundle.',
        );
    }

    await mkdir(dirname(outfile), { recursive: true });

    const result = await build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'browser',
        splitting: false,
        target: 'es2022',
        minify: true,
        sourcemap: false,
        legalComments: 'none',
        external,
        plugins: [depsAliasPlugin, decodeEntitiesWorkerPlugin],
        // SvelTeX's dependencies live in `packages/sveltex/node_modules`.
        // `nodePaths` lets esbuild resolve those bare imports even though the
        // bundle is built from within `docs/`.
        nodePaths: [
            resolve(sveltexPkg, 'node_modules'),
            resolve(repoRoot, 'node_modules'),
        ],
        define: {
            'process.env.NODE_ENV': '"production"',
        },
        logLevel: 'warning',
        metafile: true,
    });

    const { bytes } = Object.values(result.metafile.outputs)[0];
    const kib = (bytes / 1024).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(
        `[build-playground] wrote ${outfile.replace(repoRoot + '/', '')} ` +
            `(${kib} KiB)`,
    );
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[build-playground] failed:\n', err);
    process.exit(1);
});
