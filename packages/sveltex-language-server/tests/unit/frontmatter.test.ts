// Unit tests for native frontmatter-key hover (`src/core/frontmatter.ts`):
// key recognition across the YAML / TOML / JSON syntaxes, and the hover body.

import { describe, expect, it } from 'vitest';
import type { Hover } from 'vscode-languageserver-protocol';
import {
    computeFrontmatterCompletion,
    computeFrontmatterHover,
} from '../../src/core/frontmatter.js';

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

    it('documents a standard `<meta name>` value', () => {
        const source = [
            '---',
            'meta:',
            '  - name: description',
            '---',
        ].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 14,
        });
        expect(bodyOf(hover)).toContain('<meta name="description">');
        // The range covers just the `description` value token.
        expect(hover?.range).toEqual({
            start: { line: 2, character: 10 },
            end: { line: 2, character: 21 },
        });
    });

    it('documents a standard `<meta http-equiv>` value', () => {
        const source = [
            '---',
            'meta:',
            '  - http-equiv: content-security-policy',
            '---',
        ].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 20,
        });
        expect(bodyOf(hover)).toContain(
            '<meta http-equiv="content-security-policy">',
        );
    });

    it('documents the `name` key itself when the caret is on the key', () => {
        const source = ['---', 'meta:', '  - name: viewport', '---'].join(
            '\n',
        );
        // Character 5 is inside `name` — the key, not the `viewport` value.
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 5,
        });
        expect(bodyOf(hover)).toContain('renders `<meta name>`');
    });

    it('returns null for an unrecognised `<meta name>` value', () => {
        const source = ['---', 'name: bogusmetaname', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 1, character: 8 }),
        ).toBeNull();
    });

    it('documents a meta name written as a key (the mapping form)', () => {
        // `meta: { description: … }` — the name is a key, not a `name:` value.
        const source = [
            '---',
            'meta:',
            '  description: A summary',
            '---',
        ].join('\n');
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 6,
        });
        expect(bodyOf(hover)).toContain('<meta name="description">');
    });

    it('documents a meta name written as a top-level key', () => {
        const source = ['---', 'viewport: width=device-width', '---'].join(
            '\n',
        );
        const hover = computeFrontmatterHover(source, {
            line: 1,
            character: 3,
        });
        expect(bodyOf(hover)).toContain('<meta name="viewport">');
    });
});

describe('computeFrontmatterCompletion', () => {
    it('suggests frontmatter keys when a key is being typed', () => {
        const source = ['---', 'ti', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 1,
            character: 2,
        }).items.map((i) => i.label);
        expect(labels).toContain('title');
        expect(labels).toContain('meta');
        expect(labels).toContain('imports');
    });

    it('replaces the partial key already typed', () => {
        const source = ['---', 'ti', '---'].join('\n');
        const title = computeFrontmatterCompletion(source, {
            line: 1,
            character: 2,
        }).items.find((i) => i.label === 'title');
        expect(title?.textEdit).toEqual({
            range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 2 },
            },
            newText: 'title',
        });
    });

    it('suggests `<meta name>` values after `name:`', () => {
        const source = ['---', 'meta:', '  - name: ', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 10,
        }).items.map((i) => i.label);
        expect(labels).toContain('description');
        expect(labels).toContain('viewport');
        expect(labels).toContain('keywords');
    });

    it('suggests `<meta http-equiv>` values after `http-equiv:`', () => {
        const source = ['---', 'meta:', '  - http-equiv: ', '---'].join(
            '\n',
        );
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 16,
        }).items.map((i) => i.label);
        expect(labels).toContain('content-security-policy');
    });

    it('suggests nothing for a free-form value', () => {
        const source = ['---', 'title: My Doc', '---'].join('\n');
        const result = computeFrontmatterCompletion(source, {
            line: 1,
            character: 10,
        });
        expect(result.items).toEqual([]);
        expect(result.isIncomplete).toBe(false);
    });

    it('returns an empty list when the caret line is out of range', () => {
        const source = ['---', 'title: x', '---'].join('\n');
        expect(
            computeFrontmatterCompletion(source, { line: 99, character: 0 })
                .items,
        ).toEqual([]);
    });

    it('includes meta names among the key suggestions', () => {
        // A metadata name is written directly as a key in the `meta`
        // mapping form and the top-level form.
        const source = ['---', 'meta:', '  desc', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 6,
        }).items.map((i) => i.label);
        expect(labels).toContain('description');
        expect(labels).toContain('title');
    });
});
