// Unit tests for the native semantic-tokens provider
// (`src/core/semantic-tokens.ts`): the per-line-split delta-encoded token
// stream emitted for verbatim regions — including user-configured tags that
// the editor-side grammars (TextMate, tree-sitter) don't know about.

import { describe, expect, it } from 'vitest';
import {
    SEMANTIC_TOKEN_MODIFIERS,
    SEMANTIC_TOKEN_TYPES,
    computeSemanticTokens,
} from '../../src/core/semantic-tokens.js';
import { computeRegions, type Region } from '../../src/core/regions.js';
import {
    defaultConfigSnapshot,
    type SveltexConfigSnapshot,
} from '../../src/core/config.js';

const defaultConfig = defaultConfigSnapshot();

/**
 * Returns `regions` together with `data` so each test can assert against both
 * sides at once without re-running `computeRegions` everywhere.
 */
function tokensFor(
    source: string,
    config: SveltexConfigSnapshot = defaultConfig,
): { data: number[]; regions: Region[] } {
    const regions = computeRegions(source, config);
    const tokens = computeSemanticTokens(source, regions);
    return { data: [...tokens.data], regions };
}

/**
 * Decodes the LSP delta-encoded data array back into absolute
 * `{ line, char, length, type, modifiers }` tokens. Used by the tests to
 * assert against the wire format without re-implementing it.
 */
function decode(data: number[]): {
    line: number;
    char: number;
    length: number;
    type: number;
    modifiers: number;
}[] {
    const out = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i] ?? 0;
        const deltaChar = data[i + 1] ?? 0;
        const length = data[i + 2] ?? 0;
        const type = data[i + 3] ?? 0;
        const modifiers = data[i + 4] ?? 0;
        if (deltaLine === 0) {
            char += deltaChar;
        } else {
            line += deltaLine;
            char = deltaChar;
        }
        out.push({ line, char, length, type, modifiers });
    }
    return out;
}

describe('legend', () => {
    it('declares a non-empty token-type vocabulary', () => {
        expect(SEMANTIC_TOKEN_TYPES.length).toBeGreaterThan(0);
        expect(SEMANTIC_TOKEN_TYPES).toContain('string');
    });

    it('declares a (possibly empty) modifier vocabulary', () => {
        // No `toBeArray` in vitest — array-ness via Array.isArray is what
        // matters; `length` is the only thing the encoder reads.
        expect(Array.isArray(SEMANTIC_TOKEN_MODIFIERS)).toBe(true);
    });
});

describe('emits nothing when there is nothing to emit', () => {
    it('returns an empty stream for an empty document', () => {
        expect(tokensFor('').data).toEqual([]);
    });

    it('returns an empty stream for plain markdown', () => {
        expect(tokensFor('# Hello\n\nJust prose.').data).toEqual([]);
    });

    it('returns an empty stream for a document with only math', () => {
        // Math regions are deliberately NOT covered — the editor grammar
        // handles them.
        expect(tokensFor('Inline $a^2$ and display\n\n$$x = 1$$').data).toEqual(
            [],
        );
    });

    it('returns an empty stream for a self-closing verbatim tag', () => {
        // `<tex />` has no body to colour.
        expect(tokensFor('Before <tex /> after').data).toEqual([]);
    });
});

describe('emits one token per body line of a verbatim region', () => {
    it('covers a single-line `<tex>` body', () => {
        const source = '<tex>\\LaTeX</tex>';
        const tokens = decode(tokensFor(source).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toEqual({
            line: 0,
            char: 5,
            length: '\\LaTeX'.length,
            type: SEMANTIC_TOKEN_TYPES.indexOf('string'),
            modifiers: 0,
        });
    });

    it('splits a multi-line `<tex>` body into one token per line', () => {
        const source = ['<tex>', '\\node {x};', '\\node {y};', '</tex>'].join(
            '\n',
        );
        const tokens = decode(tokensFor(source).data);
        // Two body lines.
        expect(tokens).toHaveLength(2);
        expect(tokens[0]?.line).toBe(1);
        expect(tokens[0]?.char).toBe(0);
        expect(tokens[0]?.length).toBe('\\node {x};'.length);
        expect(tokens[1]?.line).toBe(2);
        expect(tokens[1]?.char).toBe(0);
        expect(tokens[1]?.length).toBe('\\node {y};'.length);
    });

    it('does not include the trailing newline in a token', () => {
        const source = '<tex>\nabc\n</tex>';
        const tokens = decode(tokensFor(source).data);
        // One token on line 1, covering exactly "abc" (no newline).
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe(3);
    });

    it('emits a token at the right column for a body sharing the line with the open tag', () => {
        // `<tex>body</tex>` — body starts at column 5.
        const source = 'leading <tex>body</tex> trailing';
        const tokens = decode(tokensFor(source).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toEqual({
            line: 0,
            char: '<leading <tex>'.length - 1, // 13
            length: 'body'.length,
            type: SEMANTIC_TOKEN_TYPES.indexOf('string'),
            modifiers: 0,
        });
    });

    it('covers a `<verbatim>` body the same way as `<tex>`', () => {
        const source = '<verbatim>\nliteral\n</verbatim>';
        const tokens = decode(tokensFor(source).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe('literal'.length);
    });
});

describe('user-configured custom tags', () => {
    /**
     * Builds a config snapshot with `MyVerb` (escape-type) and `MyTex`
     * (latex-type) added to the verbatim tag list, simulating a user's
     * `sveltex.config.js`.
     */
    function configWithCustomTags(): SveltexConfigSnapshot {
        return {
            ...defaultConfig,
            verbatimTags: [...defaultConfig.verbatimTags, 'MyVerb', 'MyTex'],
            latexTags: [...defaultConfig.latexTags, 'MyTex'],
        };
    }

    it('emits tokens for `<MyVerb>` once registered in the config', () => {
        const source = 'Before <MyVerb>secret</MyVerb> after';
        const cfg = configWithCustomTags();
        // Sanity check: regions classify the custom tag as verbatim.
        const regions = computeRegions(source, cfg);
        expect(regions.some((r) => r.kind === 'verbatim')).toBe(true);
        // And the encoder picks it up.
        const tokens = decode(computeSemanticTokens(source, regions).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe('secret'.length);
    });

    it('emits tokens for `<MyTex>` once registered as a latex tag', () => {
        const source = '<MyTex>\n\\alpha\n</MyTex>';
        const cfg = configWithCustomTags();
        const regions = computeRegions(source, cfg);
        const tokens = decode(computeSemanticTokens(source, regions).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe('\\alpha'.length);
    });

    it('emits nothing for an unregistered custom tag', () => {
        // `<Foo>` is not in any config; falls through as plain markdown / HTML.
        const source = 'Before <Foo>nothing here</Foo> after';
        expect(tokensFor(source).data).toEqual([]);
    });
});

describe('delta-encoding invariants', () => {
    it('produces a multiple-of-5 data length', () => {
        const source = [
            '<tex>',
            'one',
            'two',
            'three',
            '</tex>',
            '',
            '<verbatim>',
            'four',
            '</verbatim>',
        ].join('\n');
        const { data } = tokensFor(source);
        expect(data.length % 5).toBe(0);
        expect(data.length).toBeGreaterThan(0);
    });

    it('keeps tokens in non-decreasing line order', () => {
        const source = [
            '<tex>',
            'a',
            '</tex>',
            '',
            '<verbatim>',
            'b',
            'c',
            '</verbatim>',
        ].join('\n');
        const tokens = decode(tokensFor(source).data);
        for (let i = 1; i < tokens.length; i++) {
            const prev = tokens[i - 1];
            const curr = tokens[i];
            if (!prev || !curr) throw new Error('decode invariant broken');
            // Either strictly later line, or same line later column.
            expect(
                curr.line > prev.line ||
                    (curr.line === prev.line && curr.char > prev.char),
            ).toBe(true);
        }
    });
});
