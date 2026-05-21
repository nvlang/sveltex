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

/** Resolves `regions` and `data` for `source` under the given config. */
async function tokensFor(
    source: string,
    config: SveltexConfigSnapshot = defaultConfig,
): Promise<{ data: number[]; regions: Region[] }> {
    const regions = computeRegions(source, config);
    const tokens = await computeSemanticTokens(source, regions, config.latexTags);
    return { data: [...tokens.data], regions };
}

/**
 * Decodes the LSP delta-encoded data array back into absolute
 * `{ line, char, length, type, modifiers }` tokens.
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

const typeIndex = (name: string): number => SEMANTIC_TOKEN_TYPES.indexOf(name as never);

/**
 * Builds a config snapshot that registers `MyTex` (latex-type) and
 * `MyVerb` (escape-type) so the LaTeX tokenisation path and the flat-
 * string path both get exercised against user-configured tags.
 */
function configWithCustomTags(): SveltexConfigSnapshot {
    return {
        ...defaultConfig,
        verbatimTags: [...defaultConfig.verbatimTags, 'MyTex', 'MyVerb'],
        latexTags: [...defaultConfig.latexTags, 'MyTex'],
    };
}

describe('legend', () => {
    it('declares a non-empty token-type vocabulary', () => {
        expect(SEMANTIC_TOKEN_TYPES.length).toBeGreaterThan(0);
        // Both the LaTeX-aware path (`comment`/`function`) and the
        // flat-string fallback path (`string`) need their advertised
        // entries in the legend or the wire encoding refers to a
        // non-existent type.
        expect(SEMANTIC_TOKEN_TYPES).toContain('string');
        expect(SEMANTIC_TOKEN_TYPES).toContain('comment');
        expect(SEMANTIC_TOKEN_TYPES).toContain('function');
    });

    it('declares a (possibly empty) modifier vocabulary', () => {
        expect(Array.isArray(SEMANTIC_TOKEN_MODIFIERS)).toBe(true);
    });
});

describe('emits nothing when there is nothing to emit', () => {
    it('returns an empty stream for an empty document', async () => {
        expect((await tokensFor('')).data).toEqual([]);
    });

    it('returns an empty stream for plain markdown', async () => {
        expect((await tokensFor('# Hello\n\nJust prose.')).data).toEqual([]);
    });

    it('returns an empty stream for a document with only math', async () => {
        expect(
            (await tokensFor('Inline $a^2$ and display\n\n$$x = 1$$')).data,
        ).toEqual([]);
    });

    it('returns an empty stream for a self-closing verbatim tag', async () => {
        expect((await tokensFor('Before <tex /> after')).data).toEqual([]);
    });
});

describe('skips standard verbatim tags handled by editor grammars', () => {
    // Semantic tokens REPLACE whatever colour the static grammar would
    // give a range. Emitting tokens for `<tex>` would clobber the editor's
    // LaTeX / fenced-code colouring with something coarser; skip them.

    it('emits nothing for `<tex>`', async () => {
        expect((await tokensFor('<tex>\\LaTeX</tex>')).data).toEqual([]);
    });

    it('emits nothing for a multi-line `<tex>` body', async () => {
        const source = ['<tex>', '\\node {x};', '\\node {y};', '</tex>'].join(
            '\n',
        );
        expect((await tokensFor(source)).data).toEqual([]);
    });

    it('emits nothing for `<latex>` / `<tikz>`', async () => {
        expect((await tokensFor('<latex>\\alpha</latex>')).data).toEqual([]);
        expect((await tokensFor('<tikz>\\node {x};</tikz>')).data).toEqual([]);
    });

    it('emits nothing for `<verbatim>` / `<verb>`', async () => {
        expect(
            (await tokensFor('<verbatim>\nliteral\n</verbatim>')).data,
        ).toEqual([]);
        expect((await tokensFor('<verb>raw text</verb>')).data).toEqual([]);
    });

    it('treats the tag name case-insensitively', async () => {
        expect((await tokensFor('<TeX>\\alpha</TeX>')).data).toEqual([]);
        expect((await tokensFor('<Verbatim>raw</Verbatim>')).data).toEqual([]);
    });
});

describe('LaTeX-aware tokenisation for custom latex tags', () => {
    // The body of a `<MyTex>` is tokenised through the vendored
    // `text.tex.latex` TextMate grammar. We assert against the LSP token
    // *types* (`comment`, `function`, …) rather than the byte-exact
    // ranges — the grammar is upstream and may emit slightly different
    // boundaries (e.g. with or without the leading `\` in a command) on a
    // future refresh, but the types it picks for the canonical pieces are
    // stable.

    it('emits a `comment` token for `% comment` lines', async () => {
        const source = '<MyTex>\n% just a comment\n</MyTex>';
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        const commentTokens = tokens.filter((t) => t.type === typeIndex('comment'));
        expect(commentTokens.length).toBeGreaterThan(0);
    });

    it('emits a `function` token for `\\command`', async () => {
        const source = '<MyTex>\n\\draw (0,0);\n</MyTex>';
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        const functionTokens = tokens.filter(
            (t) => t.type === typeIndex('function'),
        );
        expect(functionTokens.length).toBeGreaterThan(0);
    });

    it('emits multiple token types across a tikzpicture body', async () => {
        const source = [
            '<MyTex>',
            '% a comment',
            '\\begin{tikzpicture}',
            '  \\draw[->] (0, 0) -- (2, 1);',
            '\\end{tikzpicture}',
            '</MyTex>',
        ].join('\n');
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        const seenTypes = new Set(tokens.map((t) => t.type));
        // At least `comment` and `function` should appear — the rest
        // (variable / operator / number) are nice-to-haves and depend on
        // the upstream grammar's exact scope assignments.
        expect(seenTypes.has(typeIndex('comment'))).toBe(true);
        expect(seenTypes.has(typeIndex('function'))).toBe(true);
    });

    it('emits NO `string` token inside a LaTeX body', async () => {
        // The flat-string fallback only runs for non-latex verbatim. A
        // LaTeX body's un-tokenised stretches (whitespace, punctuation)
        // should be left bare so the editor's static grammar can colour
        // them — not painted `string`.
        const source = '<MyTex>\n  some text  \n</MyTex>';
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        const stringTokens = tokens.filter((t) => t.type === typeIndex('string'));
        expect(stringTokens.length).toBe(0);
    });
});

describe('non-latex custom verbatim falls back to flat `string`', () => {
    it('paints `<MyVerb>` body with `string` tokens', async () => {
        const source = '<MyVerb>\nliteral content\n</MyVerb>';
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        expect(tokens.length).toBeGreaterThan(0);
        // Every token should be the same `string` type — no LaTeX
        // tokenisation runs on non-latex tags.
        for (const t of tokens) {
            expect(t.type).toBe(typeIndex('string'));
        }
    });

    it('emits nothing for an unregistered custom tag', async () => {
        const source = 'Before <Foo>nothing here</Foo> after';
        expect((await tokensFor(source)).data).toEqual([]);
    });
});

describe('delta-encoding invariants', () => {
    it('produces a multiple-of-5 data length', async () => {
        const source = [
            '<MyTex>',
            '\\begin{tikzpicture}',
            '\\end{tikzpicture}',
            '</MyTex>',
            '',
            '<MyVerb>',
            'literal',
            '</MyVerb>',
        ].join('\n');
        const { data } = await tokensFor(source, configWithCustomTags());
        expect(data.length % 5).toBe(0);
        expect(data.length).toBeGreaterThan(0);
    });

    it('keeps tokens in non-decreasing line order', async () => {
        const source = [
            '<MyTex>',
            '\\draw (a)',
            '\\draw (b)',
            '</MyTex>',
            '',
            '<MyVerb>',
            'b',
            'c',
            '</MyVerb>',
        ].join('\n');
        const tokens = decode(
            (await tokensFor(source, configWithCustomTags())).data,
        );
        for (let i = 1; i < tokens.length; i++) {
            const prev = tokens[i - 1];
            const curr = tokens[i];
            if (!prev || !curr) throw new Error('decode invariant broken');
            expect(
                curr.line > prev.line ||
                    (curr.line === prev.line && curr.char > prev.char),
            ).toBe(true);
        }
    });
});
