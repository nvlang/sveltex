// Unit tests for the description / hover-text layer (`src/core/describe.ts`):
// the three-tier description fallback (documentation → curated gloss → generic
// category sentence) and the structure of the Markdown shown on hover.

import { describe, expect, it } from 'vitest';
import { describeCommand, hoverMarkdown } from '../../src/core/describe.js';
import type { MathCommand } from '../../src/core/commands.js';

describe('describeCommand', () => {
    it('prefers the documentation-sourced description when present', () => {
        const command: MathCommand = {
            name: 'frac',
            category: 'function',
            description: 'A documentation-sourced description.',
        };
        expect(describeCommand(command)).toBe(
            'A documentation-sourced description.',
        );
    });

    it('falls back to a curated gloss when there is no description', () => {
        // `frac` has a hand-written gloss; with no `description` it is used.
        const command: MathCommand = { name: 'frac', category: 'function' };
        expect(describeCommand(command)).toBe(
            'Typesets a fraction with the given numerator and denominator.',
        );
    });

    it('falls back to the generic category sentence as a last resort', () => {
        // A name with neither a documentation description nor a gloss.
        const command: MathCommand = { name: 'zzznotreal', category: 'macro' };
        expect(describeCommand(command)).toBe(
            'A TeX macro (defined in terms of other commands).',
        );
    });
});

describe('hoverMarkdown', () => {
    it('shows the signature, fenced, when the command takes arguments', () => {
        const command: MathCommand = {
            name: 'sqrt',
            category: 'function',
            signature: '\\sqrt[degree]{radicand}',
        };
        expect(hoverMarkdown(command, 'katex')).toContain(
            '```latex\n\\sqrt[degree]{radicand}\n```',
        );
    });

    it('shows the bare `\\name` when the command takes no arguments', () => {
        const command: MathCommand = { name: 'alpha', category: 'symbol' };
        expect(hoverMarkdown(command, 'katex')).toContain(
            '```latex\n\\alpha\n```',
        );
    });

    it('shows a `\\begin…\\end` pair for an environment without a signature', () => {
        const command: MathCommand = { name: 'matrix', category: 'environment' };
        expect(hoverMarkdown(command, 'katex')).toContain(
            '\\begin{matrix} … \\end{matrix}',
        );
    });

    it('shows the Unicode glyph and its name for a symbol command', () => {
        const command: MathCommand = {
            name: 'oint',
            category: 'symbol',
            unicode: '∮',
            unicodeName: 'contour integral',
        };
        const lines = hoverMarkdown(command, 'katex').split('\n');
        expect(lines).toContain('**∮** (contour integral)');
    });

    it('shows the glyph alone when its Unicode name is unknown', () => {
        const command: MathCommand = {
            name: 'somesym',
            category: 'symbol',
            unicode: '⊗',
        };
        const lines = hoverMarkdown(command, 'katex').split('\n');
        expect(lines).toContain('**⊗**');
    });

    it('omits the Unicode line for a command with no glyph', () => {
        const command: MathCommand = { name: 'sqrt', category: 'function' };
        const lines = hoverMarkdown(command, 'katex').split('\n');
        expect(lines.some((line) => line.startsWith('**'))).toBe(false);
    });

    it('builds a footer of backend, package and category', () => {
        const command: MathCommand = {
            name: 'sum',
            category: 'symbol',
            package: 'base',
        };
        expect(hoverMarkdown(command, 'mathjax')).toContain(
            '_MathJax · base · symbol_',
        );
    });

    it('omits the package from the footer when it is unknown', () => {
        const command: MathCommand = { name: 'sum', category: 'symbol' };
        expect(hoverMarkdown(command, 'katex')).toContain('_KaTeX · symbol_');
    });

    it('includes the description in the body', () => {
        const command: MathCommand = {
            name: 'frac',
            category: 'function',
            description: 'It typesets a fraction.',
        };
        expect(hoverMarkdown(command, 'katex')).toContain(
            'It typesets a fraction.',
        );
    });
});
