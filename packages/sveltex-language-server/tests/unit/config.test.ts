// Unit tests for the SvelTeX config snapshot (`src/core/config.ts`): the
// built-in defaults, locating the project's `svelte.config.*`, and distilling
// the SvelTeX configuration it carries — including `mathBackend` and the LaTeX
// verbatim tags — into a `SveltexConfigSnapshot`.

import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    collectConfigDependencies,
    defaultConfigSnapshot,
    findSvelteConfigFile,
    loadConfigSnapshot,
} from '../../src/core/config.js';

// `loadConfigViaChild` spawns a Node child to import the config. A handful of
// its failure branches — the result pipe never opening, an over-large or
// malformed fd-3 payload, a non-Error spawn failure — cannot be provoked by a
// real config fixture (the loader script controls what fd 3 receives), so
// `node:child_process.spawn` is mocked with a switch: by default it delegates
// to the real `spawn` (so every fixture-driven test above is unaffected), and
// individual tests below install a fake child to drive a specific branch.
const spawnControl = vi.hoisted(() => ({
    impl: null as ((...args: unknown[]) => unknown) | null,
}));
vi.mock('node:child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:child_process')>();
    return {
        ...actual,
        spawn: (...args: unknown[]) =>
            (spawnControl.impl ?? actual.spawn)(...args),
    };
});

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
        // `verbatimTags` must include each env's aliases, not just the record
        // keys — otherwise an aliased env (`<tikz>…`) goes undetected as a
        // verbatim region, gets delegated to svelte-LSP as markup, and an
        // aliased `tex` env never reaches TexLab.
        expect(snapshot.verbatimTags.sort()).toEqual(['latex', 'tikz']);
        expect(snapshot.configPath).toContain('svelte.config.mjs');
    });

    it('collectConfigDependencies follows relative imports transitively', () => {
        // Live reload must fire for helper modules the client's fixed
        // `*.config.*` glob misses — e.g. an arbitrarily-named
        // `verbatim-tags.mjs` pulled in transitively.
        const configPath = join(dir, 'svelte.config.mjs');
        writeFileSync(
            configPath,
            "import config from './sveltex.config.mjs';\n" +
                'export default config;\n',
        );
        writeFileSync(
            join(dir, 'sveltex.config.mjs'),
            "import './verbatim-tags.mjs';\n" +
                'export default { preprocess: [] };\n',
        );
        writeFileSync(join(dir, 'verbatim-tags.mjs'), 'export const tags = {};\n');
        expect(collectConfigDependencies(configPath).sort()).toEqual(
            [
                join(dir, 'svelte.config.mjs'),
                join(dir, 'sveltex.config.mjs'),
                join(dir, 'verbatim-tags.mjs'),
            ].sort(),
        );
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

    // --- verbatim tag readers -------------------------------------------

    it('treats an empty `verbatim: {}` as "no verbatim declared"', async () => {
        // `readVerbatimTags` returns undefined for an object with no entries,
        // so `verbatimTags`/`latexTags`/… keep the built-in defaults rather
        // than collapsing to empty lists.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'katex', configuration: { verbatim: {} } }] };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.verbatimTags).toEqual(['tex', 'latex', 'tikz', 'verb', 'verbatim']);
        expect(snapshot.latexTags).toEqual(['tex', 'latex', 'tikz']);
        expect(snapshot.escapeTags).toEqual(['verb', 'verbatim']);
    });

    it('ignores non-object verbatim entries and non-string aliases', async () => {
        // A scalar entry contributes only its key; a non-array `aliases` is
        // skipped, and a non-string alias inside the array is dropped.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'katex',",
                '  configuration: { verbatim: {',
                "    scalarEnv: true,",
                "    tex: { type: 'tex', aliases: ['TikZ', 42, 'Latex'] },",
                "    weird: { type: 'tex', aliases: 'not-an-array' },",
                '  } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        // Keys plus only the string aliases.
        expect(snapshot.verbatimTags.sort()).toEqual(
            ['Latex', 'TikZ', 'scalarEnv', 'tex', 'weird'].sort(),
        );
        // `latexTags` (type tex) likewise picks up string aliases only.
        expect(snapshot.latexTags.sort()).toEqual(
            ['Latex', 'TikZ', 'tex', 'weird'].sort(),
        );
    });

    it('falls back to [] for a type with verbatim entries but none of it', async () => {
        // When the user declares verbatim entries but none of `type: 'tex'`,
        // `latexTags` is the empty list (not the built-in default trio).
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'katex', configuration: { verbatim: { foo: { type: 'escape' } } } }] };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.latexTags).toEqual([]);
        expect(snapshot.escapeTags).toEqual(['foo']);
        expect(snapshot.codeTags).toEqual([]);
        expect(snapshot.noopTags).toEqual([]);
    });

    // --- documentClass rendering ----------------------------------------

    it('renders a `{ name, options }` documentClass with options', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                '  configuration: { verbatim: { tex: {',
                "    type: 'tex',",
                "    documentClass: { name: 'article', options: ['12pt', 'a4paper', 7] },",
                '  } } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        // The non-string option (7) is filtered out.
        expect(snapshot.texScaffolds['tex'].documentClass).toBe(
            '\\documentclass[12pt,a4paper]{article}',
        );
        // No `preamble` declared → SvelTeX's default preamble.
        expect(snapshot.texScaffolds['tex'].preamble).toContain(
            '\\usepackage{microtype}',
        );
    });

    it('renders a `{ name }` documentClass without options', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                "  configuration: { verbatim: { tex: { type: 'tex', documentClass: { name: 'book' } } } },",
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.texScaffolds['tex'].documentClass).toBe(
            '\\documentclass{book}',
        );
    });

    it('defaults documentClass to `standalone` when it is a non-string scalar', async () => {
        // `documentClass` is a number → neither the string nor the object
        // branch applies, so name stays `standalone` and there are no options.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                "  configuration: { verbatim: { tex: { type: 'tex', documentClass: 99 } } },",
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.texScaffolds['tex'].documentClass).toBe(
            '\\documentclass{standalone}',
        );
    });

    it('keeps `standalone` for an object documentClass with a non-string name', async () => {
        // `documentClass` is an object, but its `name` is not a string, so the
        // default `standalone` name is kept while the string options apply.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                "  configuration: { verbatim: { tex: { type: 'tex', documentClass: { name: 42, options: ['draft'] } } } },",
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.texScaffolds['tex'].documentClass).toBe(
            '\\documentclass[draft]{standalone}',
        );
    });

    it('treats a non-array documentClass options field as no options', async () => {
        // `options` present but not an array → the `Array.isArray` guard fails
        // and `options` stays the empty list.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                "  configuration: { verbatim: { tex: { type: 'tex', documentClass: { name: 'memoir', options: 'a4paper' } } } },",
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.texScaffolds['tex'].documentClass).toBe(
            '\\documentclass{memoir}',
        );
    });

    // --- math backend ----------------------------------------------------

    it('reads the math backend from `backendChoices.mathBackend`', async () => {
        // A plain config object (no resolved Sveltex instance) carries the
        // backend under `backendChoices`, not as a direct `mathBackend`.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { backendChoices: { mathBackend: 'katex' } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
    });

    it('ignores an invalid `backendChoices.mathBackend`', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { backendChoices: { mathBackend: 'bogus' } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('mathjax');
    });

    // --- math delimiters -------------------------------------------------

    it('reads every math-delimiter field when all are present', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                '  configuration: { math: { delims: {',
                '    dollars: false,',
                '    inline: { singleDollar: false, escapedParentheses: true },',
                '    display: { escapedSquareBrackets: false },',
                "    doubleDollarSignsDisplay: 'always',",
                '  } } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathDelims).toEqual({
            dollars: false,
            inline: { singleDollar: false, escapedParentheses: true },
            display: { escapedSquareBrackets: false },
            doubleDollarSignsDisplay: 'always',
        });
    });

    it("accepts doubleDollarSignsDisplay 'newline' and 'fenced'", async () => {
        const base = (value: string): string =>
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                `  configuration: { math: { delims: { doubleDollarSignsDisplay: '${value}' } } },`,
                '}] };',
                '',
            ].join('\n');
        writeFileSync(join(dir, 'svelte.config.mjs'), base('newline'));
        expect((await loadConfigSnapshot(dir)).mathDelims.doubleDollarSignsDisplay).toBe('newline');
        writeFileSync(join(dir, 'svelte.config.mjs'), base('fenced'));
        expect((await loadConfigSnapshot(dir)).mathDelims.doubleDollarSignsDisplay).toBe('fenced');
    });

    it('falls back to base delims for wrong-typed / non-object delim fields', async () => {
        // `delims` is present but `inline`/`display` are not objects and the
        // scalar fields are the wrong type, so every field falls back to base.
        const base = defaultConfigSnapshot().mathDelims;
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export default { preprocess: [{',
                "  mathBackend: 'mathjax',",
                '  configuration: { math: { delims: {',
                "    dollars: 'nope',",
                "    inline: 'not-an-object',",
                '    display: 123,',
                "    doubleDollarSignsDisplay: 'bogus',",
                '  } } },',
                '}] };',
                '',
            ].join('\n'),
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathDelims).toEqual(base);
    });

    it('returns base delims when `math.delims` is absent or non-object', async () => {
        // `math` present but `delims` not an object → base.
        const base = defaultConfigSnapshot().mathDelims;
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { math: { delims: 5 } } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).mathDelims).toEqual(base);
    });

    it('returns base delims when `math` is non-object', async () => {
        const base = defaultConfigSnapshot().mathDelims;
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { math: 'enabled' } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).mathDelims).toEqual(base);
    });

    // --- directives ------------------------------------------------------

    it('reads `markdown.directives.enabled`', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { markdown: { directives: { enabled: true } } } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).directives).toEqual({
            enabled: true,
        });
    });

    it('treats a non-boolean `directives.enabled` as disabled', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { markdown: { directives: { enabled: 'yes' } } } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).directives).toEqual({
            enabled: false,
        });
    });

    it('treats a non-object `markdown.directives` as disabled', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { markdown: { directives: 1 } } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).directives).toEqual({
            enabled: false,
        });
    });

    it('treats a non-object `markdown` as no directives', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { markdown: 'gfm' } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).directives).toEqual({
            enabled: false,
        });
    });

    // --- extensions ------------------------------------------------------

    it('falls back to default extensions when none are strings', async () => {
        // `extensions` is an array but holds no strings → base extensions.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { extensions: [1, 2, 3] } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).extensions).toEqual(['.sveltex']);
    });

    it('falls back to default extensions when `extensions` is non-array', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'mathjax', configuration: { extensions: '.sveltex' } }] };\n",
        );
        expect((await loadConfigSnapshot(dir)).extensions).toEqual(['.sveltex']);
    });

    // --- resolveConfigCandidate fallbacks --------------------------------

    it('finds a `Sveltex` instance when `preprocess` is a single object', async () => {
        // `preprocess` may be a lone preprocessor rather than an array.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: { mathBackend: 'katex', configuration: { verbatim: { tex: { type: 'tex' } } } } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir);
        expect(snapshot.mathBackend).toBe('katex');
        expect(snapshot.latexTags).toEqual(['tex']);
    });

    it('skips non-object module exports while scanning `preprocess`', async () => {
        // A scalar named export must not trip `findSveltexInPreprocess`. With
        // no Sveltex instance anywhere, every export is visited by the
        // `preprocess` scan, so the scalar exercises its non-object guard.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            [
                'export const version = 1;',
                "export default { extensions: ['.zz'] };",
                '',
            ].join('\n'),
        );
        expect((await loadConfigSnapshot(dir)).extensions).toEqual(['.zz']);
    });

    it('uses the `default` export as a plain config when no instance is found', async () => {
        const log = vi.fn();
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { extensions: ['.foo', '.sveltex'], backendChoices: { mathBackend: 'none' } };\n",
        );
        const snapshot = await loadConfigSnapshot(dir, log);
        expect(snapshot.extensions).toEqual(['.foo', '.sveltex']);
        expect(snapshot.mathBackend).toBe('none');
        // No resolved Sveltex preprocessor → the "fell back" log fires.
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('found no SvelTeX preprocessor'),
        );
    });

    it('uses a named `config` export when there is no `default`', async () => {
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export const config = { extensions: ['.bar'] };\n",
        );
        expect((await loadConfigSnapshot(dir)).extensions).toEqual(['.bar']);
    });

    it('uses the bare module when neither `default` nor `config` is an object', async () => {
        // No `default`/`config` object export → the module namespace itself is
        // the candidate; its top-level `extensions` are read.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export const extensions = ['.baz'];\n",
        );
        expect((await loadConfigSnapshot(dir)).extensions).toEqual(['.baz']);
    });

    // --- success / failure logging --------------------------------------

    it('logs a success summary, with "none" for empty tag buckets', async () => {
        const log = vi.fn();
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "export default { preprocess: [{ mathBackend: 'katex', configuration: { verbatim: { e: { type: 'escape' } } } }] };\n",
        );
        await loadConfigSnapshot(dir, log);
        const message = log.mock.calls.map((c) => String(c[0])).join('\n');
        expect(message).toContain('Loaded SvelTeX config from');
        // The empty `tex` bucket renders as `none`; the non-empty `escape`
        // bucket renders its tag.
        expect(message).toContain('tex: none');
        expect(message).toContain('escape: e');
    });

    it('logs when no svelte.config.* is found', async () => {
        const log = vi.fn();
        const snapshot = await loadConfigSnapshot(dir, log);
        expect(snapshot.configPath).toBeUndefined();
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('No svelte.config.* found'),
        );
    });

    it('logs the reason when a config fails to load', async () => {
        const log = vi.fn();
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            'throw new Error("kaboom");\n',
        );
        const snapshot = await loadConfigSnapshot(dir, log);
        expect(snapshot.configPath).toContain('svelte.config.mjs');
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('Failed to load'),
        );
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'kaboom',
        );
    });

    it('reports a bare exit code when the config fails without stderr', async () => {
        const log = vi.fn();
        // The imported config terminates the loader child with a non-zero exit
        // code but writes nothing to stderr → "exited with code N".
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            'process.exit(3);\n',
        );
        await loadConfigSnapshot(dir, log);
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'exited with code 3',
        );
    });

    it('summarizes a non-Error stderr line when the child fails', async () => {
        const log = vi.fn();
        // The child exits non-zero after writing a stderr line that does not
        // match the `…Error` pattern → `summarizeStderr` falls to the first
        // non-empty line.
        writeFileSync(
            join(dir, 'svelte.config.mjs'),
            "process.stderr.write('a plain diagnostic line\\n'); process.exit(4);\n",
        );
        await loadConfigSnapshot(dir, log);
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'a plain diagnostic line',
        );
    });
});

describe('collectConfigDependencies edge cases', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-deps-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('resolves an extensionless directory import via its index file', () => {
        // `./helpers` has no matching file but `./helpers/index.js` does, so
        // the scan must follow it like Node would.
        const configPath = join(dir, 'svelte.config.mjs');
        writeFileSync(
            configPath,
            "import './helpers';\nexport default { preprocess: [] };\n",
        );
        mkdirSync(join(dir, 'helpers'));
        const indexPath = join(dir, 'helpers', 'index.js');
        writeFileSync(indexPath, 'export const x = 1;\n');
        expect(collectConfigDependencies(configPath).sort()).toEqual(
            [configPath, indexPath].sort(),
        );
    });

    it('skips a relative import that resolves to nothing', () => {
        // A dangling specifier (no file, no index) just narrows the watch set;
        // the scan keeps going and never throws.
        const configPath = join(dir, 'svelte.config.mjs');
        writeFileSync(
            configPath,
            "import './does-not-exist.js';\nexport default {};\n",
        );
        expect(collectConfigDependencies(configPath)).toEqual([configPath]);
    });

    it('skips a resolvable but unreadable import', () => {
        // The file exists (so `resolveModuleFile` returns it) but is not
        // readable, so `readFileSync` throws and the entry is skipped without
        // failing the scan.
        const configPath = join(dir, 'svelte.config.mjs');
        const helper = join(dir, 'helper.js');
        writeFileSync(configPath, "import './helper.js';\nexport default {};\n");
        writeFileSync(helper, 'export const y = 2;\n');
        chmodSync(helper, 0o000);
        try {
            const deps = collectConfigDependencies(configPath);
            // `helper.js` resolved (so it is in the set) but its contents were
            // unreadable, so no further imports were followed from it.
            expect(deps.sort()).toEqual([configPath, helper].sort());
        } finally {
            // Restore permissions so the temp dir can be cleaned up.
            chmodSync(helper, 0o644);
        }
    });

    it('returns just the entry when it cannot be resolved at all', () => {
        // A non-existent entry path resolves to nothing, so the queue drains
        // immediately and the result is empty.
        expect(
            collectConfigDependencies(join(dir, 'no-such-config.mjs')),
        ).toEqual([]);
    });
});

describe('loadConfigViaChild failure branches (mocked spawn)', () => {
    let dir: string;

    /**
     * A minimal stand-in for a spawned child process: an `EventEmitter`
     * exposing the `stdio` array, an optional `stderr` stream, and a `kill`
     * spy, enough for `loadConfigViaChild` to attach its listeners.
     */
    interface FakeChild extends EventEmitter {
        stdio: [unknown, unknown, EventEmitter | null, EventEmitter | null];
        stderr: EventEmitter | null;
        kill: () => void;
    }

    /**
     * Builds a fake child whose result pipe (fd 3) and stderr are controllable.
     * Pass `resultPipe: null` to model the pipe never opening.
     */
    function makeChild(
        options: { resultPipe?: boolean } = {},
    ): { child: FakeChild; result: EventEmitter | null; stderr: EventEmitter } {
        const result =
            options.resultPipe === false ? null : new EventEmitter();
        const stderr = new EventEmitter();
        const child = Object.assign(new EventEmitter(), {
            stdio: [null, null, stderr, result] as FakeChild['stdio'],
            stderr,
            kill: vi.fn(),
        }) as FakeChild;
        return { child, result, stderr };
    }

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-mock-'));
        // `loadConfigSnapshot` only reaches `loadConfigViaChild` once it has
        // located a config file, so a placeholder must exist on disk.
        writeFileSync(join(dir, 'svelte.config.mjs'), 'export default {};\n');
    });

    afterEach(() => {
        spawnControl.impl = null;
        rmSync(dir, { recursive: true, force: true });
    });

    it('fails when the result pipe (fd 3) is unavailable', async () => {
        const log = vi.fn();
        const { child } = makeChild({ resultPipe: false });
        spawnControl.impl = () => child;
        const snapshot = await loadConfigSnapshot(dir, log);
        // Falls back to defaults, reporting the located path.
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'result pipe unavailable',
        );
    });

    it('fails when the child emits more output than the cap allows', async () => {
        const log = vi.fn();
        const { child, result } = makeChild();
        spawnControl.impl = () => child;
        const promise = loadConfigSnapshot(dir, log);
        // A single chunk over the 16 MiB ceiling trips the size guard; a second
        // chunk afterwards re-enters `fail` while it is already settled.
        process.nextTick(() => {
            result?.emit('data', Buffer.alloc(16 * 1024 * 1024 + 1));
            result?.emit('data', Buffer.alloc(8));
            // A late `close` must also be ignored once settled.
            child.emit('close', 0);
        });
        const snapshot = await promise;
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'output too large',
        );
        // The guard killed the child.
        expect(child.kill).toHaveBeenCalled();
    });

    it('caps captured stderr at 64 chunks', async () => {
        const log = vi.fn();
        const { child, result, stderr } = makeChild();
        spawnControl.impl = () => child;
        const promise = loadConfigSnapshot(dir, log);
        process.nextTick(() => {
            // 65 chunks: only the first 64 are retained; the 65th hits the cap.
            for (let i = 0; i < 65; i++) {
                stderr.emit('data', Buffer.from(`line ${String(i)}\n`));
            }
            result?.emit('data', Buffer.from('ignored'));
            child.emit('close', 1);
        });
        const snapshot = await promise;
        expect(snapshot.mathBackend).toBe('mathjax');
        // The summary comes from the retained stderr (a non-Error line → the
        // first line is used).
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'line 0',
        );
    });

    it('parses a non-object fd-3 payload as an empty config', async () => {
        const log = vi.fn();
        const { child, result } = makeChild();
        spawnControl.impl = () => child;
        const promise = loadConfigSnapshot(dir, log);
        process.nextTick(() => {
            // Valid JSON, but not an object → treated as `{}`, so the defaults
            // stand and the "no SvelTeX preprocessor" notice fires.
            result?.emit('data', Buffer.from('42'));
            child.emit('close', 0);
        });
        const snapshot = await promise;
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'found no SvelTeX preprocessor',
        );
    });

    it('fails on a malformed fd-3 payload', async () => {
        const log = vi.fn();
        const { child, result } = makeChild();
        spawnControl.impl = () => child;
        const promise = loadConfigSnapshot(dir, log);
        process.nextTick(() => {
            result?.emit('data', Buffer.from('{not valid json'));
            child.emit('close', 0);
        });
        const snapshot = await promise;
        // The `JSON.parse` SyntaxError is surfaced as a load failure.
        expect(snapshot.mathBackend).toBe('mathjax');
        const message = log.mock.calls.map((c) => String(c[0])).join('\n');
        expect(message).toContain('Failed to load');
    });

    it('stringifies a non-Error rejection reason', async () => {
        const log = vi.fn();
        const { child } = makeChild();
        spawnControl.impl = () => child;
        const promise = loadConfigSnapshot(dir, log);
        // A non-Error `error` event flows through `fail`/`reject` and must be
        // coerced with `String(error)` by `loadConfigSnapshot`.
        process.nextTick(() => {
            child.emit('error', 'spawn ENOENT-ish string');
        });
        const snapshot = await promise;
        expect(snapshot.mathBackend).toBe('mathjax');
        expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
            'spawn ENOENT-ish string',
        );
    });
});
