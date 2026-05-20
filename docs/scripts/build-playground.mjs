// File description: Builds the single-file browser ESM bundle of the SvelTeX
// preprocessor used by the docs "pipeline playground".
//
// SvelTeX cannot be naively bundled for the browser: `packages/sveltex/src/
// deps.ts` is a barrel module that statically re-exports Node builtins and
// Node-only npm packages (node-poppler has native bindings, plus svgo, glob,
// rimraf, find-cache-directory, ora). This script:
//
//   1. Uses `scripts/playground/entry.ts` as the entry, which re-exports
//      `sveltex` from the monorepo SOURCE (not the published v0.4.x package).
//   2. Aliases the `deps` barrel module to a hand-written browser shim
//      (`scripts/playground/deps.browser.ts`) that mirrors every export.
//   3. Marks the SvelTeX backend packages the playground never uses as
//      `external` (they are loaded via dynamic `import()` that never runs).
//   4. Resolves SvelTeX's bare dependency imports from
//      `packages/sveltex/node_modules`.
//   5. Supplies the generated virtual module `virtual:mathjax-components`,
//      which lets MathJax v4's lazily-loaded components and font data resolve
//      inside the bundled Web Worker (see below and `mathjax-loader.ts`).
//
// The playground uses SvelTeX's `unified` (Markdown), `shiki` (code) and
// `mathjax` (math) backends, so those -- and their dependencies -- are bundled
// rather than externalized.
//
// MathJax v4 in a Web Worker: SvelTeX loads MathJax through its component
// loader, which lazily `import()`s small component bundles and per-glyph-group
// font data via `MathJax.config.loader.require`. Those specifiers are
// runtime-computed bare paths, which a browser cannot resolve. The
// `mathjaxComponentsPlugin` below generates a virtual module enumerating every
// shippable MathJax component / font file as a string-literal `import()`, so
// esbuild can statically resolve and bundle them; `worker.ts` wires the
// resulting `mathjaxRequire` hook into SvelTeX. CHTML output is used (SvelTeX's
// default): MathJax v4's CHTML renderer needs no DOM measurement and works with
// the DOM-free `liteDOM` adaptor, exactly as it does in a Node build.
//
// One MathJax `import()` is not routed through that loader hook: `MathHandler`
// imports the startup bundle directly, but via a `const`-bound string variable
// (`import(startupBundle)`) so two type-checkers agree on the declaration-less
// path. esbuild does not constant-fold a variable into a dynamic `import()`, so
// it would leave the specifier as an unresolvable bare path. The
// `mathjaxStartupPlugin` rewrites that one `import()` to a string literal at
// load time, so esbuild bundles the startup component too.
//
// shiki in a Web Worker: shiki's default highlighter uses an Oniguruma WASM
// regex engine, loaded via `import('shiki/wasm')`. That subpath re-exports
// `@shikijs/engine-oniguruma/wasm-inlined`, which carries the WASM as an
// inlined base64 `Uint8Array` (no separate `.wasm` asset, no `fetch`). esbuild
// bundles it directly, so shiki works in the worker with no extra handling.
//
// Output: `docs/src/public/playground/sveltex-playground.mjs`. VitePress
// `srcDir` is `src`, so `src/public/` is served at the site root; the bundle
// is fetched at runtime as `/playground/sveltex-playground.mjs`. The bundle is
// large (MathJax and shiki are sizable), which is fine for a lazily-loaded,
// worker-only asset.
//
// This script also stages the playground editor's syntax-highlighting
// grammars: it combines the `svelte`, `markdown` and `sveltex` TextMate
// grammars into `src/public/playground/editor-grammars.json`, which
// `Playground.vue` fetches to syntax-highlight the input editor with Shiki.
//
// Wired to run before `vitepress dev` / `vitepress build` via the `predev` /
// `prebuild` scripts in `docs/package.json`.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import jsYaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const repoRoot = resolve(docsRoot, '..');

const sveltexPkg = resolve(repoRoot, 'packages/sveltex');
const mathHandlerSrc = resolve(sveltexPkg, 'src/handlers/MathHandler.ts');
const realDeps = resolve(sveltexPkg, 'src/deps.ts');
const shimDeps = resolve(here, 'playground/deps.browser.ts');
const entry = resolve(here, 'playground/entry.ts');
const outfile = resolve(
    docsRoot,
    'src/public/playground/sveltex-playground.mjs',
);

// Backend packages SvelTeX loads via dynamic `import()` for the backend
// combinations the playground does NOT use. The playground uses the `unified`
// + `shiki` + `mathjax` combination, so only the *other* backends' packages
// are externalized: their `import()`s never run, and an unresolved `import()`
// that never runs is harmless. Marking them `external` keeps esbuild from
// trying to bundle them (some are Node-only).
//
// NOTE: `unified` / `remark-*` / `rehype-stringify` are NOT here -> the
//       `unified` Markdown backend needs them, so they bundle in.
// NOTE: `shiki` is NOT here -> the `shiki` code backend needs it; it (and its
//       inlined-WASM Oniguruma engine) bundle in.
// NOTE: `@mathjax/src` is NOT here -> the `mathjax` math backend needs it.
//       SvelTeX statically imports `@mathjax/src/js/components/global.js` and
//       has constant-folded `import()`s of `@mathjax/src/bundle/startup.js`;
//       the lazily-loaded components/fonts are handled by
//       `mathjaxComponentsPlugin` (see below).
// NOTE: `marked` / `markdown-it` / `katex` / `highlight.js` /
//       `@wooorm/starry-night` ARE here -> they back the unused Markdown / math
//       / code backends.
// NOTE: `micromark-*` util packages are NOT here -> they are needed and bundle.
// NOTE: the `micromark` package itself is NOT here -> `mdast-util-from-markdown`
//       (a core, always-bundled dependency) statically imports `postprocess` /
//       `preprocess` from it, so it must bundle.
// NOTE: `hast-util-*` packages are NOT here -> `deps.ts` statically imports
//       `hast-util-from-html` / `hast-util-to-html`, so they must bundle.
const external = [
    // Markdown backends the playground does not use.
    'marked',
    'markdown-it',
    // Code backends the playground does not use.
    'highlight.js',
    '@wooorm/starry-night',
    'hast-util-find-and-replace',
    // Math backends the playground does not use.
    'katex',
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

/**
 * esbuild plugin that rewrites SvelTeX's one indirect MathJax `import()` into a
 * string-literal one so esbuild bundles the startup component.
 *
 * `MathHandler.ts` loads the MathJax startup bundle with
 * `await import(startupBundle)`, where `startupBundle` is a `const`-bound
 * string -- a deliberate indirection so that `tsc` and Deno's type-checker
 * agree about the declaration-less prebuilt path. esbuild does not
 * constant-fold a variable into a dynamic `import()`, so it would emit the
 * specifier as an unresolvable bare path. This `onLoad` hook reads the
 * (unmodified) `MathHandler.ts` source and replaces just that `import()`
 * argument with the string literal, leaving the source file on disk untouched.
 */
const mathjaxStartupPlugin = {
    name: 'sveltex-mathjax-startup',
    setup(pluginBuild) {
        pluginBuild.onLoad(
            { filter: /[\\/]MathHandler\.ts$/ },
            async (args) => {
                if (resolve(args.path) !== mathHandlerSrc) return null;
                const source = await readFile(args.path, 'utf8');
                // `import(startupBundle)` -> `import('<the literal>')`.
                const patched = source.replace(
                    /\bimport\(\s*startupBundle\s*\)/,
                    "import('@mathjax/src/bundle/startup.js')",
                );
                if (patched === source) {
                    throw new Error(
                        '[build-playground] expected `import(startupBundle)` ' +
                            'in MathHandler.ts; the MathJax startup import may ' +
                            'have been refactored.',
                    );
                }
                return { contents: patched, loader: 'ts' };
            },
        );
    },
};

/**
 * Lists every `.js` file under `dir` (recursively), as paths relative to
 * `dir`, joined with `/`. Returns an empty list if `dir` does not exist.
 */
async function listJsFiles(dir) {
    const out = [];
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            for (const nested of await listJsFiles(join(dir, entry.name))) {
                out.push(`${entry.name}/${nested}`);
            }
        } else if (entry.name.endsWith('.js')) {
            out.push(entry.name);
        }
    }
    return out;
}

/**
 * Builds the source of the `virtual:mathjax-components` module: an object
 * mapping each MathJax component / font-data specifier (the form
 * `MathJax.config.loader.require` is called with) to a thunk
 * `() => import('<absolute file path>')`.
 *
 * Every `import()` argument is a string literal, so esbuild statically
 * resolves it and bundles the (already-minified, self-contained) MathJax
 * component bundle into the playground bundle. The redundant all-in-one
 * MathJax bundles (`tex-*.js`, `mml-*.js`, `node-main.js` at the `bundle/`
 * root) and the multi-megabyte speech-rule-engine data are deliberately
 * excluded -- SvelTeX loads only the individual components, and emits
 * assistive MathML rather than speech strings by default.
 *
 * @returns The generated module source.
 */
async function generateMathjaxComponentsModule() {
    // Resolve MathJax's on-disk location the same way SvelTeX's `MathHandler`
    // does at runtime -- from within `packages/sveltex`.
    const requireFromSveltex = createRequire(
        resolve(sveltexPkg, 'src/handlers/MathHandler.ts'),
    );
    // `@mathjax/src/bundle/` holds the prebuilt component bundles; the
    // `newcm` font package holds the CHTML font data. CHTML is SvelTeX's
    // default output format and needs no DOM, so only CHTML font data is
    // bundled (the SVG font data would only bloat the bundle).
    const bundleDir = dirname(
        requireFromSveltex.resolve('@mathjax/src/bundle/startup.js'),
    );
    const fontChtmlEntry = requireFromSveltex.resolve(
        '@mathjax/mathjax-newcm-font/chtml.js',
    );
    const fontDir = dirname(fontChtmlEntry);

    /** specifier (loader `require` argument) -> absolute file path. */
    const entries = new Map();

    // MathJax components SvelTeX's loader requests. `core`, `startup` and
    // `loader` are the runtime; `input/tex` (+ its extension packages) is the
    // TeX input; `output/chtml` is the renderer; `adaptors/liteDOM` is the
    // DOM-free document adaptor; `a11y/assistive-mml` emits assistive MathML.
    const bundleFiles = [
        'core.js',
        'loader.js',
        'startup.js',
        'input/tex.js',
        'input/tex-base.js',
        'output/chtml.js',
        'adaptors/liteDOM.js',
        'a11y/assistive-mml.js',
        // TeX extension packages a playground user might type (`\ce{...}`,
        // `\require{...}`, ...); each is a small self-contained bundle.
        ...(await listJsFiles(join(bundleDir, 'input/tex/extensions'))).map(
            (f) => `input/tex/extensions/${f}`,
        ),
    ];
    for (const rel of bundleFiles) {
        entries.set(
            `@mathjax/src/bundle/${rel}`,
            join(bundleDir, ...rel.split('/')),
        );
    }

    // The CHTML font: a base file plus per-glyph-group dynamic data files,
    // which MathJax loads on demand as it encounters glyphs.
    entries.set('@mathjax/mathjax-newcm-font/chtml.js', fontChtmlEntry);
    for (const rel of await listJsFiles(join(fontDir, 'chtml'))) {
        entries.set(
            `@mathjax/mathjax-newcm-font/chtml/${rel}`,
            join(fontDir, 'chtml', ...rel.split('/')),
        );
    }

    const lines = [...entries]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
            ([spec, file]) =>
                `    ${JSON.stringify(spec)}: () => import(` +
                `${JSON.stringify(file)}),`,
        );
    return (
        '// Generated by build-playground.mjs -- do not edit.\n' +
        'export const components = {\n' +
        lines.join('\n') +
        '\n};\n'
    );
}

/**
 * esbuild plugin that supplies the `virtual:mathjax-components` module imported
 * by `scripts/playground/mathjax-loader.ts`. See
 * `generateMathjaxComponentsModule` and the file header for the rationale.
 */
const mathjaxComponentsPlugin = {
    name: 'sveltex-mathjax-components',
    setup(pluginBuild) {
        pluginBuild.onResolve(
            { filter: /^virtual:mathjax-components$/ },
            () => ({ path: 'virtual:mathjax-components', namespace: 'mjx' }),
        );
        pluginBuild.onLoad(
            { filter: /.*/, namespace: 'mjx' },
            async () => ({
                contents: await generateMathjaxComponentsModule(),
                // Resolve the literal `import()` paths (absolute file paths
                // into `node_modules`) relative to the MathJax package.
                resolveDir: sveltexPkg,
                loader: 'js',
            }),
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

/**
 * Stages the playground editor's syntax-highlighting grammars.
 *
 * `Playground.vue` highlights the input editor with Shiki, using the same
 * three TextMate grammars the docs site itself loads (see `.vitepress/
 * config.ts`): `svelte`, the SvelTeX-flavored `markdown`, and `sveltex`. They
 * are combined -- in dependency-first load order -- into a single JSON array
 * served from `public/playground/`, so the component fetches one asset rather
 * than reaching across the monorepo at runtime.
 */
async function buildEditorGrammars() {
    const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
    // The hand-authored YAML is the source of truth for the SvelTeX-flavored
    // markdown and sveltex grammars; reading the YAML directly here keeps
    // this script independent of `packages/vscode-sveltex` having been
    // built (the JSON copies VS Code loads are pure build artifacts).
    const readYaml = async (path) => jsYaml.load(await readFile(path, 'utf8'));
    const [svelte, markdown, sveltex] = await Promise.all([
        readJson(resolve(docsRoot, 'misc/svelte.tmLanguage.json')),
        readYaml(
            resolve(
                repoRoot,
                'packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml',
            ),
        ),
        readYaml(
            resolve(
                repoRoot,
                'packages/vscode-sveltex/syntaxes/sveltex.tmLanguage.yaml',
            ),
        ),
    ]);
    // Shiki looks a language up by its `name`; these grammars ship under
    // different ones, so normalize them to the ids the component requests
    // (`Playground.vue` highlights with `sveltex`, `svelte` and `markdown`).
    svelte.name = 'svelte';
    markdown.name = 'markdown';
    sveltex.name = 'sveltex';
    const grammarsFile = resolve(
        docsRoot,
        'src/public/playground/editor-grammars.json',
    );
    await writeFile(grammarsFile, JSON.stringify([svelte, markdown, sveltex]));
    // eslint-disable-next-line no-console
    console.log(
        `[build-playground] wrote ${grammarsFile.replace(repoRoot + '/', '')}`,
    );
}

async function main() {
    if (!(await exists(resolve(sveltexPkg, 'node_modules')))) {
        throw new Error(
            'packages/sveltex/node_modules is missing. Run a monorepo-root ' +
                '`pnpm install` before building the playground bundle.',
        );
    }

    await mkdir(dirname(outfile), { recursive: true });

    await buildEditorGrammars();

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
        plugins: [
            depsAliasPlugin,
            decodeEntitiesWorkerPlugin,
            mathjaxComponentsPlugin,
            mathjaxStartupPlugin,
        ],
        // SvelTeX's dependencies live in `packages/sveltex/node_modules`.
        // `nodePaths` lets esbuild resolve those bare imports even though the
        // bundle is built from within `docs/`.
        nodePaths: [
            resolve(sveltexPkg, 'node_modules'),
            resolve(repoRoot, 'node_modules'),
        ],
        define: {
            'process.env.NODE_ENV': '"production"',
            // MathJax's prebuilt component bundles reference the global
            // `process.platform`; a Web Worker has no `process`. The SvelTeX
            // source's own `process` use goes through the `deps` shim, but the
            // separately-prebuilt MathJax bundles do not, so substitute the
            // value textually for them.
            'process.platform': '"browser"',
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
