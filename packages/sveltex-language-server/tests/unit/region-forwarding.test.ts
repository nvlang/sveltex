// Unit tests for region forwarding (`src/core/region-forwarding.ts`):
// classifying LaTeX verbatim regions, forwarding math regions to the bundled
// math language server, and the graceful "skip" behaviour when no child server
// is available (a `custom`/`none` math backend, or TexLab not on `PATH`).
//
// The TexLab path is deliberately tested with TexLab made ABSENT: `PATH` is
// blanked for the duration so `findTexlab` fails, exercising the skip branch
// without depending on whether the host actually has TexLab installed.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    RegionForwarder,
    isLatexVerbatimRegion,
} from '../../src/core/region-forwarding.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';
import { computeRegions, type Region } from '../../src/core/regions.js';

describe('isLatexVerbatimRegion', () => {
    const latexTags = ['tex', 'latex', 'tikz'];

    /** The first verbatim region of `source`. */
    function verbatimRegionOf(source: string): Region {
        const regions = computeRegions(source, defaultConfigSnapshot());
        const region = regions.find((r) => r.kind === 'verbatim');
        if (!region) throw new Error('no verbatim region found');
        return region;
    }

    it('accepts a `<tex>` region', () => {
        const source = '<tex>\\draw (0,0);</tex>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('accepts a `<tikz>` region', () => {
        const source = '<tikz>\\node {x};</tikz>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('is case-insensitive about the tag name', () => {
        const source = '<TeX>\\x</TeX>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('rejects a verbatim region whose tag is not a LaTeX tag', () => {
        const source = '<verbatim>raw</verbatim>';
        const region = verbatimRegionOf(source);
        expect(isLatexVerbatimRegion(source, region, latexTags)).toBe(false);
    });

    it('rejects a non-verbatim region', () => {
        const mathRegion: Region = {
            kind: 'math',
            sourceStart: 0,
            sourceEnd: 5,
        };
        expect(isLatexVerbatimRegion('$a+b$', mathRegion, latexTags)).toBe(
            false,
        );
    });
});

describe('RegionForwarder — math regions', () => {
    let forwarder: RegionForwarder;

    afterEach(async () => {
        await forwarder.stop();
    });

    /** A math region covering all of `source`. */
    function mathRegion(source: string): Region {
        return { kind: 'math', sourceStart: 0, sourceEnd: source.length };
    }

    it('forwards math completion to the bundled math language server', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\alp$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 }, // caret after `\alp`
        );
        expect(result).not.toBeNull();
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.map((i) => i.label)).toContain('\\alpha');
    });

    it('honours the KaTeX backend', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'katex',
        });
        const source = '$\\sqr$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.map((i) => i.label)).toContain('\\sqrt');
    });

    it('maps completion ranges back to `.sveltex` coordinates', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\fra$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        const frac = items.find((i) => i.label === '\\frac');
        // The replace range must start after the opening `$` (source char 1).
        if (frac?.textEdit && 'range' in frac.textEdit) {
            expect(frac.textEdit.range.start.character).toBe(1);
        }
    });

    it('forwards math hover and maps the range back', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\frac{1}{2}$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 3 }, // inside `\frac`
        );
        expect(hover).not.toBeNull();
        // `\frac` sits at source chars 1..6 (just inside the `$`).
        expect(hover?.range?.start.character).toBe(1);
    });

    it('skips math regions when the backend is `none`', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'none',
        });
        const source = '$\\alpha$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 7 },
        );
        // No math language server for `none`; the region is skipped.
        expect(result).toBeNull();
    });

    it('skips math regions when the backend is `custom`', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'custom',
        });
        const source = '$\\beta$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 3 },
        );
        expect(hover).toBeNull();
    });

    it('does not forward a position that lands on a math delimiter', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\alpha$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 0 }, // the opening `$` — outside the inner span
        );
        expect(hover).toBeNull();
    });
});

describe('RegionForwarder — TexLab absent', () => {
    // Blank `PATH` so `findTexlab` cannot find a TexLab binary, regardless of
    // whether the host machine has one installed.
    let savedPath: string | undefined;
    let forwarder: RegionForwarder;

    beforeEach(() => {
        savedPath = process.env['PATH'];
        process.env['PATH'] = '';
    });

    afterEach(async () => {
        if (savedPath === undefined) {
            delete process.env['PATH'];
        } else {
            process.env['PATH'] = savedPath;
        }
        await forwarder.stop();
    });

    it('skips LaTeX verbatim regions gracefully when TexLab is not installed', async () => {
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        const source = '<tex>\\draw (0,0);</tex>';
        const region = computeRegions(source, defaultConfigSnapshot()).find(
            (r) => r.kind === 'verbatim',
        );
        expect(region).toBeDefined();
        if (!region) return;
        // No `texlab` on `PATH`: forwarding must return `null`, not throw.
        const completion = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        expect(completion).toBeNull();
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        expect(hover).toBeNull();
    });
});

describe('RegionForwarder — lifecycle', () => {
    it('can be stopped before any child is spawned', async () => {
        const forwarder = new RegionForwarder(defaultConfigSnapshot());
        // No request was made, so no child exists; stop must still be safe.
        await expect(forwarder.stop()).resolves.toBeUndefined();
    });

    it('accepts a config update', () => {
        const forwarder = new RegionForwarder(defaultConfigSnapshot());
        forwarder.updateConfig({
            ...defaultConfigSnapshot(),
            mathBackend: 'katex',
        });
        // No throw — the updated config is used on the next request.
        expect(true).toBe(true);
    });

    afterAll(() => {
        // No shared state to clean up.
    });
});
