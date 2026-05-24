// Unit tests for the native Markdown language features (`src/core/markdown.ts`):
// document symbols (a heading outline nested by level), folding ranges
// (headings, code blocks, lists, blockquotes) and selection ranges (the chain
// of enclosing mdast nodes for a caret). All three parse the `.sveltex` source
// with SvelTeX's own `parseToMdast`, so the tests feed real documents and
// assert on the produced LSP structures.

import { describe, expect, it } from 'vitest';
import {
    FoldingRangeKind,
    SymbolKind,
    type DocumentSymbol,
    type FoldingRange,
    type SelectionRange,
} from 'vscode-languageserver-protocol';
import {
    computeDocumentSymbols,
    computeFoldingRanges,
    computeSelectionRanges,
} from '../../src/core/markdown.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';

const config = defaultConfigSnapshot();

// A config whose `mathDelims` is structurally broken: with `dollars` enabled
// but `inline` nulled, `parseToMdast` dereferences `inline.singleDollar` and
// throws. `parse()` swallows that, so every feature falls back to its empty /
// degenerate result — the realistic way to drive the parse-failure branch
// while still handing the features a valid document string.
const brokenConfig = {
    ...config,
    mathDelims: {
        ...config.mathDelims,
        dollars: true,
        inline: null as unknown as (typeof config.mathDelims)['inline'],
    },
};

/** Maps a symbol tree to `name`/`depth-of-children` for terse assertions. */
function shape(symbols: DocumentSymbol[]): unknown {
    return symbols.map((s) => ({
        name: s.name,
        children: shape(s.children ?? []),
    }));
}

describe('computeDocumentSymbols', () => {
    it('returns an empty list for a document with no headings', () => {
        const source = 'Just a paragraph with **bold** text.\n\nAnother one.';
        expect(computeDocumentSymbols(source, config)).toEqual([]);
    });

    it('lists sibling headings of the same level as roots', () => {
        const source = ['# One', '', 'a', '', '# Two', '', 'b'].join('\n');
        expect(shape(computeDocumentSymbols(source, config))).toEqual([
            { name: 'One', children: [] },
            { name: 'Two', children: [] },
        ]);
    });

    it('nests a deeper heading under the preceding shallower one', () => {
        const source = [
            '# Top',
            '',
            '## Mid',
            '',
            '### Deep',
            '',
            '## Mid2',
        ].join('\n');
        expect(shape(computeDocumentSymbols(source, config))).toEqual([
            {
                name: 'Top',
                children: [
                    { name: 'Mid', children: [{ name: 'Deep', children: [] }] },
                    { name: 'Mid2', children: [] },
                ],
            },
        ]);
    });

    it('dedents correctly when a heading is shallower than the previous', () => {
        // `###` then `#`: the `#` must pop the `##`/`###` off the stack and
        // become a new root sibling of the first `#`.
        const source = [
            '# A',
            '',
            '## B',
            '',
            '### C',
            '',
            '# D',
        ].join('\n');
        expect(shape(computeDocumentSymbols(source, config))).toEqual([
            {
                name: 'A',
                children: [
                    { name: 'B', children: [{ name: 'C', children: [] }] },
                ],
            },
            { name: 'D', children: [] },
        ]);
    });

    it('handles a level jump (h1 straight to h3) by nesting under the h1', () => {
        const source = ['# A', '', '### C'].join('\n');
        expect(shape(computeDocumentSymbols(source, config))).toEqual([
            { name: 'A', children: [{ name: 'C', children: [] }] },
        ]);
    });

    it('treats a leading deep heading with no shallower parent as a root', () => {
        const source = ['### Deep first', '', 'body'].join('\n');
        expect(shape(computeDocumentSymbols(source, config))).toEqual([
            { name: 'Deep first', children: [] },
        ]);
    });

    it('falls back to `H<depth>` for a heading with no text', () => {
        // A setext-style empty heading is hard to produce; an ATX `#` with no
        // following text yields a heading whose concatenated text is empty.
        const source = ['#', '', 'body'].join('\n');
        const symbols = computeDocumentSymbols(source, config);
        expect(symbols).toHaveLength(1);
        expect(symbols[0]?.name).toBe('H1');
    });

    it('reports the String kind and a range spanning the heading line', () => {
        const source = '# Title';
        const symbols = computeDocumentSymbols(source, config);
        expect(symbols[0]?.kind).toBe(SymbolKind.String);
        expect(symbols[0]?.range).toEqual({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 7 },
        });
        // `selectionRange` equals `range` for a heading symbol.
        expect(symbols[0]?.selectionRange).toEqual(symbols[0]?.range);
    });

    it('returns an empty list when parsing fails', () => {
        // A broken config makes `parseToMdast` throw; `parse` swallows it and
        // the feature degrades to an empty result.
        expect(computeDocumentSymbols('# A', brokenConfig)).toEqual([]);
    });
});

describe('computeFoldingRanges', () => {
    it('returns an empty list for a single-line document', () => {
        expect(computeFoldingRanges('# Title', config)).toEqual([]);
    });

    it('folds a multi-line fenced code block as a Region', () => {
        const source = ['```js', 'const x = 1;', 'const y = 2;', '```'].join(
            '\n',
        );
        const ranges = computeFoldingRanges(source, config);
        expect(ranges).toContainEqual({
            startLine: 0,
            endLine: 3,
            kind: FoldingRangeKind.Region,
        });
    });

    it('folds a multi-line list and a multi-line blockquote', () => {
        const source = [
            '- one',
            '- two',
            '- three',
            '',
            '> quote a',
            '> quote b',
        ].join('\n');
        const ranges = computeFoldingRanges(source, config);
        // List spans lines 0-2; blockquote spans lines 4-5. Neither carries a
        // `kind` (only code blocks do).
        expect(ranges).toContainEqual({ startLine: 0, endLine: 2 });
        expect(ranges).toContainEqual({ startLine: 4, endLine: 5 });
        for (const r of ranges) {
            if (r.startLine === 0 || r.startLine === 4) {
                expect('kind' in r).toBe(false);
            }
        }
    });

    it('does not fold a single-line list', () => {
        // One list item on one line is not multi-line, so it produces no fold.
        const source = ['- only', '', 'paragraph after'].join('\n');
        const ranges = computeFoldingRanges(source, config);
        expect(ranges).not.toContainEqual(
            expect.objectContaining({ startLine: 0, endLine: 0 }),
        );
    });

    it('folds a heading down to the line before the next same-level heading', () => {
        const source = [
            '# A', // line 0
            '', // 1
            'body of A', // 2
            '', // 3
            '# B', // line 4
            '', // 5
            'body of B', // 6
        ].join('\n');
        const ranges = computeFoldingRanges(source, config);
        // `# A` folds from line 0 to line 3 (the line before `# B`).
        expect(ranges).toContainEqual({ startLine: 0, endLine: 3 });
        // `# B` is the last heading: its fold runs to end-of-document, but the
        // fold always ends one line *before* the boundary line, so a document
        // with no trailing newline excludes its very last line (line 5, not 6).
        expect(ranges).toContainEqual({ startLine: 4, endLine: 5 });
    });

    it('a parent heading fold stops at the next same-or-higher heading', () => {
        const source = [
            '# A', // 0
            '', // 1
            '## B', // 2
            '', // 3
            'text', // 4
            '', // 5
            '# C', // 6
        ].join('\n');
        const ranges = computeFoldingRanges(source, config);
        // `# A` extends over its `## B` child, stopping before `# C` (line 5).
        expect(ranges).toContainEqual({ startLine: 0, endLine: 5 });
        // `## B` folds to the line before `# C` too (line 5).
        expect(ranges).toContainEqual({ startLine: 2, endLine: 5 });
    });

    it('does not fold a heading with no body (single line span)', () => {
        // Two adjacent headings: the first has nothing to fold (next heading is
        // on the very next line), so no range is produced for it.
        const source = ['# A', '# B', '', 'body'].join('\n');
        const ranges = computeFoldingRanges(source, config);
        expect(ranges).not.toContainEqual(
            expect.objectContaining({ startLine: 0, endLine: 0 }),
        );
        // `# B` does fold (down to the body, line 2 — one line before the
        // document's last line, by the same end-of-document rule).
        expect(ranges).toContainEqual({ startLine: 1, endLine: 2 });
    });

    it('returns an empty list when parsing fails', () => {
        expect(computeFoldingRanges('# A\n\nbody', brokenConfig)).toEqual([]);
    });

    it('produces no heading folds for a heading-free document', () => {
        const source = ['para one', '', 'para two'].join('\n');
        const ranges: FoldingRange[] = computeFoldingRanges(source, config);
        // Plain paragraphs are not foldable.
        expect(ranges).toEqual([]);
    });
});

describe('computeSelectionRanges', () => {
    it('returns a nested chain from the widest node down to the narrowest', () => {
        const source = '# Heading text';
        // Caret inside the heading text (offset within "Heading").
        const [selection] = computeSelectionRanges(
            source,
            [{ line: 0, character: 4 }],
            config,
        );
        expect(selection).toBeDefined();
        // The outermost range is the whole document (root), the innermost the
        // text node. Walk the parent chain and collect the ranges.
        const ranges: SelectionRange['range'][] = [];
        let node: SelectionRange | undefined = selection;
        while (node) {
            ranges.push(node.range);
            node = node.parent;
        }
        // At least root -> heading -> text (3 levels), narrowest first.
        expect(ranges.length).toBeGreaterThanOrEqual(2);
        const widthOf = (r: SelectionRange['range']): number =>
            (r.end.line - r.start.line) * 1000 +
            (r.end.character - r.start.character);
        // The chain widens as we follow `.parent`.
        for (let i = 1; i < ranges.length; i++) {
            const child = ranges[i - 1];
            const parent = ranges[i];
            if (child && parent) {
                expect(widthOf(parent)).toBeGreaterThanOrEqual(widthOf(child));
            }
        }
    });

    it('returns one result per requested position, index-aligned', () => {
        const source = ['# A', '', 'paragraph body'].join('\n');
        const positions = [
            { line: 0, character: 2 },
            { line: 2, character: 3 },
        ];
        const result = computeSelectionRanges(source, positions, config);
        expect(result).toHaveLength(2);
        expect(result[0]?.range.start.line).toBe(0);
        expect(result[1]?.range.start.line).toBe(2);
    });

    it('yields a degenerate empty range for a position past the content', () => {
        // An empty document has no containing node beyond the (zero-length)
        // root at offset 0; a caret there collapses to a degenerate range.
        const position = { line: 0, character: 0 };
        const [selection] = computeSelectionRanges('', [position], config);
        expect(selection).toEqual({
            range: { start: position, end: position },
        });
    });

    it('yields a degenerate range when parsing fails', () => {
        // A failed parse leaves `root` undefined, so no node contains the
        // caret and the result collapses to the requested position — but the
        // document text is still valid, so `offsetAt` works.
        const position = { line: 0, character: 1 };
        const [selection] = computeSelectionRanges(
            '# A\n\nbody',
            [position],
            brokenConfig,
        );
        expect(selection).toEqual({
            range: { start: position, end: position },
        });
    });

    it('returns an empty array when no positions are requested', () => {
        expect(computeSelectionRanges('# A', [], config)).toEqual([]);
    });
});
