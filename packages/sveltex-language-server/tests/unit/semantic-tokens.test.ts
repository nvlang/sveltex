// Unit tests for the scoped semantic-tokens provider
// (`src/core/semantic-tokens.ts`): flat `string` token per body line of a
// CUSTOM escape- or code-typed verbatim region. Nothing else gets a
// token — tex / noop / the standard hardcoded tags are all handled
// elsewhere (TM regen in VS Code, native tree-sitter highlights in Zed,
// or `svelte` region delegation for noop).

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

/** Tokens emitted for `source` under the given config. */
function tokensFor(
    source: string,
    config: SveltexConfigSnapshot = defaultConfig,
): { data: number[]; regions: Region[] } {
    const regions = computeRegions(source, config);
    const tokens = computeSemanticTokens(
        source,
        regions,
        config.escapeTags,
        config.codeTags,
    );
    return { data: [...tokens.data], regions };
}

/** Decodes the LSP delta-encoded data array into absolute tokens. */
function decode(data: number[]): {
    line: number;
    char: number;
    length: number;
    type: number;
}[] {
    const out = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < data.length; i += 5) {
        const deltaLine = data[i] ?? 0;
        const deltaChar = data[i + 1] ?? 0;
        const length = data[i + 2] ?? 0;
        const type = data[i + 3] ?? 0;
        if (deltaLine === 0) {
            char += deltaChar;
        } else {
            line += deltaLine;
            char = deltaChar;
        }
        out.push({ line, char, length, type });
    }
    return out;
}

const TYPE_STRING = SEMANTIC_TOKEN_TYPES.indexOf('string');

describe('legend', () => {
    it('declares a single `string` token type', () => {
        expect(SEMANTIC_TOKEN_TYPES).toEqual(['string']);
    });

    it('declares an empty modifier vocabulary', () => {
        expect(Array.isArray(SEMANTIC_TOKEN_MODIFIERS)).toBe(true);
        expect(SEMANTIC_TOKEN_MODIFIERS.length).toBe(0);
    });
});

describe('emits nothing for cases handled elsewhere', () => {
    it('returns an empty stream for an empty document', () => {
        expect(tokensFor('').data).toEqual([]);
    });

    it('returns an empty stream for plain markdown', () => {
        expect(tokensFor('# Hello\n\nProse.').data).toEqual([]);
    });

    it('emits nothing for standard `<verbatim>` (tree-sitter handles it)', () => {
        // `verbatim` IS in the default escape list, but it's also in the
        // hardcoded NATIVELY_HIGHLIGHTED_TAGS set — the editor grammar
        // colours it natively, so we skip it.
        expect(tokensFor('<verbatim>\nlit\n</verbatim>').data).toEqual([]);
    });

    it('emits nothing for `<verb>`', () => {
        expect(tokensFor('<verb>x</verb>').data).toEqual([]);
    });

    it('emits nothing for standard `<tex>` / `<latex>` / `<tikz>`', () => {
        expect(tokensFor('<tex>\\LaTeX</tex>').data).toEqual([]);
        expect(tokensFor('<latex>\\alpha</latex>').data).toEqual([]);
        expect(tokensFor('<tikz>\\node {x};</tikz>').data).toEqual([]);
    });

    it('emits nothing for a `tex`-typed custom tag (Zed can\'t paint LaTeX per-tag)', () => {
        const cfg: SveltexConfigSnapshot = {
            ...defaultConfig,
            verbatimTags: [...defaultConfig.verbatimTags, 'MyTex'],
            latexTags: [...defaultConfig.latexTags, 'MyTex'],
        };
        expect(tokensFor('<MyTex>\\alpha</MyTex>', cfg).data).toEqual([]);
    });

    it('emits nothing for a `noop`-typed custom tag (relabelled to `svelte`)', () => {
        // The region's kind is `svelte` (delegated to svelte-LSP), not
        // `verbatim` — so the encoder's `region.kind === 'verbatim'`
        // gate naturally skips it.
        const cfg: SveltexConfigSnapshot = {
            ...defaultConfig,
            verbatimTags: [...defaultConfig.verbatimTags, 'MyNoop'],
            noopTags: ['MyNoop'],
        };
        expect(tokensFor('<MyNoop><C /></MyNoop>', cfg).data).toEqual([]);
    });

    it('emits nothing for a self-closing custom tag', () => {
        const cfg: SveltexConfigSnapshot = {
            ...defaultConfig,
            verbatimTags: [...defaultConfig.verbatimTags, 'MyEscape'],
            escapeTags: [...defaultConfig.escapeTags, 'MyEscape'],
        };
        expect(tokensFor('a <MyEscape /> b', cfg).data).toEqual([]);
    });
});

describe('emits flat `string` tokens for custom escape/code envs', () => {
    function configWithCustom(): SveltexConfigSnapshot {
        return {
            ...defaultConfig,
            verbatimTags: [
                ...defaultConfig.verbatimTags,
                'MyEscape',
                'MyCode',
            ],
            escapeTags: [...defaultConfig.escapeTags, 'MyEscape'],
            codeTags: ['MyCode'],
        };
    }

    it('emits a single-line token for `<MyEscape>body</MyEscape>`', () => {
        const tokens = decode(
            tokensFor('<MyEscape>secret</MyEscape>', configWithCustom()).data,
        );
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toEqual({
            line: 0,
            char: '<MyEscape>'.length,
            length: 'secret'.length,
            type: TYPE_STRING,
        });
    });

    it('emits one token per line for a multi-line `<MyEscape>` body', () => {
        const source = '<MyEscape>\nline 1\nline 2\n</MyEscape>';
        const tokens = decode(tokensFor(source, configWithCustom()).data);
        expect(tokens).toHaveLength(2);
        expect(tokens[0]?.length).toBe('line 1'.length);
        expect(tokens[1]?.length).toBe('line 2'.length);
    });

    it('emits tokens for `<MyCode>` the same way as `<MyEscape>`', () => {
        const source = '<MyCode>print(1)</MyCode>';
        const tokens = decode(tokensFor(source, configWithCustom()).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe('print(1)'.length);
    });

    it('does not include the trailing newline in a token', () => {
        const source = '<MyEscape>\nabc\n</MyEscape>';
        const tokens = decode(tokensFor(source, configWithCustom()).data);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.length).toBe('abc'.length);
    });

    it('treats tag names case-insensitively', () => {
        const cfg = configWithCustom();
        // The user can declare the tag in any case in the config; the
        // matcher must accept any case in the source too.
        expect(
            tokensFor('<MyEscape>x</MyEscape>', cfg).data.length,
        ).toBeGreaterThan(0);
        expect(
            tokensFor('<myescape>x</myescape>', cfg).data.length,
        ).toBeGreaterThan(0);
    });
});

describe('delta-encoding invariants', () => {
    function cfg(): SveltexConfigSnapshot {
        return {
            ...defaultConfig,
            verbatimTags: [...defaultConfig.verbatimTags, 'MyEscape', 'MyCode'],
            escapeTags: [...defaultConfig.escapeTags, 'MyEscape'],
            codeTags: ['MyCode'],
        };
    }

    it('produces a multiple-of-5 data length', () => {
        const source = [
            '<MyEscape>',
            'one',
            'two',
            '</MyEscape>',
            '',
            '<MyCode>',
            'three',
            '</MyCode>',
        ].join('\n');
        const { data } = tokensFor(source, cfg());
        expect(data.length % 5).toBe(0);
        expect(data.length).toBeGreaterThan(0);
    });

    it('keeps tokens in non-decreasing line order', () => {
        const source = [
            '<MyEscape>',
            'a',
            '</MyEscape>',
            '',
            '<MyCode>',
            'b',
            'c',
            '</MyCode>',
        ].join('\n');
        const tokens = decode(tokensFor(source, cfg()).data);
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
