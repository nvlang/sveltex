// Unit tests for native frontmatter-key hover (`src/core/frontmatter.ts`):
// key recognition across the YAML / TOML / JSON syntaxes, and the hover body.

import { describe, expect, it } from 'vitest';
import type { Hover } from 'vscode-languageserver-protocol';
import { computeFrontmatterHover } from '../../src/core/frontmatter.js';

/** The Markdown body of a hover, or `''` when there is no hover. */
function bodyOf(hover: Hover | null): string {
    if (!hover) return '';
    const { contents } = hover;
    return typeof contents === 'object' && 'value' in contents
        ? contents.value
        : '';
}

describe('computeFrontmatterHover', () => {
    it('documents a YAML key, with a range covering just the key', () => {
        const source = ['---', 'title: My Document', '---'].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 2,
        });
        expect(hover).not.toBeNull();
        expect(bodyOf(hover)).toContain('<title>');
        expect(bodyOf(hover)).toContain(
            'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title',
        );
        expect(hover?.range).toEqual({
            start: { line: 1, character: 0 },
            end: { line: 1, character: 5 },
        });
    });

    it('recognises a TOML `key = value` line', () => {
        const source = ['+++', 'title = "My Document"', '+++'].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 1,
        });
        expect(bodyOf(hover)).toContain('<title>');
    });

    it('recognises a quoted JSON key', () => {
        const source = ['{', '  "noscript": "Enable JavaScript"', '}'].join(
            '\n',
        );
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 6,
        });
        expect(bodyOf(hover)).toContain('<noscript>');
        // The range starts after the indent and the opening quote.
        expect(hover?.range?.start).toEqual({ line: 1, character: 3 });
    });

    it('recognises a key in a YAML list item (`- rel:`)', () => {
        const source = [
            '---',
            'link:',
            '  - rel: stylesheet',
            '---',
        ].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 5,
        });
        expect(bodyOf(hover)).toContain('<link rel>');
    });

    it('recognises a TOML `[table]` header', () => {
        const source = ['+++', '[base]', 'target = "_blank"', '+++'].join(
            '\n',
        );
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 3,
        });
        expect(bodyOf(hover)).toContain('<base>');
    });

    it('documents the SvelTeX-specific `imports` key', () => {
        const source = ['---', 'imports:', '---'].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 3,
        });
        expect(bodyOf(hover)).toContain('https://sveltex.dev');
        expect(bodyOf(hover)).toContain('SvelTeX');
    });

    it('returns null when the caret is on the value, not the key', () => {
        const source = ['---', 'title: My Document', '---'].join('\n');
        // Character 10 is inside `My Document`, past the `title` key.
        expect(
            computeFrontmatterHover(source, { line: 1, character: 10 }),
        ).toBeNull();
    });

    it('returns null for an unrecognised key', () => {
        const source = ['---', 'unknownkey: value', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 1, character: 3 }),
        ).toBeNull();
    });

    it('returns null when the line holds no key at all', () => {
        const source = ['---', 'title: My Document', '---'].join('\n');
        // Line 0 is the `---` fence — no key.
        expect(
            computeFrontmatterHover(source, { line: 0, character: 1 }),
        ).toBeNull();
    });

    it('returns null when the caret line is out of range', () => {
        const source = ['---', 'title: x', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 99, character: 0 }),
        ).toBeNull();
    });
});
