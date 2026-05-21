import { adjustHtmlSpacing, isImported } from '../../../src/utils/markdown.js';
import { describe, it, expect } from 'vitest';

describe('adjustHtmlSpacing', () => {
    it.each([
        ['<spanABC123>\n\ntext</spanABC123>', '<spanABC123>text</spanABC123>'],
        [
            '<spanABC123>\n\n\ntext</spanABC123>',
            '<spanABC123>text</spanABC123>',
        ],
        [
            '<divABC123>\n\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/u,
        ],
        [
            '<divABC123>\n\n\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/u,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            '<divABC123>text</divABC123>',
            () => true,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/u,
            () => false,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/u,
            () => false,
        ],
        ['<spanABC123>text\n\n</spanABC123>', '<spanABC123>text</spanABC123>'],
        [
            '<divABC123>\n<divABC123>\n\ntest\n</divABC123>\n</divABC123>',
            /<divABC123>\n{2,}<divABC123>\n{2,}test\n{2,}<\/divABC123>\n{2,}<\/divABC123>/u,
        ],
        [
            '<divABC123>\n<divABC123>\ntest\n</divABC123>\n</divABC123>\n\n<divABC123>\n<divABC123>\ntest\n</divABC123>\n</divABC123>',
            /<divABC123>\n{2,}<divABC123>test<\/divABC123>\n{2,}<\/divABC123>\n{2,}<divABC123>\n{2,}<divABC123>test<\/divABC123>\n{2,}<\/divABC123>/u,
        ],
    ] as [string, string, ((str: string) => boolean)?][])(
        '%o → %o',
        { timeout: 1e8 },
        (input, expected, prefersInline) => {
            expect(
                adjustHtmlSpacing(
                    input,
                    prefersInline ?? (() => true),
                    [],
                    'ABC123',
                ),
            ).toMatch(expected);
        },
    );
});

describe('adjustHtmlSpacing with component info', () => {
    it("uses a component's `prefersInline: true` over the prefersInline arg", () => {
        // `prefersInline` arg says `false`, but the matching component
        // overrides it to `true`, so the single-newline content is collapsed
        // into an inline element.
        expect(
            adjustHtmlSpacing(
                '<ExampleID>\ntext</ExampleID>',
                () => false,
                [{ name: 'Example', prefersInline: true }],
                'ID',
            ),
        ).toBe('<ExampleID>text</ExampleID>');
    });

    it("uses a component's `prefersInline: false` over the prefersInline arg", () => {
        // `prefersInline` arg says `true`, but the matching component
        // overrides it to `false`, so the content is padded for paragraph
        // wrapping.
        expect(
            adjustHtmlSpacing(
                '<ExampleID>\ntext</ExampleID>',
                () => true,
                [{ name: 'Example', prefersInline: false }],
                'ID',
            ),
        ).toMatch(/<ExampleID>\n{2,}text\n{2,}<\/ExampleID>/u);
    });

    it('falls back to the prefersInline arg when a component has no `prefersInline`', () => {
        // The matching component exists but leaves `prefersInline` undefined,
        // so the `prefersInline` argument (`true`) is used.
        expect(
            adjustHtmlSpacing(
                '<ExampleID>\ntext</ExampleID>',
                () => true,
                [{ name: 'Example', type: 'all' }],
                'ID',
            ),
        ).toBe('<ExampleID>text</ExampleID>');
    });
});

describe('isImported', () => {
    it.each([
        [
            "// something\n    import Example from '../../../src/lib/components/Example.svelte';\nconst title = 'Something';\n",
            { name: 'Example', importPath: '$lib/components/Example.svelte' },
            true,
        ],
    ])(
        'should return true if the module is imported',
        (script, componentInfo, expected) => {
            expect(isImported(script, componentInfo)).toEqual(expected);
        },
    );
});
