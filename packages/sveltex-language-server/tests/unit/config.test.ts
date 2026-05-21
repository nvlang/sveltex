// Unit tests for the SvelTeX config snapshot (`src/core/config.ts`): the
// built-in defaults, locating the project's `svelte.config.*`, and distilling
// the SvelTeX configuration it carries — including `mathBackend` and the LaTeX
// verbatim tags — into a `SveltexConfigSnapshot`.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    defaultConfigSnapshot,
    findSvelteConfigFile,
    loadConfigSnapshot,
} from '../../src/core/config.js';

describe('defaultConfigSnapshot', () => {
    it('provides sensible built-in defaults', () => {
        const snapshot = defaultConfigSnapshot();
        expect(snapshot.verbatimTags).toContain('tex');
        expect(snapshot.extensions).toEqual(['.sveltex']);
        expect(snapshot.configPath).toBeUndefined();
    });

    it('defaults the math backend to mathjax', () => {
        expect(defaultConfigSnapshot().mathBackend).toBe('mathjax');
    });

    it('defaults latexTags to the LaTeX verbatim tag trio', () => {
        // The TextMate grammar's LaTeX-injection bucket is keyed on these.
        expect(defaultConfigSnapshot().latexTags).toEqual([
            'tex',
            'latex',
            'tikz',
        ]);
    });

    it('defaults escapeTags to the plain-fenced-code pair', () => {
        // Drives the TextMate grammar's plain-fenced-code bucket.
        expect(defaultConfigSnapshot().escapeTags).toEqual([
            'verb',
            'verbatim',
        ]);
    });

    it('leaves codeTags and noopTags empty by default', () => {
        // No built-in tag names; the user opts in via `sveltex.config.js`.
        const snapshot = defaultConfigSnapshot();
        expect(snapshot.codeTags).toEqual([]);
        expect(snapshot.noopTags).toEqual([]);
    });
});

describe('config file location and loading', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-config-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('findSvelteConfigFile returns undefined when no config exists', () => {
        expect(findSvelteConfigFile(dir)).toBeUndefined();
    });

    it('findSvelteConfigFile locates a `svelte.config.js`', () => {
        const path = join(dir, 'svelte.config.js');
        writeFileSync(path, 'export default {};\n');
        expect(findSvelteConfigFile(dir)).toBe(path);
    });

    it('findSvelteConfigFile matches a TypeScript `svelte.config.ts`', () => {
        const path = join(dir, 'svelte.config.ts');
        writeFileSync(path, 'export default {};\n');
        expect(findSvelteConfigFile(dir)).toBe(path);
    });

    it('falls back to defaults when there is no `svelte.config.*`', async () => {
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.configPath).toBeUndefined();
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(snapshot.texScaffolds).toEqual({});
    });

    it('reads the SvelTeX config from a `Sveltex` instance in `preprocess`', async () => {
        // The usual shape: a resolved `Sveltex` instance (mathBackend +
        // configuration) sits in `preprocess`, alongside other preprocessors.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default {',
                "  extensions: ['.svelte', '.sveltex'],",
                '  preprocess: [',
                "    { name: 'vite-preprocess' },",
                '    {',
                "      mathBackend: 'katex',",
                '      configuration: {',
                "        verbatim: { latex: { type: 'tex', aliases: ['tikz'] } },",
                "        extensions: ['.sveltex'],",
                '      },',
                '    },',
                '  ],',
                '};',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.latexTags.sort()).toEqual(['latex', 'tikz']);
        expect(snapshot.verbatimTags).toEqual(['latex']);
        expect(snapshot.configPath).toContain('svelte.config.mjs');
    });

    it('reads a directly-exported `Sveltex` instance', async () => {
        // A `svelte.config.*` may also export the preprocessor it builds.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export const preprocessor = {',
                "  mathBackend: 'katex',",
                "  configuration: { verbatim: { latex: { type: 'tex' } } },",
                '};',
                'export default { preprocess: [preprocessor] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.latexTags).toEqual(['latex']);
    });

    it('partitions verbatim entries by type into latex/escape/code/noop', async () => {
        // The TextMate grammar regenerator needs each entry placed in the
        // right type-keyed bucket so its body renders with the right
        // injection (LaTeX / fenced-code / Svelte).
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                '  configuration: { verbatim: {',
                "    MyTex:    { type: 'tex' },",
                "    MyEscape: { type: 'escape' },",
                "    MyCode:   { type: 'code' },",
                "    MyNoop:   { type: 'noop' },",
                '  } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.latexTags).toEqual(['MyTex']);
        expect(snapshot.escapeTags).toEqual(['MyEscape']);
        expect(snapshot.codeTags).toEqual(['MyCode']);
        expect(snapshot.noopTags).toEqual(['MyNoop']);
    });

    it("reads documentClass and preamble of a `type: 'tex'` environment", async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                '  configuration: { verbatim: { tex: {',
                "    type: 'tex', aliases: ['TikZ'],",
                "    documentClass: 'standalone',",
                "    preamble: '\\\\usepackage{tikz}',",
                '  } } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        // The tag name and each alias (lower-cased) share one scaffold.
        expect(snapshot.texScaffolds['tex']).toEqual({
            documentClass: '\\documentclass{standalone}',
            preamble: '\\usepackage{tikz}',
        });
        expect(snapshot.texScaffolds['tikz']).toEqual(
            snapshot.texScaffolds['tex'],
        );
    });

    it('reads `svelte.config.*` even when a `sveltex.config.*` also exists', async () => {
        // `svelte.config.*` is the single source of truth: a dedicated
        // `sveltex.config.*` is never consulted directly.
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            "export default { backendChoices: { mathBackend: 'none' } };\n",
        );
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'katex', configuration: {} }] };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.configPath).toContain('svelte.config.mjs');
    });

    it('falls back to defaults when the config throws on import', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            'throw new Error("boom");\n',
        );
        const snapshot = await loadConfigSnapshot(dir);
        // Loading must never fail the server — defaults are used instead.
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(snapshot.latexTags).toEqual(['tex', 'latex', 'tikz']);
    });

    it('ignores an unrecognised math backend value', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'bogus', configuration: {} }] };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('mathjax');
    });

    it('re-reads the config on each reload', async () => {
        const path = join(dir, 'svelte.config.mjs');
        writeFileSync(
            path,
            "export default { preprocess: [{ mathBackend: 'katex', configuration: {} }] };\n",
        );
        const first = await loadConfigSnapshot(dir);
        expect(first.mathBackend).toBe('katex');

        // Edit the config and reload: each load runs in a fresh child
        // process, so the snapshot reflects the new value rather than a
        // module cached by the first load.
        writeFileSync(
            path,
            "export default { preprocess: [{ mathBackend: 'none', configuration: {} }] };\n",
        );
        const second = await loadConfigSnapshot(dir);
        expect(second.mathBackend).toBe('none');
    });

    it('re-reads a config the `svelte.config.*` imports, on reload', async () => {
        // The split-config layout: `svelte.config.*` pulls the SvelTeX
        // settings in from a separate module. Loading in a fresh child
        // process re-reads that imported module too — an in-process
        // `import()` would serve it stale from the module cache.
        const imported = join(dir, 'sveltex.config.mjs');
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                "import preprocessor from './sveltex.config.mjs';",
                'export default { preprocess: [preprocessor] };',
                '',
            ].join('\n'),
        );
        writeFileSync(
            imported,
            "export default { mathBackend: 'katex', configuration: {} };\n",
        );
        expect((await loadConfigSnapshot(dir)).mathBackend).toBe('katex');

        writeFileSync(
            imported,
            "export default { mathBackend: 'none', configuration: {} };\n",
        );
        expect((await loadConfigSnapshot(dir)).mathBackend).toBe('none');
    });
});
