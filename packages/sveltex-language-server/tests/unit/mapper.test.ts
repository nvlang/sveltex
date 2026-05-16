// Unit tests for the bidirectional `SourceMap` (`src/core/mapper.ts`) and its
// integration with the region detector + virtual-document builder. The mapper
// is the most error-prone part of the LSP, so these tests exercise offset,
// position and range translation, span-boundary behaviour, and the dropping of
// unmapped (non-delegated) regions.

import { describe, expect, it } from 'vitest';
import { SourceMap } from '../../src/core/mapper.js';
import {
    allFeatures,
    identityMapping,
    type Mapping,
} from '../../src/core/mapping.js';
import { computeRegions } from '../../src/core/regions.js';
import { buildVirtualSvelte } from '../../src/core/virtual-svelte.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';

describe('SourceMap — offset translation (identity mappings)', () => {
    // Source:    "AAAA----BBBB"  (A/B delegated, - blanked)
    // Generated: "AAAA    BBBB"
    const source = 'AAAA----BBBB';
    const generated = 'AAAA    BBBB';
    const mappings: Mapping[] = [
        identityMapping(0, 0, 4), // "AAAA"
        identityMapping(8, 8, 4), // "BBBB"
    ];
    const map = SourceMap.create(mappings, source, generated);

    it('maps offsets inside a mapped span (source -> generated)', () => {
        expect(map.sourceOffsetToGenerated(0)).toBe(0);
        expect(map.sourceOffsetToGenerated(2)).toBe(2);
        expect(map.sourceOffsetToGenerated(9)).toBe(9);
    });

    it('maps offsets inside a mapped span (generated -> source)', () => {
        expect(map.generatedOffsetToSource(0)).toBe(0);
        expect(map.generatedOffsetToSource(2)).toBe(2);
        expect(map.generatedOffsetToSource(11)).toBe(11);
    });

    it('returns undefined for offsets in an unmapped (blanked) region', () => {
        // Offsets 4..7 are the blanked "----" gap.
        expect(map.sourceOffsetToGenerated(5)).toBeUndefined();
        expect(map.sourceOffsetToGenerated(6)).toBeUndefined();
        expect(map.generatedOffsetToSource(5)).toBeUndefined();
    });

    it('round-trips every mapped offset', () => {
        for (const offset of [0, 1, 2, 3, 8, 9, 10, 11]) {
            const generatedOffset = map.sourceOffsetToGenerated(offset);
            expect(generatedOffset).toBeDefined();
            if (generatedOffset === undefined) continue;
            expect(map.generatedOffsetToSource(generatedOffset)).toBe(offset);
        }
    });
});

describe('SourceMap — span boundary behaviour', () => {
    // Two adjacent mapped spans with no gap: "AAAA" then "BBBB".
    const source = 'AAAABBBB';
    const mappings: Mapping[] = [
        identityMapping(0, 0, 4),
        identityMapping(4, 4, 4),
    ];
    const map = SourceMap.create(mappings, source, source);

    it('maps an interior boundary into the right-hand span', () => {
        // Offset 4 is the end of span A and the start of span B; it must map
        // (a caret between two delegated regions stays delegated).
        expect(map.sourceOffsetToGenerated(4)).toBe(4);
    });

    it('maps a caret at the very end of the document', () => {
        // Offset 8 is the end of the last span and the end of the document.
        expect(map.sourceOffsetToGenerated(8)).toBe(8);
    });

    it('returns undefined past the end of the document', () => {
        expect(map.sourceOffsetToGenerated(9)).toBeUndefined();
    });
});

describe('SourceMap — position and range translation', () => {
    // A two-line document; line 2 contains a blanked region.
    // line 0: "hello world"   (delegated)
    // line 1: "xx----yy"      ("xx"/"yy" delegated, "----" blanked)
    const source = 'hello world\nxx----yy';
    const generated = 'hello world\nxx    yy';
    const mappings: Mapping[] = [
        identityMapping(0, 0, 12), // "hello world\n"
        identityMapping(12, 12, 2), // "xx"
        identityMapping(18, 18, 2), // "yy"
    ];
    const map = SourceMap.create(mappings, source, generated);

    it('maps a Position on the first line', () => {
        const generatedPos = map.sourcePositionToGenerated({
            line: 0,
            character: 6,
        });
        expect(generatedPos).toEqual({ line: 0, character: 6 });
    });

    it('maps a Position back from generated to source', () => {
        const sourcePos = map.generatedPositionToSource({
            line: 1,
            character: 1,
        });
        expect(sourcePos).toEqual({ line: 1, character: 1 });
    });

    it('returns undefined for a Position inside a blanked region', () => {
        // Character 4 on line 1 sits in the "----" run.
        expect(
            map.sourcePositionToGenerated({ line: 1, character: 4 }),
        ).toBeUndefined();
    });

    it('maps a Range whose endpoints are both mapped', () => {
        const range = map.sourceRangeToGenerated({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
        });
        expect(range).toEqual({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
        });
    });

    it('returns undefined for a Range with an unmapped endpoint', () => {
        const range = map.sourceRangeToGenerated({
            start: { line: 1, character: 0 }, // mapped ("xx")
            end: { line: 1, character: 4 }, // unmapped ("----")
        });
        expect(range).toBeUndefined();
    });
});

describe('SourceMap — feature flags', () => {
    it('reports the features of the containing mapping', () => {
        const features = allFeatures();
        const map = SourceMap.create(
            [identityMapping(0, 0, 5, features)],
            'AAAAA',
            'AAAAA',
        );
        expect(map.featuresAt(2, 'toGenerated')).toEqual(features);
        expect(map.featuresAt(2, 'toSource')).toEqual(features);
    });

    it('returns undefined for an offset with no mapping', () => {
        const map = SourceMap.create(
            [identityMapping(0, 0, 2)],
            'AA--',
            'AA  ',
        );
        expect(map.featuresAt(3, 'toGenerated')).toBeUndefined();
    });
});

describe('SourceMap — integration with the region pipeline', () => {
    const config = defaultConfigSnapshot();

    it('maps positions in delegated regions and drops non-delegated ones', () => {
        const source = [
            '# Heading', // markdown   (delegated)
            '', //
            'Text with `code` inline.', // `code` is non-delegated
            '', //
            '<script>', // svelte     (delegated)
            '  let value = 1;', //
            '</script>', //
            '', //
            '$$x^2$$', // math       (non-delegated)
        ].join('\n');

        const regions = computeRegions(source, config);
        const { text, sourceMap } = buildVirtualSvelte(source, regions);

        // The virtual document keeps the source's exact length.
        expect(text.length).toBe(source.length);

        // A delegated offset (inside the <script> body) round-trips.
        const scriptOffset = source.indexOf('let value');
        const generated = sourceMap.sourceOffsetToGenerated(scriptOffset);
        expect(generated).toBeDefined();
        expect(
            generated === undefined
                ? undefined
                : sourceMap.generatedOffsetToSource(generated),
        ).toBe(scriptOffset);

        // A non-delegated offset (inside the inline code span) does not map.
        const codeOffset = source.indexOf('code');
        expect(sourceMap.sourceOffsetToGenerated(codeOffset)).toBeUndefined();

        // A non-delegated offset (inside the display math) does not map.
        const mathOffset = source.indexOf('x^2');
        expect(sourceMap.sourceOffsetToGenerated(mathOffset)).toBeUndefined();
    });

    it('blanks non-delegated regions to equal-length whitespace, newlines kept', () => {
        const source = 'a\n\n```\nfenced\ncode\n```\n\nb';
        const regions = computeRegions(source, config);
        const { text } = buildVirtualSvelte(source, regions);

        expect(text.length).toBe(source.length);
        // Same number of newlines, so line numbers are preserved.
        expect((text.match(/\n/gu) ?? []).length).toBe(
            (source.match(/\n/gu) ?? []).length,
        );
        // The fenced code text itself is gone from the virtual document.
        expect(text).not.toContain('fenced');
        // The surrounding delegated Markdown survives.
        expect(text).toContain('a');
        expect(text).toContain('b');
    });

    it('handles an empty document without throwing', () => {
        const regions = computeRegions('', config);
        // An empty document still yields exactly one (empty) Markdown region.
        expect(regions).toHaveLength(1);
        expect(regions[0]).toMatchObject({
            kind: 'markdown',
            sourceStart: 0,
            sourceEnd: 0,
        });
        const { text, sourceMap } = buildVirtualSvelte('', regions);
        expect(text).toBe('');
        // Offset 0 sits in the zero-length Markdown region, so it maps to 0;
        // anything past the (empty) document is unmapped.
        expect(sourceMap.sourceOffsetToGenerated(0)).toBe(0);
        expect(sourceMap.sourceOffsetToGenerated(1)).toBeUndefined();
    });
});
