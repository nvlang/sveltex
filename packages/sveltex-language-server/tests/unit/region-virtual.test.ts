// Unit tests for the per-region virtual document builder
// (`src/core/region-virtual.ts`): stripping the math delimiters / verbatim
// tags, computing the inner span, and mapping positions across the strip.

import { describe, expect, it } from 'vitest';
import {
    buildLatexScaffold,
    buildRegionVirtualDocument,
    latexRegionScaffold,
} from '../../src/core/region-virtual.js';
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

    it('strips nothing from an unrecognised math slice (over-include)', () => {
        // A `math` region whose slice carries no recognised delimiter pair
        // falls through `mathWrapper` to `[0, 0]` — nothing stripped, the whole
        // slice is treated as inner content (better than mis-mapping).
        const source = 'bare';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('bare');
        expect(v.innerStart).toBe(0);
        expect(v.innerEnd).toBe(source.length);
    });

    it('strips nothing from a single-`$` slice too short to be a pair', () => {
        // `$` alone fails the `length >= 2` guard of the `$…$` arm and every
        // other arm — exercising the trailing `[0, 0]` fall-through.
        const source = '$';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'math'),
        );
        expect(v.text).toBe('$');
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
    /** Wraps `inner` in the LaTeX scaffold, as the builder does for TexLab. */
    function scaffolded(inner: string): string {
        return latexRegionScaffold.prefix + inner + latexRegionScaffold.suffix;
    }

    it('strips the tags and embeds a `<tex>` body in the LaTeX scaffold', () => {
        const source = '<tex>\n\\draw (0,0);\n</tex>';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        // The `<tex>…</tex>` tags are stripped; the body is wrapped so TexLab
        // sees it as document-body content.
        expect(v.text).toBe(scaffolded('\n\\draw (0,0);\n'));
        expect(v.innerStart).toBe('<tex>'.length);
    });

    it('strips tags that carry attributes', () => {
        const source = '<tex ref="x">body</tex>';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        expect(v.text).toBe(scaffolded('body'));
    });

    it('treats a self-closing verbatim element as having no inner text', () => {
        const source = '<tex />';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        // No inner content — just the bare scaffold.
        expect(v.text).toBe(scaffolded(''));
    });

    it('offsets the inner span by the region start in the document', () => {
        const source = 'prefix <tex>L</tex>';
        const region: Region = {
            kind: 'verbatim',
            sourceStart: 7,
            sourceEnd: source.length,
        };
        const v = buildRegionVirtualDocument(source, region);
        expect(v.text).toBe(scaffolded('L'));
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
        // The scaffold preamble pushes the body down by its line count; the
        // mapping itself is still identity, so `\f|` -> char 1 on that line.
        const preambleLines = latexRegionScaffold.prefix.split('\n').length - 1;
        expect(generated).toEqual({ line: preambleLines, character: 1 });
    });

    it('embeds a verbatim region in a caller-supplied scaffold', () => {
        // The forwarder passes the project's real `sveltex.config.*` scaffold;
        // `buildRegionVirtualDocument` must use it instead of the default.
        const source = '<tex>\\R</tex>';
        const scaffold = buildLatexScaffold(
            '\\documentclass{standalone}',
            '\\newcommand{\\R}{\\mathbb{R}}',
        );
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
            scaffold,
        );
        expect(v.text).toBe(`${scaffold.prefix}\\R${scaffold.suffix}`);
    });

    it('strips nothing from a verbatim slice with no open/close tags', () => {
        // A `verbatim` region whose slice is not a well-formed `<tag>…</tag>`
        // (no opener, or no closer) falls through `verbatimWrapper` to `[0, 0]`:
        // the body is the entire slice, embedded as-is in the scaffold.
        const source = 'no tags here';
        const v = buildRegionVirtualDocument(
            source,
            wholeRegion(source, 'verbatim'),
        );
        expect(v.text).toBe(scaffolded('no tags here'));
        expect(v.innerStart).toBe(0);
        expect(v.innerEnd).toBe(source.length);
    });
});

describe('buildRegionVirtualDocument — other region kinds', () => {
    it('treats a non-math / non-verbatim region as bare inner content', () => {
        // For any kind other than `math` or `verbatim`, nothing is stripped and
        // no scaffold is applied: the virtual text is the verbatim slice.
        const source = 'const a = 1;';
        const region: Region = {
            kind: 'code',
            sourceStart: 0,
            sourceEnd: source.length,
        };
        const v = buildRegionVirtualDocument(source, region);
        expect(v.text).toBe(source);
        expect(v.innerStart).toBe(0);
        expect(v.innerEnd).toBe(source.length);
    });
});

describe('buildLatexScaffold', () => {
    it('wraps a documentclass and preamble into prefix/suffix', () => {
        const scaffold = buildLatexScaffold(
            '\\documentclass{standalone}',
            '\\usepackage{tikz}',
        );
        expect(scaffold.prefix).toBe(
            '\\documentclass{standalone}\n' +
                '\\usepackage{tikz}\n' +
                '\\begin{document}\n',
        );
        expect(scaffold.suffix).toBe('\n\\end{document}\n');
    });
});
