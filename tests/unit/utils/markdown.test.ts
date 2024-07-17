import { adjustHtmlSpacing } from '$utils/markdown.js';
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
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/,
        ],
        [
            '<divABC123>\n\n\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            '<divABC123>text</divABC123>',
            () => true,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/,
            () => false,
        ],
        [
            '<divABC123>\ntext</divABC123>',
            /<divABC123>\n{2,}text\n{2,}<\/divABC123>/,
            () => false,
        ],
        ['<spanABC123>text\n\n</spanABC123>', '<spanABC123>text</spanABC123>'],
        [
            '<divABC123>\n<divABC123>\n\ntest\n</divABC123>\n</divABC123>',
            /<divABC123>\n{2,}<divABC123>\n{2,}test\n{2,}<\/divABC123>\n{2,}<\/divABC123>/,
        ],
        [
            '<divABC123>\n<divABC123>\ntest\n</divABC123>\n</divABC123>\n\n<divABC123>\n<divABC123>\ntest\n</divABC123>\n</divABC123>',
            /<divABC123>\n{2,}<divABC123>test<\/divABC123>\n{2,}<\/divABC123>\n{2,}<divABC123>\n{2,}<divABC123>test<\/divABC123>\n{2,}<\/divABC123>/,
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
