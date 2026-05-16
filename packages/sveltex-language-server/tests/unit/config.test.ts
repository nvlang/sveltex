// Unit tests for the SvelTeX config snapshot (`src/core/config.ts`): the
// built-in defaults, locating a `sveltex.config.*` file, and distilling a
// loaded config — including `mathBackend` and the LaTeX verbatim tags — into a
// `SveltexConfigSnapshot`.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    defaultConfigSnapshot,
    findConfigFile,
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
});
