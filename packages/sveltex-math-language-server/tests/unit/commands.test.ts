// Unit tests for the per-backend command tables (`src/core/commands.ts`) and
// the generated data they wrap (`src/data/commands.generated.ts`).
//
// The whole value of this server is the ACCURACY of its command lists, so
// these tests assert the generated data is well-formed and that the KaTeX and
// MathJax sets genuinely differ — the difference is the point.

import { describe, expect, it } from 'vitest';
import {
    CommandTable,
    createCommandTable,
    type MathCommand,
} from '../../src/core/commands.js';
import {
    KATEX_COMMANDS,
    MATHJAX_COMMANDS,
} from '../../src/data/commands.generated.js';

const CATEGORIES = new Set(['function', 'symbol', 'macro', 'environment']);

describe('generated command data', () => {
    it('ships a non-trivial number of commands for each backend', () => {
        // The generator extracts ~1000 KaTeX and ~950 MathJax commands; assert
        // a generous lower bound so a broken generator (empty output) fails.
        expect(KATEX_COMMANDS.length).toBeGreaterThan(500);
        expect(MATHJAX_COMMANDS.length).toBeGreaterThan(500);
    });

    it('only contains well-formed command entries', () => {
        for (const list of [KATEX_COMMANDS, MATHJAX_COMMANDS]) {
            for (const command of list) {
                expect(typeof command.name).toBe('string');
                expect(command.name.length).toBeGreaterThan(0);
                // The name must NOT carry a leading backslash.
                expect(command.name.startsWith('\\')).toBe(false);
                expect(CATEGORIES.has(command.category)).toBe(true);
                // A name is an alphabetic word (optional trailing `*`) or a
                // single ASCII punctuation char — never a raw Unicode glyph.
                expect(command.name).toMatch(
                    /^(?:[a-zA-Z]+\*?|[!-/:-@[\]^_`{-~])$/u,
                );
            }
        }
    });

    it('has no duplicate command names within a backend', () => {
        for (const list of [KATEX_COMMANDS, MATHJAX_COMMANDS]) {
            const names = list.map((c) => c.name);
            expect(new Set(names).size).toBe(names.length);
        }
    });

    it('includes the staple commands every TeX user expects', () => {
        for (const list of [KATEX_COMMANDS, MATHJAX_COMMANDS]) {
            const names = new Set(list.map((c) => c.name));
            for (const staple of [
                'frac',
                'sqrt',
                'sum',
                'alpha',
                'beta',
                'left',
                'right',
                'text',
            ]) {
                expect(names.has(staple)).toBe(true);
            }
        }
    });

    it('exposes environment names for `\\begin{...}` completion', () => {
        for (const list of [KATEX_COMMANDS, MATHJAX_COMMANDS]) {
            const envs = list.filter((c) => c.category === 'environment');
            expect(envs.length).toBeGreaterThan(0);
            const names = new Set(envs.map((c) => c.name));
            // `aligned` and `bmatrix` are environments both backends support.
            expect(names.has('aligned')).toBe(true);
            expect(names.has('bmatrix')).toBe(true);
        }
    });

    it('reflects that KaTeX and MathJax support different command sets', () => {
        const katex = new Set(KATEX_COMMANDS.map((c) => c.name));
        const mathjax = new Set(MATHJAX_COMMANDS.map((c) => c.name));
        const katexOnly = [...katex].filter((n) => !mathjax.has(n));
        const mathjaxOnly = [...mathjax].filter((n) => !katex.has(n));
        // Each backend has commands the other lacks.
        expect(katexOnly.length).toBeGreaterThan(0);
        expect(mathjaxOnly.length).toBeGreaterThan(0);
    });

    it('puts mhchem `\\ce`/`\\pu` in MathJax but not core KaTeX', () => {
        // mhchem is an `autoload`-reachable MathJax package; KaTeX ships it
        // only as a separate `contrib` add-on, not in its core tables.
        const mathjax = new Set(MATHJAX_COMMANDS.map((c) => c.name));
        const katex = new Set(KATEX_COMMANDS.map((c) => c.name));
        expect(mathjax.has('ce')).toBe(true);
        expect(mathjax.has('pu')).toBe(true);
        expect(katex.has('ce')).toBe(false);
    });

    it('excludes packages that need an explicit `\\require` (e.g. physics)', () => {
        // `physics` is not auto-loaded by the default MathJax `tex` config, so
        // `\qty` must not appear — shipping it would be a false promise.
        const mathjax = new Set(MATHJAX_COMMANDS.map((c) => c.name));
        expect(mathjax.has('qty')).toBe(false);
    });
});

describe('CommandTable', () => {
    const sample: MathCommand[] = [
        { name: 'frac', category: 'function' },
        { name: 'frak', category: 'macro' },
        { name: 'alpha', category: 'symbol' },
        { name: 'aligned', category: 'environment' },
        { name: 'array', category: 'environment' },
    ];
    const table = CommandTable.create(sample);

    it('reports its size and exposes all commands sorted', () => {
        expect(table.size).toBe(5);
        const names = table.all.map((c) => c.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('looks commands up by exact name', () => {
        expect(table.get('frac')?.category).toBe('function');
        expect(table.get('nope')).toBeUndefined();
    });

    it('filters by prefix, excluding environments for ordinary commands', () => {
        const matches = table.withPrefix('fra', false);
        expect(matches.map((c) => c.name)).toEqual(['frac', 'frak']);
    });

    it('filters by prefix, environments only, for `\\begin{...}`', () => {
        const matches = table.withPrefix('a', true);
        // Only `aligned` and `array` are environments; `alpha` is excluded.
        expect(matches.map((c) => c.name).sort()).toEqual([
            'aligned',
            'array',
        ]);
    });

    it('treats an empty prefix as matching the whole (filtered) pool', () => {
        expect(table.withPrefix('', false)).toHaveLength(3); // non-environments
        expect(table.withPrefix('', true)).toHaveLength(2); // environments
    });

    it('is case-sensitive, as TeX commands are', () => {
        const caseTable = CommandTable.create([
            { name: 'Pi', category: 'symbol' },
            { name: 'pi', category: 'symbol' },
        ]);
        expect(caseTable.withPrefix('P', false).map((c) => c.name)).toEqual([
            'Pi',
        ]);
        expect(caseTable.withPrefix('p', false).map((c) => c.name)).toEqual([
            'pi',
        ]);
    });
});

describe('createCommandTable', () => {
    it('builds a table for each backend', () => {
        expect(createCommandTable('katex').size).toBe(KATEX_COMMANDS.length);
        expect(createCommandTable('mathjax').size).toBe(
            MATHJAX_COMMANDS.length,
        );
    });

    it('caches and returns the same table instance per backend', () => {
        expect(createCommandTable('katex')).toBe(createCommandTable('katex'));
        expect(createCommandTable('mathjax')).toBe(
            createCommandTable('mathjax'),
        );
    });
});
