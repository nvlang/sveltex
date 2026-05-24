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
        const source = ['---', 'link:', '  - rel: stylesheet', '---'].join(
            '\n',
        );
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 5,
        });
        expect(bodyOf(hover)).toContain('<link rel>');
    });

    it('recognises a TOML `[table]` header', () => {
        const source = ['+++', '[base]', 'target = "_blank"', '+++'].join('\n');
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
        const source = ['---', 'meta:', '  - name: description', '---'].join(
            '\n',
        );
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
        const source = ['---', 'meta:', '  - name: viewport', '---'].join('\n');
        // Character 5 is inside `name` — the key, not the `viewport` value.
        const hover = computeFrontmatterHover(source, {
            line: 2,
            character: 5,
        });
        expect(bodyOf(hover)).toContain(
            'renders `<meta name="〈value〉" content="…">`',
        );
    });

    it('returns null for an unrecognised `<meta name>` value', () => {
        const source = ['---', 'name: bogusmetaname', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 1, character: 8 }),
        ).toBeNull();
    });

    it('documents a meta name written as a key (the mapping form)', () => {
        // `meta: { description: … }` — the name is a key, not a `name:` value.
        const source = ['---', 'meta:', '  description: A summary', '---'].join(
            '\n',
        );
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

    it('does not document a key that is invalid in its block', () => {
        // `title` inside `meta` is not a title — SvelTeX would not render it
        // as one — so it gets no hover there.
        const source = ['---', 'meta:', '  title: x', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 2, character: 4 }),
        ).toBeNull();
    });

    it('documents `href` differently inside `base` and `link`', () => {
        const base = ['---', 'base:', '  href: /docs/', '---'].join('\n');
        expect(
            bodyOf(computeFrontmatterHover(base, { line: 2, character: 4 })),
        ).toContain('<base href>');

        const link = ['---', 'link:', '  - href: /a.css', '---'].join('\n');
        expect(
            bodyOf(computeFrontmatterHover(link, { line: 2, character: 6 })),
        ).toContain('<link href>');
    });

    it('resolves the block from a TOML `[meta]` table header', () => {
        // The enclosing TOML table decides the context: `description` under a
        // `[meta]` table is a `<meta name>`, not a top-level key.
        const source = [
            '+++',
            '[meta]',
            'description = "A summary"',
            '+++',
        ].join('\n');
        expect(
            bodyOf(computeFrontmatterHover(source, { line: 2, character: 2 })),
        ).toContain('<meta name="description">');
    });

    it('treats a non-meta/base/link TOML table as the top level', () => {
        // A `[server]`-style table is not one SvelTeX maps, so the context
        // resolves to the top level — where `title` is documented.
        const source = ['+++', '[server]', 'title = "x"', '+++'].join('\n');
        const body = bodyOf(
            computeFrontmatterHover(source, { line: 2, character: 1 }),
        );
        expect(body).toContain('<title>');
    });

    it('skips blank and comment lines when resolving the block', () => {
        // The `meta:` ancestor sits several lines up, past a blank line and a
        // `#` comment — both must be skipped while walking up to it.
        const source = [
            '---',
            'meta:',
            '',
            '  # a comment',
            '  description: A summary',
            '---',
        ].join('\n');
        expect(
            bodyOf(computeFrontmatterHover(source, { line: 4, character: 6 })),
        ).toContain('<meta name="description">');
    });

    it('hovers the `charset` top-level key, rendering `<meta charset>`', () => {
        // Exercises the `<meta charset>` template branch via a real hover.
        const source = ['---', 'charset: utf-8', '---'].join('\n');
        const body = bodyOf(
            computeFrontmatterHover(source, { line: 1, character: 3 }),
        );
        expect(body).toContain('renders `<meta charset="〈value〉">`');
        expect(body).toContain('Inserts `<meta charset="〈value〉">`');
    });

    it('returns null on a value whose key is neither name nor http-equiv', () => {
        // `title: My Doc` — caret on the value. `title` has no value schema, so
        // no value hover is produced.
        const source = ['---', 'title: My Doc', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 1, character: 10 }),
        ).toBeNull();
    });

    it('returns null on an unknown key carrying a value, caret on the value', () => {
        // The key parses but is unrecognised, and its value matches no schema.
        const source = ['---', 'custom: somevalue', '---'].join('\n');
        expect(
            computeFrontmatterHover(source, { line: 1, character: 11 }),
        ).toBeNull();
    });

    it('skips equally-indented siblings when walking up to the block key', () => {
        // Walking up from `keywords` passes its sibling `description` (same
        // indent — not an ancestor) before reaching the `meta:` key.
        const source = [
            '---',
            'meta:',
            '  description: A',
            '  keywords: B',
            '---',
        ].join('\n');
        expect(
            bodyOf(computeFrontmatterHover(source, { line: 3, character: 4 })),
        ).toContain('<meta name="keywords">');
    });

    // The hover of a top-level key is followed by per-effect sections —
    // one per frontmatter-processing step the key takes part in — each
    // naming the `frontmatter: { … }` toggle that switches it off.
    describe('per-effect sections (top-level keys)', () => {
        it('hyphenated meta name shows quoted key in metadata example', () => {
            const source = ['---', 'color-scheme: dark', '---'].join('\n');
            const body = bodyOf(
                computeFrontmatterHover(source, {
                    line: 1,
                    character: 4,
                }),
            );
            // <svelte:head> insertion templated from `element`.
            expect(body).toContain(
                'Inserts `<meta name="color-scheme" content="〈value〉">`',
            );
            expect(body).toContain('`frontmatter: { head: false }`');
            // The metadata example quotes the non-identifier key.
            expect(body).toContain('Adds `"color-scheme": "〈value〉"`');
            expect(body).toContain('`frontmatter: { metadata: false }`');
        });

        it('structural `title` shows its explicit head effect', () => {
            const source = ['---', 'title: My Document', '---'].join('\n');
            const body = bodyOf(
                computeFrontmatterHover(source, {
                    line: 1,
                    character: 2,
                }),
            );
            expect(body).toContain('Inserts `<title>〈value〉</title>`');
            expect(body).toContain('Adds `title: "〈value〉"`');
        });

        it('`imports` has an imports section but no head section', () => {
            const source = ['---', 'imports:', '---'].join('\n');
            const body = bodyOf(
                computeFrontmatterHover(source, {
                    line: 1,
                    character: 3,
                }),
            );
            expect(body).toContain('`frontmatter: { imports: false }`');
            expect(body).toContain(
                "Adds an `import` statement to the page's `<script>`",
            );
            expect(body).not.toContain('`frontmatter: { head: false }`');
        });

        it('structured-value keys use the bare `〈value〉` placeholder', () => {
            const source = ['---', 'base:', '  href: /docs/', '---'].join('\n');
            // Caret on the top-level `base` key.
            const body = bodyOf(
                computeFrontmatterHover(source, {
                    line: 1,
                    character: 1,
                }),
            );
            expect(body).toContain('Adds `base: 〈value〉`');
        });

        it('keys inside `meta` get no per-effect sections', () => {
            const source = [
                '---',
                'meta:',
                '  description: A summary',
                '---',
            ].join('\n');
            const body = bodyOf(
                computeFrontmatterHover(source, { line: 2, character: 6 }),
            );
            expect(body).not.toContain('frontmatter: {');
            expect(body).not.toContain('Adds `');
        });

        it('value hovers get no per-effect sections', () => {
            const source = [
                '---',
                'meta:',
                '  - name: description',
                '---',
            ].join('\n');
            // Caret on the value `description`, not on a key.
            const body = bodyOf(
                computeFrontmatterHover(source, { line: 2, character: 14 }),
            );
            expect(body).not.toContain('frontmatter: {');
        });
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
        const source = ['---', 'meta:', '  - http-equiv: ', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 16,
        }).items.map((i) => i.label);
        expect(labels).toContain('content-security-policy');
    });

    it('still completes keys when the caret is before the `:` of a pair', () => {
        // The line is a full `title: x` pair, but the caret sits inside the
        // key (before the separator), so keys — not values — are offered.
        const source = ['---', 'title: x', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 1,
            character: 2,
        }).items.map((i) => i.label);
        expect(labels).toContain('title');
        expect(labels).toContain('meta');
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

    it('inside `meta`, suggests meta names but not top-level keys', () => {
        const source = ['---', 'meta:', '  desc', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 6,
        }).items.map((i) => i.label);
        expect(labels).toContain('description');
        expect(labels).toContain('viewport');
        // `title` belongs at the top level, not inside `meta`.
        expect(labels).not.toContain('title');
        expect(labels).not.toContain('base');
    });

    it('inside `base`, suggests base keys but not top-level keys', () => {
        const source = ['---', 'base:', '  t', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 3,
        }).items.map((i) => i.label);
        expect(labels).toContain('target');
        expect(labels).not.toContain('title');
    });

    it('at the top level, suggests structural keys and meta names', () => {
        const source = ['---', 't', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 1,
            character: 1,
        }).items.map((i) => i.label);
        expect(labels).toContain('title');
        expect(labels).toContain('meta');
        // A metadata name is also valid written as a top-level key.
        expect(labels).toContain('description');
    });

    it('inside a `link` item, suggests link attributes', () => {
        const source = ['---', 'link:', '  - a', '---'].join('\n');
        const labels = computeFrontmatterCompletion(source, {
            line: 2,
            character: 5,
        }).items.map((i) => i.label);
        expect(labels).toContain('rel');
        expect(labels).toContain('href');
        expect(labels).toContain('as');
        expect(labels).toContain('type');
        expect(labels).toContain('crossorigin');
        expect(labels).not.toContain('title');
    });
});
