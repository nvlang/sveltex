// Unit tests for region computation (`src/core/regions.ts`): the split of a
// `.sveltex` document into a gap-free `Region[]`, the delegated/non-delegated
// classification, and resilience to malformed input.

import { describe, expect, it } from 'vitest';
import { computeRegions, isDelegated } from '../../src/core/regions.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';

const config = defaultConfigSnapshot();

/** Asserts that `regions` tile `[0, length)` gap-free and in order. */
function expectGapFree(
    regions: { sourceStart: number; sourceEnd: number }[],
    length: number,
): void {
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]?.sourceStart).toBe(0);
    expect(regions.at(-1)?.sourceEnd).toBe(length);
    for (let i = 1; i < regions.length; i++) {
        expect(regions[i]?.sourceStart).toBe(regions[i - 1]?.sourceEnd);
    }
}

describe('computeRegions — tiling invariant', () => {
    it('tiles a plain Markdown document with a single region', () => {
        const source = 'Just some **markdown** text.';
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
        expect(regions).toHaveLength(1);
        expect(regions[0]?.kind).toBe('markdown');
    });

    it('tiles a mixed document gap-free', () => {
        const source = [
            '# Title',
            '',
            'Paragraph with `inline code`.',
            '',
            '<script>',
            '  let x = 1;',
            '</script>',
            '',
            '$$E = mc^2$$',
            '',
            '<tex>\\draw (0,0) -- (1,1);</tex>',
        ].join('\n');
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
    });

    it('yields one empty Markdown region for an empty document', () => {
        const regions = computeRegions('', config);
        expect(regions).toEqual([
            { kind: 'markdown', sourceStart: 0, sourceEnd: 0 },
        ]);
    });
});

describe('computeRegions — classification', () => {
    it('classifies inline and display math as `math`', () => {
        const source = 'a $x$ b\n\n$$y$$\n';
        const regions = computeRegions(source, config);
        const mathRegions = regions.filter((r) => r.kind === 'math');
        expect(mathRegions.length).toBe(2);
    });

    it('classifies a `<script>` block as delegated `svelte`', () => {
        const source = '<script>\nlet n = 1;\n</script>\n';
        const regions = computeRegions(source, config);
        const scriptRegion = regions.find((r) => r.kind === 'svelte');
        expect(scriptRegion).toBeDefined();
    });

    it('classifies a configured verbatim tag as `verbatim`', () => {
        const source = 'before <tex>\\LaTeX</tex> after';
        const regions = computeRegions(source, config);
        const verbatim = regions.find((r) => r.kind === 'verbatim');
        expect(verbatim).toBeDefined();
        expect(
            source.slice(verbatim?.sourceStart, verbatim?.sourceEnd),
        ).toContain('<tex>');
    });

    it('classifies a fenced code block as non-delegated `code`', () => {
        const source = 'text\n\n```js\nconst a = 1;\n```\n\nmore';
        const regions = computeRegions(source, config);
        const code = regions.find((r) => r.kind === 'code');
        expect(code).toBeDefined();
    });
});

describe('isDelegated', () => {
    it('treats Markdown / Svelte / mustache tags as delegated', () => {
        expect(isDelegated('markdown')).toBe(true);
        expect(isDelegated('svelte')).toBe(true);
        expect(isDelegated('mustacheTag')).toBe(true);
    });

    it('treats code / math / verbatim / frontmatter as non-delegated', () => {
        expect(isDelegated('code')).toBe(false);
        expect(isDelegated('math')).toBe(false);
        expect(isDelegated('verbatim')).toBe(false);
        expect(isDelegated('frontmatter')).toBe(false);
    });
});

describe('computeRegions — resilience', () => {
    it('falls back to one Markdown region on unparseable input', () => {
        // An unterminated construct can make SvelTeX's parser throw; the
        // detector must degrade to a single delegated region, not crash.
        const source = '<script>\nlet broken = ';
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
    });

    it('respects custom verbatim tags from the config', () => {
        const custom = { ...config, verbatimTags: ['myverb'] };
        const source = 'x <myverb>raw</myverb> y';
        const regions = computeRegions(source, custom);
        expect(regions.some((r) => r.kind === 'verbatim')).toBe(true);
    });
});
