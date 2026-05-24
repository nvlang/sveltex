// Unit tests for region computation (`src/core/regions.ts`): the split of a
// `.sveltex` document into a gap-free `Region[]`, the delegated/non-delegated
// classification, and resilience to malformed input.

import { describe, expect, it } from 'vitest';
import {
    computeRegions,
    isDelegated,
    verbatimBodyOffsets,
} from '../../src/core/regions.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';

const config = defaultConfigSnapshot();

/** Asserts that `regions` tile `[0, length)` gap-free and in order. */
function expectGapFree(
    regions: { sourceStart: number; sourceEnd: number }[],
    length: number,
): void {
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]?.sourceStart).toBe(0);
    expect(regions.at(-1)?.sourceEnd).toBe(length);
    for (let i = 1; i < regions.length; i++) {
        expect(regions[i]?.sourceStart).toBe(regions[i - 1]?.sourceEnd);
    }
}

describe('computeRegions — tiling invariant', () => {
    it('tiles a plain Markdown document with a single region', () => {
        const source = 'Just some **markdown** text.';
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
        expect(regions).toHaveLength(1);
        expect(regions[0]?.kind).toBe('markdown');
    });

    it('tiles a mixed document gap-free', () => {
        const source = [
            '# Title',
            '',
            'Paragraph with `inline code`.',
            '',
            '<script>',
            '  let x = 1;',
            '</script>',
            '',
            '$$E = mc^2$$',
            '',
            '<tex>\\draw (0,0) -- (1,1);</tex>',
        ].join('\n');
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
    });

    it('yields one empty Markdown region for an empty document', () => {
        const regions = computeRegions('', config);
        expect(regions).toEqual([
            { kind: 'markdown', sourceStart: 0, sourceEnd: 0 },
        ]);
    });
});

describe('computeRegions — classification', () => {
    it('classifies inline and display math as `math`', () => {
        const source = 'a $x$ b\n\n$$y$$\n';
        const regions = computeRegions(source, config);
        const mathRegions = regions.filter((r) => r.kind === 'math');
        expect(mathRegions.length).toBe(2);
    });

    it('classifies a `<script>` block as delegated `svelte`', () => {
        const source = '<script>\nlet n = 1;\n</script>\n';
        const regions = computeRegions(source, config);
        const scriptRegion = regions.find((r) => r.kind === 'svelte');
        expect(scriptRegion).toBeDefined();
    });

    it('classifies a configured verbatim tag as `verbatim`', () => {
        const source = 'before <tex>\\LaTeX</tex> after';
        const regions = computeRegions(source, config);
        const verbatim = regions.find((r) => r.kind === 'verbatim');
        expect(verbatim).toBeDefined();
        expect(
            source.slice(verbatim?.sourceStart, verbatim?.sourceEnd),
        ).toContain('<tex>');
    });

    it('detects the real `<tex>` block when `<tex>` also appears in prose', () => {
        // The inline-code `` `<tex>` `` must not anchor a verbatim match that
        // runs to the genuine block's `</tex>` and swallows it.
        const source =
            'Use the `<tex>` tag.\n\n<tex>\n\\draw (0,0);\n</tex>\n\nDone.\n';
        const regions = computeRegions(source, config);
        const verbatim = regions.filter((r) => r.kind === 'verbatim');
        expect(verbatim).toHaveLength(1);
        const slice = source.slice(
            verbatim[0]?.sourceStart,
            verbatim[0]?.sourceEnd,
        );
        expect(slice.startsWith('<tex>\n')).toBe(true);
        expect(slice.trimEnd().endsWith('</tex>')).toBe(true);
    });

    it('classifies a fenced code block as non-delegated `code`', () => {
        const source = 'text\n\n```js\nconst a = 1;\n```\n\nmore';
        const regions = computeRegions(source, config);
        const code = regions.find((r) => r.kind === 'code');
        expect(code).toBeDefined();
    });

    it('classifies a YAML frontmatter block as `frontmatter`', () => {
        const source = '---\ntitle: Hello\n---\n\nBody text.\n';
        const regions = computeRegions(source, config);
        const frontmatter = regions.find((r) => r.kind === 'frontmatter');
        expect(frontmatter).toBeDefined();
        expect(frontmatter?.sourceStart).toBe(0);
    });

    it('classifies a mustache tag as `mustacheTag`', () => {
        const source = '{#snippet foo()}';
        const regions = computeRegions(source, config);
        expect(regions.some((r) => r.kind === 'mustacheTag')).toBe(true);
    });
});

describe('isDelegated', () => {
    it('treats Markdown / Svelte / mustache tags as delegated', () => {
        expect(isDelegated('markdown')).toBe(true);
        expect(isDelegated('svelte')).toBe(true);
        expect(isDelegated('mustacheTag')).toBe(true);
    });

    it('treats code / math / verbatim / frontmatter as non-delegated', () => {
        expect(isDelegated('code')).toBe(false);
        expect(isDelegated('math')).toBe(false);
        expect(isDelegated('verbatim')).toBe(false);
        expect(isDelegated('frontmatter')).toBe(false);
    });
});

describe('computeRegions — resilience', () => {
    it('falls back to one Markdown region on unparseable input', () => {
        // An unterminated construct can make SvelTeX's parser throw; the
        // detector must degrade to a single delegated region, not crash.
        const source = '<script>\nlet broken = ';
        const regions = computeRegions(source, config);
        expectGapFree(regions, source.length);
    });

    it('catches a parser throw and returns one Markdown region', () => {
        // `{#if` (an unterminated mustache expression) makes SvelTeX's
        // `parseToMdast` throw; `computeRegions` must swallow it and degrade to
        // a single, whole-document `markdown` region (the `catch` path), not
        // bubble the exception up to the LSP loop.
        const source = '{#if';
        const regions = computeRegions(source, config);
        expect(regions).toEqual([
            { kind: 'markdown', sourceStart: 0, sourceEnd: source.length },
        ]);
    });

    it('skips the verbatim scan entirely when no verbatim tags configured', () => {
        // With an empty `verbatimTags`, `detectVerbatimRanges` returns early and
        // a `<tex>` is just plain Markdown — nothing is classified `verbatim`.
        const custom = { ...config, verbatimTags: [] };
        const source = 'text <tex>raw</tex> more';
        const regions = computeRegions(source, custom);
        expect(regions.some((r) => r.kind === 'verbatim')).toBe(false);
        expectGapFree(regions, source.length);
    });

    it('leaves a non-noop verbatim env untouched when noop tags are set', () => {
        // `splitNoopRanges` must pass through a `verbatim` range whose tag is
        // not a noop tag: `<tex>` stays a single `verbatim` region even though
        // `MyNoop` is registered as a noop env.
        const custom = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'MyNoop'],
            noopTags: ['MyNoop'],
        };
        const source = '<tex>\\LaTeX</tex>';
        const regions = computeRegions(source, custom);
        const verbatim = regions.filter((r) => r.kind === 'verbatim');
        expect(verbatim).toHaveLength(1);
        expect(
            source.slice(verbatim[0]?.sourceStart, verbatim[0]?.sourceEnd),
        ).toBe('<tex>\\LaTeX</tex>');
    });

    it('passes non-verbatim ranges through the noop splitter unchanged', () => {
        // `splitNoopRanges` only touches `verbatim` ranges; a `math` range must
        // survive untouched even when noop tags are configured.
        const custom = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'MyNoop'],
            noopTags: ['MyNoop'],
        };
        const source = 'a $x^2$ b';
        const regions = computeRegions(source, custom);
        const math = regions.filter((r) => r.kind === 'math');
        expect(math).toHaveLength(1);
        expect(
            source.slice(math[0]?.sourceStart, math[0]?.sourceEnd),
        ).toBe('$x^2$');
    });

    it('keeps a self-closing noop env fully verbatim (no body to delegate)', () => {
        // A body-less / self-closing noop env (`<MyNoop/>`) has no inner span,
        // so `verbatimBodyOffsets` returns `null` and `splitNoopRanges` leaves
        // it a single `verbatim` region — there is nothing to hand to Svelte.
        const custom = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'MyNoop'],
            noopTags: ['MyNoop'],
        };
        const source = 'before <MyNoop/> after';
        const regions = computeRegions(source, custom);
        const verbatim = regions.filter((r) => r.kind === 'verbatim');
        expect(verbatim).toHaveLength(1);
        expect(regions.some((r) => r.kind === 'svelte')).toBe(false);
    });

    it('respects custom verbatim tags from the config', () => {
        const custom = { ...config, verbatimTags: ['myverb'] };
        const source = 'x <myverb>raw</myverb> y';
        const regions = computeRegions(source, custom);
        expect(regions.some((r) => r.kind === 'verbatim')).toBe(true);
    });

    it('delegates a noop env body but keeps its wrapper tags non-delegated', () => {
        // `type: 'noop'` envs pass their BODY to Svelte unchanged, so the body
        // must be a `DELEGATED_KIND` (`svelte`) and reach `svelte-language-
        // server`. But the wrapper tags are SvelTeX constructs (rewritten at
        // build time via the `component` option), so they must stay `verbatim`
        // — blanked out of the virtual `.svelte` doc — otherwise svelte-LSP
        // reports the literal `<MyNoop>` as an undefined component.
        const custom = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'MyNoop'],
            noopTags: ['MyNoop'],
        };
        const source = 'before <MyNoop><MyComponent /></MyNoop> after';
        const regions = computeRegions(source, custom);
        const regionAt = (offset: number) =>
            regions.find(
                (r) => r.sourceStart <= offset && offset < r.sourceEnd,
            );

        // The body is delegated as `svelte`.
        const body = regions.find((r) =>
            source.slice(r.sourceStart, r.sourceEnd).includes('<MyComponent'),
        );
        expect(body?.kind).toBe('svelte');
        expect(isDelegated(body?.kind ?? 'verbatim')).toBe(true);

        // The opening and closing wrapper tags are NOT delegated.
        expect(regionAt(source.indexOf('<MyNoop>'))?.kind).toBe('verbatim');
        expect(regionAt(source.indexOf('</MyNoop>'))?.kind).toBe('verbatim');
    });

    it('keeps escape verbatim ranges as `verbatim` (NOT delegated)', () => {
        // The complement of the test above: `escape` envs must stay
        // `verbatim`-kinded so their body IS blanked from the virtual
        // .svelte doc (Svelte would otherwise try to parse literal
        // text as markup).
        const custom = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'MyEscape'],
            escapeTags: [...config.escapeTags, 'MyEscape'],
        };
        const source = '<MyEscape>{not a mustache}</MyEscape>';
        const regions = computeRegions(source, custom);
        const matched = regions.find(
            (r) =>
                source
                    .slice(r.sourceStart, r.sourceEnd)
                    .includes('not a mustache'),
        );
        expect(matched?.kind).toBe('verbatim');
    });
});

describe('verbatimBodyOffsets', () => {
    it('returns the inner span of a normal `<tag>body</tag>`', () => {
        const source = '<tex>body</tex>';
        expect(verbatimBodyOffsets(source, 0, source.length)).toEqual([
            '<tex>'.length,
            source.length - '</tex>'.length,
        ]);
    });

    it('offsets the inner span by the region start in the document', () => {
        const source = 'xx<tex>L</tex>';
        const start = 2;
        expect(verbatimBodyOffsets(source, start, source.length)).toEqual([
            start + '<tex>'.length,
            source.length - '</tex>'.length,
        ]);
    });

    it('returns null for a self-closing `<tag/>` (no body)', () => {
        const source = '<tex/>';
        expect(verbatimBodyOffsets(source, 0, source.length)).toBeNull();
    });

    it('returns null for a self-closing `<tag … />` with attributes', () => {
        const source = '<tex foo="bar" />';
        expect(verbatimBodyOffsets(source, 0, source.length)).toBeNull();
    });

    it('returns null when there is no recognisable opening tag', () => {
        // No leading `<tag…>` opener -> the `!open` guard returns null.
        const source = 'plain text</tex>';
        expect(verbatimBodyOffsets(source, 0, source.length)).toBeNull();
    });

    it('returns null when there is no closing tag', () => {
        // Opener but no trailing `</tag…>` -> the `!close` guard returns null.
        const source = '<tex>body';
        expect(verbatimBodyOffsets(source, 0, source.length)).toBeNull();
    });

    it('returns null when the open and close tags leave no inner span', () => {
        // `innerEnd <= innerStart`: the tags abut, so there is no body between.
        const source = '<tex></tex>';
        expect(verbatimBodyOffsets(source, 0, source.length)).toBeNull();
    });
});
