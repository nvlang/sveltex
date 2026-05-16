// Unit tests for the per-region virtual document builder
// (`src/core/region-virtual.ts`): stripping the math delimiters / verbatim
// tags, computing the inner span, and mapping positions across the strip.

import { describe, expect, it } from 'vitest';
import { buildRegionVirtualDocument } from '../../src/core/region-virtual.js';
import type { Region } from '../../src/core/regions.js';

/** Builds a `Region` of `kind` covering the whole of `source`. */
function wholeRegion(source: string, kind: Region['kind']): Region {
    return { kind, sourceStart: 0, sourceEnd: source.length };
}

describe('buildRegionVirtualDocument — math regions', () => {
    it('strips single-dollar delimiters (`$…$`)', () => {
        const source = '$a+b$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('a+b');
        expect(v.innerStart).toBe(1);
        expect(v.innerEnd).toBe(4);
    });

    it('strips double-dollar delimiters (`$$…$$`)', () => {
        const source = '$$x^2$$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('x^2');
        expect(v.innerStart).toBe(2);
    });

    it('strips escaped-parenthesis delimiters (`\\(…\\)`)', () => {
        const source = '\\(y_1\\)';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('y_1');
    });

    it('strips escaped-bracket delimiters (`\\[…\\]`)', () => {
        const source = '\\[z^n\\]';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('z^n');
    });

    it('handles empty math content without going out of bounds', () => {
        const source = '$$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        // `$$` is too short to be `$$…$$`; treated as `$…$` -> empty inner.
        expect(v.text).toBe('');
        expect(v.innerEnd).toBeGreaterThanOrEqual(v.innerStart);
    });

    it('maps an inner position back to the source, across the delimiter', () => {
        // `$\alpha$` — caret at virtual offset 1 (`\a|`) is source offset 2.
        const source = '$\\alpha$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        const sourcePos = v.sourceMap.generatedPositionToSource({
            line: 0,
            character: 1,
        });
        expect(sourcePos).toEqual({ line: 0, character: 2 });
    });

    it('does not map a position on a stripped delimiter', () => {
        const source = '$a$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        // Source offset 0 is the opening `$` — outside the mapped inner span.
        expect(
            v.sourceMap.sourcePositionToGenerated({
                line: 0,
                character: 0,
            }),
        ).toBeUndefined();
    });
});

describe('buildRegionVirtualDocument — verbatim regions', () => {
    it('strips the opening and closing tags of a `<tex>` region', () => {
        const source = '<tex>\n\\draw (0,0);\n</tex>';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        expect(v.text).toBe('\n\\draw (0,0);\n');
        expect(v.innerStart).toBe('<tex>'.length);
    });

    it('strips tags that carry attributes', () => {
        const source = '<tex ref="x">body</tex>';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        expect(v.text).toBe('body');
    });

    it('treats a self-closing verbatim element as having no inner text', () => {
        const source = '<tex />';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        expect(v.text).toBe('');
    });

    it('offsets the inner span by the region start in the document', () => {
        const source = 'prefix <tex>L</tex>';
        const region: Region = {
            kind: 'verbatim',
            sourceStart: 7,
            sourceEnd: source.length,
        };
        const v = buildRegionVirtualDocument(source, region);
        expect(v.text).toBe('L');
        // `<tex>` is 5 chars; inner starts at 7 + 5 = 12.
        expect(v.innerStart).toBe(12);
    });

    it('round-trips a position through the verbatim source map', () => {
        const source = '<tex>\\foo</tex>';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        const generated = v.sourceMap.sourcePositionToGenerated({
            line: 0,
            character: 6, // `\foo` -> `\f|` is source char 6
        });
        expect(generated).toEqual({ line: 0, character: 1 });
    });
});
