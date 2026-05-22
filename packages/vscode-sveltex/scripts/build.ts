// File description: Build pipeline for the SvelTeX VS Code extension.
//
// Three steps, in order:
//
//   1. Grammar — convert the hand-authored TextMate grammars from YAML to the
//      JSON that VS Code consumes.
//   2. Bundle — esbuild the extension entry point and the two SvelTeX
//      language servers into self-contained files under `dist/`.
//      `svelte-language-server` is NOT bundled: it embeds the TypeScript
//      compiler, whose runtime `.d.ts` data files esbuild cannot inline, so a
//      bundled copy is broken. The extension instead reuses the copy shipped
//      by the required `svelte.svelte-vscode` extension. The published `.vsix`
//      ships only `dist/` (plus grammars and assets) and no `node_modules`.
//   3. Type-check — run `tsc --noEmit` over `src/`. esbuild strips types
//      without checking them, so this is what actually catches type errors.
//
// `pnpm run build` runs this file via `tsx`.

// This file is run by `tsx` and type-checked by the monorepo-root `tsconfig`
// under `verbatimModuleSyntax`; like `src/extension.ts` it is a CommonJS module,
// so every dependency is brought in with the `import … = require(…)` form.
import childProcess = require('node:child_process');
import nodeModule = require('node:module');
import esbuild = require('esbuild');
import fs = require('node:fs');
import path = require('node:path');
import jsYaml = require('js-yaml');

/** Absolute path of the extension package root (the parent of `scripts/`). */
const packageRoot = path.resolve(__dirname, '..');

/** Absolute path of the bundle output directory. */
const distDir = path.join(packageRoot, 'dist');

/** Resolves modules from the extension package's `node_modules`. */
const requireFromPackage = nodeModule.createRequire(
    path.join(packageRoot, 'package.json'),
);

// ----- step 1: grammars (YAML -> JSON) --------------------------------------

/**
 * Converts the TextMate grammar YAML sources to JSON.
 *
 * The `sveltex` grammar additionally gets a `*.json_default` copy: the
 * extension rewrites `sveltex.tmLanguage.json` at runtime from the verbatim
 * tags the language server resolves from the user's `sveltex.config.js` (the
 * `sveltex/resolvedTags` notification), and that pristine copy is the template
 * it rewrites from (see `src/extension.ts`).
 */
function buildGrammars(): void {
    for (const lang of ['sveltex', 'markdown']) {
        const yamlPath = path.join(
            packageRoot,
            'syntaxes',
            `${lang}.tmLanguage.yaml`,
        );
        const json = JSON.stringify(
            jsYaml.load(fs.readFileSync(yamlPath, { encoding: 'utf-8' })),
            null,
            2,
        );
        const jsonPath = path.join(
            packageRoot,
            'syntaxes',
            `${lang}.tmLanguage.json`,
        );
        fs.writeFileSync(jsonPath, json);
        if (lang === 'sveltex') {
            fs.writeFileSync(`${jsonPath}_default`, json);
        }
    }
}

// ----- step 2: bundle (esbuild) ---------------------------------------------

/**
 * Identifier the bundles see in place of `import.meta.url`.
 *
 * Several bundled dependencies are ESM and call `createRequire(import.meta.url)`
 * at module scope. The output is CommonJS, where `import.meta` does not exist,
 * so each `import.meta.url` is rewritten (via esbuild `define`) to this
 * identifier, which the {@link importMetaBanner} defines as the current file's
 * `file:` URL — the CommonJS equivalent.
 */
const importMetaUrlShim = '__sveltexBundleImportMetaUrl';

/**
 * A CommonJS prologue that defines {@link importMetaUrlShim} as this module's
 * own `file:` URL, so `createRequire(import.meta.url)` resolves relative to the
 * bundle. Prepended to every output via esbuild's `banner`.
 */
const importMetaBanner =
    `const ${importMetaUrlShim} = ` +
    `require('node:url').pathToFileURL(__filename).href;`;

/**
 * Bare package names that must be bundled from their CommonJS build rather than
 * their ESM build.
 *
 * `css-tree`'s ESM build loads its JSON data tables with
 * `createRequire(import.meta.url)` then `require('../data/…json')`. Once
 * bundled, `import.meta.url` points at the _bundle_, so that relative `require`
 * resolves next to the bundle and fails. The package's CommonJS build instead
 * uses a plain, bundler-visible `require('../data/…json')`, which esbuild
 * inlines as JSON — so the data travels into the bundle correctly. `css-tree`
 * reaches the bundle transitively via `svgo` / `csso` (dependencies of
 * `@nvl/sveltex`).
 */
const forceCjsPackages: readonly string[] = ['css-tree'];

/**
 * An esbuild plugin that resolves the {@link forceCjsPackages} from their
 * CommonJS build.
 *
 * esbuild applies the `import` export condition to a package reached through an
 * `import` statement, which would pick those packages' bundle-hostile ESM
 * builds. The plugin intercepts the bare specifier and re-resolves it with
 * Node's own `require.resolve`, which applies the `require` condition and so
 * yields the CommonJS entry point.
 */
const forceCjsPlugin: esbuild.Plugin = {
    name: 'sveltex-force-cjs',
    setup(build) {
        const escaped = forceCjsPackages.map((name) =>
            name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
        );
        // esbuild compiles `filter` with Go's regexp engine, which rejects
        // JavaScript-only flags — so no `u` flag here. The filter is anchored
        // to the bare package name; the package's own intra-package imports
        // are relative paths and so are never intercepted.
        // eslint-disable-next-line require-unicode-regexp -- Go regex, no `u`
        const filter = new RegExp(`^(${escaped.join('|')})$`);
        build.onResolve({ filter }, (args) => {
            // Re-resolve the bare specifier from the importer's directory with
            // Node's `require.resolve`, which applies the `require` condition
            // and yields the CommonJS entry point.
            const cjsRequire = nodeModule.createRequire(
                path.join(args.resolveDir || packageRoot, 'noop.js'),
            );
            return { path: cjsRequire.resolve(args.path) };
        });
    },
};

/**
 * Settings shared by every bundle: a Node-targeted, minified CommonJS build for
 * VS Code's extension host (an Electron/Node runtime). `^1.82.0` of VS Code
 * runs Node 18, so `node18` is a safe target.
 */
const sharedOptions: esbuild.BuildOptions = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    minify: true,
    sourcemap: false,
    // `node18` ships these natively; bundling them in would only bloat output.
    external: ['node:*'],
    // Several dependencies (`vscode-html-languageservice`,
    // `vscode-css-languageservice`, ...) ship a UMD `main` whose `require`
    // calls esbuild cannot follow, plus a clean ESM `module` build. Prefer the
    // ESM build so everything bundles statically.
    mainFields: ['module', 'main'],
    // ESM dependencies that call `createRequire(import.meta.url)` at module
    // scope would otherwise see `import.meta.url` as `undefined` in CommonJS
    // output; rewrite it to a shim the banner defines.
    define: { 'import.meta.url': importMetaUrlShim },
    banner: { js: importMetaBanner },
    plugins: [forceCjsPlugin],
    logLevel: 'silent',
    // `svelte-language-server` resolves the user project's TypeScript / Prettier
    // / Svelte at runtime via dynamic `require(variablePath)` calls. esbuild
    // cannot statically follow those, and rightly leaves them as runtime
    // requires; silence the otherwise-alarming warning about them.
    logOverride: { 'unsupported-require-call': 'silent' },
};

/**
 * Bundles the extension entry point, `src/extension.ts`, into
 * `dist/extension.js`.
 *
 * `vscode` is marked external — it is injected by the extension host and has no
 * npm package to bundle. `vscode-languageclient` is a real dependency and is
 * bundled in.
 */
async function bundleExtension(): Promise<void> {
    await esbuild.build({
        ...sharedOptions,
        entryPoints: [path.join(packageRoot, 'src', 'extension.ts')],
        outfile: path.join(distDir, 'extension.js'),
        // The `vscode` module is provided by the extension host at runtime.
        external: [...(sharedOptions.external ?? []), 'vscode'],
    });
}

/**
 * One language server to bundle: its esbuild entry point and the basename of
 * the `dist/` file it is bundled into.
 */
interface ServerBundle {
    /** Output basename, without extension (e.g. `svelte-language-server`). */
    name: string;
    /** Absolute path of the server's entry module. */
    entry: string;
}

/**
 * Locates the two SvelTeX language servers to bundle.
 *
 * Each server's `bin/server.js` is the esbuild entry: a tiny launcher that
 * imports the server's compiled core and starts it. Both are workspace
 * packages whose `dist/` is produced by `pnpm --recursive build` before this
 * package builds.
 *
 * `svelte-language-server` is intentionally absent: it is not bundled (it
 * embeds the TypeScript compiler, whose runtime data files esbuild cannot
 * inline). The extension reuses the copy shipped by the required
 * `svelte.svelte-vscode` extension instead — see `src/extension.ts`.
 *
 * @throws If a server cannot be resolved — most likely the workspace SvelTeX
 * servers have not been built yet.
 */
function resolveServerBundles(): ServerBundle[] {
    const servers: { name: string; moduleId: string }[] = [
        {
            name: 'sveltex-language-server',
            moduleId: '@nvl/sveltex-language-server/bin/server.js',
        },
        {
            name: 'sveltex-math-language-server',
            moduleId: '@nvl/sveltex-math-language-server/bin/server.js',
        },
    ];
    return servers.map(({ name, moduleId }) => {
        try {
            return { name, entry: requireFromPackage.resolve(moduleId) };
        } catch (error) {
            throw new Error(
                `Cannot resolve "${moduleId}" while bundling the SvelTeX ` +
                    `extension. Build the workspace packages first ` +
                    `(\`pnpm --recursive build\` from the monorepo root).`,
                { cause: error },
            );
        }
    });
}

/**
 * Bundles each language server into its own self-contained `dist/<name>.js`.
 *
 * The servers are forked as standalone Node processes at runtime, so they need
 * no `vscode` host; nothing is marked external beyond Node built-ins. The
 * resulting files carry every dependency they statically reference, which is
 * what lets the `.vsix` ship without `node_modules`.
 *
 * @param bundles - The servers to bundle, from {@link resolveServerBundles}.
 */
async function bundleServers(bundles: ServerBundle[]): Promise<void> {
    await Promise.all(
        bundles.map(async (bundle) =>
            esbuild.build({
                ...sharedOptions,
                entryPoints: [bundle.entry],
                outfile: path.join(distDir, `${bundle.name}.js`),
            }),
        ),
    );
}

// ----- step 3: type-check (tsc --noEmit) ------------------------------------

/**
 * Type-checks `src/` with the TypeScript compiler.
 *
 * esbuild transpiles without type-checking, so this is a separate, explicit
 * gate. It emits nothing — `dist/` is produced entirely by esbuild.
 *
 * @throws If `tsc` reports type errors (its non-zero exit propagates).
 */
function typeCheck(): void {
    const tsc = requireFromPackage.resolve('typescript/bin/tsc');
    childProcess.execFileSync(
        process.execPath,
        [tsc, '-p', path.join(packageRoot, 'tsconfig.json'), '--noEmit'],
        { stdio: 'inherit' },
    );
}

// ----- pipeline -------------------------------------------------------------

async function main(): Promise<void> {
    buildGrammars();
    // Start from a clean `dist/` so artifacts from an earlier build — e.g. a
    // formerly-bundled `svelte-language-server.js` and its lib files — are not
    // shipped as dead weight in the `.vsix`.
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
    const servers = resolveServerBundles();
    await Promise.all([bundleExtension(), bundleServers(servers)]);
    typeCheck();
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
