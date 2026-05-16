// Unit tests for the TeX caret-context analysis (`src/core/context.ts`):
// recognising the command being typed (for completion) and the command under
// the cursor (for hover), including the `\begin{...}` environment-name slot
// and the escaped-backslash edge case.

import { describe, expect, it } from 'vitest';
import {
    commandAtCaret,
    completionContextAt,
} from '../../src/core/context.js';

describe('completionContextAt — ordinary commands', () => {
    it('recognises a lone backslash (empty prefix)', () => {
        const ctx = completionContextAt('\\', 1);
        expect(ctx).toEqual({
            prefix: '',
            backslashOffset: 0,
            isEnvironmentName: false,
        });
    });

    it('recognises a partially-typed command', () => {
        const ctx = completionContextAt('x = \\fra', 8);
        expect(ctx).toEqual({
            prefix: 'fra',
            backslashOffset: 4,
            isEnvironmentName: false,
        });
    });

    it('recognises the caret in the middle of a command word', () => {
        // `\al|pha` — caret after `al`.
        const ctx = completionContextAt('\\alpha', 3);
        expect(ctx?.prefix).toBe('al');
        expect(ctx?.backslashOffset).toBe(0);
    });

    it('returns undefined when the caret is not after a backslash', () => {
        expect(completionContextAt('plain text', 5)).toBeUndefined();
    });

    it('returns undefined for an escaped backslash (`\\\\`)', () => {
        // `\\` is a TeX line break, not a command opener; `\\x` is not a
        // command-typing context.
        expect(completionContextAt('a \\\\x', 5)).toBeUndefined();
    });

    it('recognises a command after an escaped backslash', () => {
        // `\\\al` — the third backslash opens a command.
        const ctx = completionContextAt('\\\\\\al', 5);
        expect(ctx?.prefix).toBe('al');
        expect(ctx?.backslashOffset).toBe(2);
    });

    it('returns undefined for an out-of-range offset', () => {
        expect(completionContextAt('\\a', 99)).toBeUndefined();
        expect(completionContextAt('\\a', -1)).toBeUndefined();
    });
});

describe('completionContextAt — environment names', () => {
    it('recognises the `\\begin{...}` environment-name slot', () => {
        const ctx = completionContextAt('\\begin{ali', 10);
        expect(ctx).toEqual({
            prefix: 'ali',
            backslashOffset: 7,
            isEnvironmentName: true,
        });
    });

    it('recognises the `\\end{...}` environment-name slot', () => {
        const ctx = completionContextAt('\\end{mat', 8);
        expect(ctx?.isEnvironmentName).toBe(true);
        expect(ctx?.prefix).toBe('mat');
    });

    it('recognises an empty environment name (caret right after `{`)', () => {
        const ctx = completionContextAt('\\begin{', 7);
        expect(ctx).toEqual({
            prefix: '',
            backslashOffset: 7,
            isEnvironmentName: true,
        });
    });

    it('accepts a starred environment name', () => {
        const ctx = completionContextAt('\\begin{align*', 13);
        expect(ctx?.prefix).toBe('align*');
        expect(ctx?.isEnvironmentName).toBe(true);
    });
});

describe('commandAtCaret', () => {
    it('finds a command when the caret is inside its name', () => {
        // `\fr|ac`
        const found = commandAtCaret('\\frac{1}{2}', 3);
        expect(found).toEqual({ name: 'frac', start: 0, end: 5 });
    });

    it('finds a command when the caret is on the backslash', () => {
        const found = commandAtCaret('\\frac', 0);
        expect(found).toEqual({ name: 'frac', start: 0, end: 5 });
    });

    it('finds a command when the caret is just past its last letter', () => {
        const found = commandAtCaret('\\frac', 5);
        expect(found?.name).toBe('frac');
    });

    it('finds a single-character command (`\\,`)', () => {
        const found = commandAtCaret('a\\,b', 3);
        expect(found).toEqual({ name: ',', start: 1, end: 3 });
    });

    it('returns undefined when the caret is on plain text', () => {
        expect(commandAtCaret('hello', 2)).toBeUndefined();
    });

    it('returns undefined for an escaped backslash', () => {
        expect(commandAtCaret('a\\\\b', 2)).toBeUndefined();
    });

    it('locates a command the caret sits just before', () => {
        // caret at offset 4, just before `\beta`
        const found = commandAtCaret('\\a \\beta', 3);
        expect(found?.name).toBe('beta');
    });

    it('returns undefined for an out-of-range offset', () => {
        expect(commandAtCaret('\\a', 99)).toBeUndefined();
        expect(commandAtCaret('\\a', -1)).toBeUndefined();
    });
});
