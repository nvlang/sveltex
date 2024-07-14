import { adjustHtmlSpacing } from '$utils/markdown.js';
import { describe, it, expect } from 'vitest';

describe('adjustHtmlSpacing', () => {
    it.each([
        ['<span>\n\ntext</span>', '<span>text</span>'],
        ['<span>\n\n\ntext</span>', '<span>text</span>'],
        ['<div>\n\ntext</div>', /<div>\n{2,}text\n{2,}<\/div>/],
        ['<div>\n\n\ntext</div>', /<div>\n{2,}text\n{2,}<\/div>/],
        ['<div>\ntext</div>', '<div>text</div>', () => true],
        ['<div>\ntext</div>', /<div>\n{2,}text\n{2,}<\/div>/, () => false],
        ['<div>\ntext</div>', /<div>\n{2,}text\n{2,}<\/div>/, () => false],
        ['<span>text\n\n</span>', '<span>text</span>'],
        [
            '<div>\n<div>\n\ntest\n</div>\n</div>',
            /<div><div>\n{2,}test\n{2,}<\/div><\/div>/,
        ],
        [
            '<div>\n<div>\n*test*\n</div>\n</div>\n\n<div>\n<div>\n*test*\n</div>\n</div>',
            '<div><div>*test*</div></div>\n\n<div><div>*test*</div></div>',
        ],
    ] as [string, string, ((str: string) => boolean)?][])(
        '%o → %o',
        { timeout: 1e8 },
        (input, expected, prefersInline) => {
            expect(
                adjustHtmlSpacing(input, prefersInline ?? (() => true), []),
            ).toMatch(expected);
        },
    );
});
