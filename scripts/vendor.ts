// File description: Fetches and refreshes the small set of files this repo
// vendors from upstream open-source projects.
//
// Run on demand:
//
//     pnpm vendor:update
//
// Or weekly in CI via `.github/workflows/vendor-update.yml`, which calls the
// same command and opens a PR if anything changed.
//
// Adding a new vendored asset: append an entry to `VENDORED` below. Each
// entry declares the local target, the raw upstream URL to fetch, what (if
// any) format conversion to apply, and the upstream's license + a short
// attribution. If you reach for a third transform, add it to the `transform`
// union and the `applyTransform` switch.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsYaml from 'js-yaml';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface VendoredAsset {
    /** Path of the local copy, relative to the repo root. */
    readonly target: string;
    /** Raw upstream URL to fetch. */
    readonly source: string;
    /**
     * What to do with the fetched bytes before writing to `target`.
     *
     * - `'verbatim'`: write the response as-is.
     * - `'yaml-to-json'`: parse YAML, emit pretty-printed JSON.
     */
    readonly transform: 'verbatim' | 'yaml-to-json';
    /** SPDX license identifier for the upstream content. */
    readonly license: string;
    /**
     * Short human-readable attribution, shown in the docs site's
     * `acknowledgments.md`.
     */
    readonly attribution: string;
}

const VENDORED: readonly VendoredAsset[] = [
    {
        target: 'docs/misc/svelte.tmLanguage.json',
        source: 'https://raw.githubusercontent.com/sveltejs/language-tools/master/packages/svelte-vscode/syntaxes/svelte.tmLanguage.src.yaml',
        transform: 'yaml-to-json',
        license: 'MIT',
        attribution: 'sveltejs/language-tools — Svelte TextMate grammar',
    },
    {
        // The TextMate grammars the SvelTeX language server tokenises
        // user-configured `<MyTex>` verbatim bodies with for
        // `textDocument/semanticTokens/full` — VS Code's bundled LaTeX
        // syntax extension shares this source. `LaTeX.tmLanguage.json`
        // (`text.tex.latex`) depends on `TeX.tmLanguage.json`
        // (`text.tex`) for braces / comments / math primitives, so both
        // are vendored.
        target: 'packages/sveltex-language-server/src/grammars/LaTeX.tmLanguage.json',
        source: 'https://raw.githubusercontent.com/jlelong/vscode-latex-basics/master/syntaxes/LaTeX.tmLanguage.json',
        transform: 'verbatim',
        license: 'MIT',
        attribution: 'jlelong/vscode-latex-basics — LaTeX TextMate grammar',
    },
    {
        target: 'packages/sveltex-language-server/src/grammars/TeX.tmLanguage.json',
        source: 'https://raw.githubusercontent.com/jlelong/vscode-latex-basics/master/syntaxes/TeX.tmLanguage.json',
        transform: 'verbatim',
        license: 'MIT',
        attribution: 'jlelong/vscode-latex-basics — TeX TextMate grammar',
    },
];

/** Fetches `url`, throwing with a descriptive message on any non-OK status. */
async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
        );
    }
    return response.text();
}

/** Applies the asset's transform to the fetched body, returning bytes to write. */
function applyTransform(
    body: string,
    transform: VendoredAsset['transform'],
): string {
    switch (transform) {
        case 'verbatim':
            return body;
        case 'yaml-to-json': {
            const parsed: unknown = jsYaml.load(body);
            return JSON.stringify(parsed, null, 2) + '\n';
        }
    }
}

/** Updates one vendored asset; logs whether anything changed. */
async function updateOne(asset: VendoredAsset): Promise<boolean> {
    const targetPath = join(REPO_ROOT, asset.target);
    const body = await fetchText(asset.source);
    const next = applyTransform(body, asset.transform);
    const previous = (() => {
        try {
            return readFileSync(targetPath, 'utf8');
        } catch {
            return undefined;
        }
    })();
    if (previous === next) {
        console.log(`  unchanged: ${asset.target}`);
        return false;
    }
    writeFileSync(targetPath, next);
    console.log(`  updated:   ${asset.target}`);
    return true;
}

async function main(): Promise<void> {
    console.log(`Refreshing ${VENDORED.length} vendored asset(s)…`);
    let anyChanged = false;
    for (const asset of VENDORED) {
        if (await updateOne(asset)) anyChanged = true;
    }
    console.log(anyChanged ? 'Done — changes written.' : 'Done — no changes.');
}

await main();
