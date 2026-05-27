// Unit tests for the language-feature layer (`src/core/features.ts`):
// completion filtering/insert behaviour and hover content, exercised against
// both the real KaTeX and MathJax command tables.

import { describe, expect, it } from 'vitest';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import { computeCompletion, computeHover } from '../../src/core/features.js';
import {
    CommandTable,
    createCommandTable,
    type CommandCategory,
    type MathCommand,
} from '../../src/core/commands.js';

const katex = createCommandTable('katex');
const mathjax = createCommandTable('mathjax');

describe('computeCompletion', () => {
    it('offers commands matching the typed prefix', () => {
        const result = computeCompletion(
            '\\fra',
            { line: 0, character: 4 },
            katex,
        );
        const labels = result.items.map((i) => i.label);
        expect(labels).toContain('\\frac');
        // Every offered label starts with the typed `\fra`.
        for (const label of labels) {
            expect(label.startsWith('\\fra')).toBe(true);
        }
    });

    it('returns an empty (non-incomplete) list outside a command context', () => {
        const result = computeCompletion(
            'plain text',
            { line: 0, character: 4 },
            katex,
        );
        expect(result.items).toEqual([]);
        expect(result.isIncomplete).toBe(false);
    });

    it('offers the whole command set after a lone backslash', () => {
        const result = computeCompletion(
            '\\',
            { line: 0, character: 1 },
            katex,
        );
        // A bare `\` matches everything; the list is truncated and therefore
        // flagged incomplete so the editor re-queries as the user narrows it.
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.isIncomplete).toBe(true);
    });

    it('produces a textEdit that replaces from the backslash to the caret', () => {
        const result = computeCompletion(
            'x = \\fra',
            { line: 0, character: 8 },
            katex,
        );
        const frac = result.items.find((i) => i.label === '\\frac');
        expect(frac?.textEdit).toBeDefined();
        if (frac?.textEdit && 'range' in frac.textEdit) {
            expect(frac.textEdit.range.start).toEqual({
                line: 0,
                character: 4,
            });
            expect(frac.textEdit.range.end).toEqual({
                line: 0,
                character: 8,
            });
            expect(frac.textEdit.newText).toBe('\\frac');
        }
    });

    it('leaves filterText unset so it defaults to the `\\name` label', () => {
        // Regression: a bare-name `filterText` (`frac`) combined with a
        // `textEdit.range` that starts at the backslash makes the editor
        // filter its query (`\fra`, *with* the backslash) against `frac` —
        // no match, so the item is hidden and completion appears broken.
        const result = computeCompletion(
            'x = \\fra',
            { line: 0, character: 8 },
            katex,
        );
        const frac = result.items.find((i) => i.label === '\\frac');
        expect(frac).toBeDefined();
        expect(frac?.filterText).toBeUndefined();
    });

    it('inserts a bare environment name inside `\\begin{...}`', () => {
        const result = computeCompletion(
            '\\begin{ali',
            { line: 0, character: 10 },
            mathjax,
        );
        const aligned = result.items.find((i) => i.label === 'aligned');
        expect(aligned).toBeDefined();
        expect(aligned?.kind).toBe(CompletionItemKind.Module);
        if (aligned?.textEdit && 'range' in aligned.textEdit) {
            // No backslash: the slot already sits inside the braces.
            expect(aligned.textEdit.newText).toBe('aligned');
        }
    });

    it('only offers environments inside `\\begin{...}`', () => {
        const result = computeCompletion(
            '\\begin{',
            { line: 0, character: 7 },
            mathjax,
        );
        // Every offered item is an environment (Module kind, bare label).
        for (const item of result.items) {
            expect(item.kind).toBe(CompletionItemKind.Module);
            expect(item.label.startsWith('\\')).toBe(false);
        }
    });

    it('reflects backend differences: mhchem `\\ce` is MathJax-only', () => {
        const inMathjax = computeCompletion(
            '\\ce',
            { line: 0, character: 3 },
            mathjax,
        ).items.map((i) => i.label);
        const inKatex = computeCompletion(
            '\\ce',
            { line: 0, character: 3 },
            katex,
        ).items.map((i) => i.label);
        expect(inMathjax).toContain('\\ce');
        expect(inKatex).not.toContain('\\ce');
    });

    it('tags each completion item with a category-appropriate kind', () => {
        const result = computeCompletion(
            '\\frac',
            { line: 0, character: 5 },
            katex,
        );
        const frac = result.items.find((i) => i.label === '\\frac');
        // `\frac` is a KaTeX function.
        expect(frac?.kind).toBe(CompletionItemKind.Function);
        expect(frac?.detail).toBe('function');
    });
});

describe('computeHover', () => {
    it('describes a command under the caret', () => {
        const hover = computeHover(
            '\\frac{1}{2}',
            { line: 0, character: 2 },
            katex,
            'katex',
        );
        expect(hover).not.toBeNull();
        const value =
            hover && typeof hover.contents === 'object'
                ? (hover.contents as { value: string }).value
                : '';
        expect(value).toContain('\\frac');
        expect(value).toContain('KaTeX');
    });

    it('sets the hover range to span the whole command', () => {
        const hover = computeHover(
            '\\alpha + 1',
            { line: 0, character: 3 },
            katex,
            'katex',
        );
        expect(hover?.range).toEqual({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 6 },
        });
    });

    it('returns null for an unknown command', () => {
        // `\notacommand` is not in either backend.
        const hover = computeHover(
            '\\notacommand',
            { line: 0, character: 4 },
            katex,
            'katex',
        );
        expect(hover).toBeNull();
    });

    it('returns null when the caret is not on a command', () => {
        expect(
            computeHover('plain', { line: 0, character: 2 }, katex, 'katex'),
        ).toBeNull();
    });

    it('names the active backend in the hover text', () => {
        const hover = computeHover(
            '\\sum',
            { line: 0, character: 2 },
            mathjax,
            'mathjax',
        );
        const value =
            hover && typeof hover.contents === 'object'
                ? (hover.contents as { value: string }).value
                : '';
        expect(value).toContain('MathJax');
    });

    it('does not describe a MathJax-only command when the backend is KaTeX', () => {
        // `\ce` exists for MathJax but not core KaTeX; hovering it under the
        // KaTeX backend must yield nothing.
        const hover = computeHover(
            '\\ce{H2O}',
            { line: 0, character: 2 },
            katex,
            'katex',
        );
        expect(hover).toBeNull();
    });
});

describe('completion item building — defensive category fallback', () => {
    // `completionKind` and `sortPrefix` each have a `default` arm guarding
    // against a category outside the four-member `CommandCategory` union. The
    // typed API never produces such a command, but the generated data could in
    // principle drift, so the fallback exists — and is exercised here with a
    // deliberately out-of-union category (cast past the type) to confirm it
    // yields the generic `Text` kind and the last sort group.
    const bogusCategory = 'unknown' as CommandCategory;
    const command: MathCommand = { name: 'aaa', category: bogusCategory };
    const table = CommandTable.create([command]);

    it('falls back to the Text kind and the last sort group', () => {
        const result = computeCompletion(
            '\\aa',
            { line: 0, character: 3 },
            table,
        );
        const item = result.items.find((i) => i.label === '\\aaa');
        expect(item).toBeDefined();
        expect(item?.kind).toBe(CompletionItemKind.Text);
        // `sortPrefix` returns '4' for an unknown category; the name follows.
        expect(item?.sortText).toBe('4aaa');
    });
});
