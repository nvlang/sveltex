// Unit tests for the SvelTeX config snapshot (`src/core/config.ts`): the
// built-in defaults, locating a `sveltex.config.*` (or `svelte.config.*`)
// file, and distilling a loaded config — including `mathBackend` and the LaTeX
// verbatim tags — into a `SveltexConfigSnapshot`.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    defaultConfigSnapshot,
    findConfigFile,
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
        // Matches the VS Code extension's `sveltex.latexTags` default.
        expect(defaultConfigSnapshot().latexTags).toEqual([
            'tex',
            'latex',
            'tikz',
        ]);
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

    it('findConfigFile returns undefined when no config exists', () => {
        expect(findConfigFile(dir)).toBeUndefined();
    });

    it('findConfigFile locates a `sveltex.config.js`', () => {
        const path = join(dir, 'sveltex.config.js');
        writeFileSync(path, 'export default {};\n');
        expect(findConfigFile(dir)).toBe(path);
    });

    it('falls back to defaults when no config file is present', async () => {
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.configPath).toBeUndefined();
        expect(snapshot.mathBackend).toBe('mathjax');
    });

    it('reads verbatim tags and latexTags from a plain config object', async () => {
        // A config that declares `verbatim` entries with a `type`.
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            [
                'export default {',
                '  verbatim: {',
                "    tex: { type: 'tex', aliases: ['tikz'] },",
                "    Verb: { type: 'escape' },",
                '  },',
                '};',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.verbatimTags.sort()).toEqual(['Verb', 'tex']);
        // Only the `type: 'tex'` entry (and its alias) is a LaTeX tag.
        expect(snapshot.latexTags.sort()).toEqual(['tex', 'tikz']);
        expect(snapshot.configPath).toContain('sveltex.config.mjs');
    });

    it("reads documentClass and preamble of a `type: 'tex'` environment", async () => {
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            [
                'export default {',
                '  verbatim: {',
                '    tex: {',
                "      type: 'tex',",
                "      aliases: ['TikZ'],",
                "      documentClass: 'standalone',",
                "      preamble: '\\\\usepackage{tikz}',",
                '    },',
                '  },',
                '};',
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

    it('has no texScaffolds when there is no config file', async () => {
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.texScaffolds).toEqual({});
    });

    it('reads the math backend from a `backendChoices` config object', async () => {
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            "export default { backendChoices: { mathBackend: 'katex' } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
    });

    it('reads the math backend from a Sveltex-instance-shaped export', async () => {
        // A real config exports `await sveltex(...)`, a resolved instance with
        // `mathBackend` and a `configuration` getter. Simulate that shape.
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            [
                'export const preprocessor = {',
                "  mathBackend: 'katex',",
                '  configuration: {',
                '    verbatim: {',
                "      latex: { type: 'tex' },",
                '    },',
                "    extensions: ['.sveltex'],",
                '  },',
                '};',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.latexTags).toEqual(['latex']);
        expect(snapshot.verbatimTags).toEqual(['latex']);
    });

    it('falls back to defaults for a `.ts` config (no loader)', async () => {
        const path = join(dir, 'sveltex.config.ts');
        writeFileSync(path, 'export default {} as const;\n');
        const snapshot = await loadConfigSnapshot(dir);
        // The path is reported, but a `.ts` config is not executed.
        expect(snapshot.configPath).toBe(path);
        expect(snapshot.mathBackend).toBe('mathjax');
    });

    it('falls back to defaults when the config file throws on import', async () => {
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            'throw new Error("boom");\n',
        );
        const snapshot = await loadConfigSnapshot(dir);
        // Loading must never fail the server — defaults are used instead.
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(snapshot.latexTags).toEqual(['tex', 'latex', 'tikz']);
    });

    it('ignores an unrecognised math backend value', async () => {
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            "export default { backendChoices: { mathBackend: 'bogus' } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('mathjax');
    });

    it('findSvelteConfigFile locates a `svelte.config.js`', () => {
        const path = join(dir, 'svelte.config.js');
        writeFileSync(path, 'export default {};\n');
        expect(findSvelteConfigFile(dir)).toBe(path);
    });

    it('reads SvelTeX config from `svelte.config.*` when no `sveltex.config.*` exists', async () => {
        // SvelTeX is wired into `svelte.config.mjs` as a preprocessor: a
        // resolved `Sveltex` instance (mathBackend + configuration) sits in
        // `preprocess`, alongside an unrelated preprocessor.
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
        expect(snapshot.configPath).toContain('svelte.config.mjs');
    });

    it('prefers a dedicated `sveltex.config.*` over `svelte.config.*`', async () => {
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            "export default { backendChoices: { mathBackend: 'katex' } };\n",
        );
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'none', configuration: {} }] };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.configPath).toContain('sveltex.config.mjs');
    });

    it('reads `svelte.config.*` when the only `sveltex.config` is a non-loadable `.ts`', async () => {
        writeFileSync(
            join(dir, 'sveltex.config.ts'),
            'export default {} as const;\n',
        );
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'katex',",
                "  configuration: { verbatim: { tex: { type: 'tex' } } },",
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.latexTags).toEqual(['tex']);
    });
});
