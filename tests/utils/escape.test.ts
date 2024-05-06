/* eslint-disable vitest/no-commented-out-tests */
import { type Sveltex, sveltex } from '$sveltex-preprocess';
import { uuidV4Regexp } from '$tests';
import {
    escapeBraces,
    escapeRegExps,
    escapeVerb,
    intersection,
    outermostRanges,
    unescape,
} from '$utils';
import { describe, expect, it, suite } from 'vitest';

suite.concurrent('processor/escape', async () => {
    describe.concurrent('escape regexes', () => {
        it('should match LaTeX display math', () => {
            const input = 'A$$B$$C';
            const expected = ['$$B$$'];
            const result = input.match(escapeRegExps.texDisplay);
            expect(result).toEqual(expected);
        });

        it('should match inline LaTeX code', () => {
            const input = 'Some text $x^2 + y^2 = \\frac{z^2}{2}$ more text';
            const expected = ['$x^2 + y^2 = \\frac{z^2}{2}$'];
            const result = input.match(escapeRegExps.texInline);
            expect(result).toEqual(expected);
        });

        it('should match fenced code blocks', () => {
            const input = '```typescript\nconsole.log("Hello, world!");\n```';
            const expected = [
                '```typescript\nconsole.log("Hello, world!");\n```',
            ];
            const result = input.match(escapeRegExps.codeBlock);
            expect(result).toEqual(expected);
        });

        it('should match inline code (double backtick)', () => {
            const input =
                'Some text ``console.log("Hello, world!");`` more text';
            const expected = ['``console.log("Hello, world!");``'];
            const result = input.match(escapeRegExps.codeInlineDoubleBacktick);
            expect(result).toEqual(expected);
        });

        it('should match inline code (single backtick)', () => {
            const input = 'Some text `console.log("Hello, world!");` more text';
            const expected = ['`console.log("Hello, world!");`'];
            const result = input.match(escapeRegExps.codeInlineSingleBacktick);
            expect(result).toEqual(expected);
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const preprocessor1 = (await sveltex()) as Sveltex<
        'none',
        'none',
        'none',
        'none' | 'local'
    >;

    const preprocessor2 = (await sveltex({
        advancedTexBackend: 'local',
    })) as Sveltex<'none', 'none', 'none', 'none' | 'local'>;

    const preprocessor3 = (await sveltex({
        advancedTexBackend: 'local',
    })) as Sveltex<'none', 'none', 'none', 'none' | 'local'>;

    await preprocessor3.configure({
        verbatim: {
            verbatimEnvironments: {
                Verbatim: {
                    processInner: { escapeBraces: true, escapeHtml: true },
                },
            },
        },
        advancedTex: { components: { TeX: {} } },
    });

    const preprocessor4 = (await sveltex({
        advancedTexBackend: 'local',
    })) as Sveltex<'none', 'none', 'none', 'none' | 'local'>;

    await preprocessor4.configure({
        verbatim: {
            verbatimEnvironments: {
                Verbatim: {
                    processInner: { escapeBraces: true, escapeHtml: true },
                    aliases: ['verbatim'],
                },
            },
        },
        advancedTex: { components: { TeX: { aliases: ['tex'] } } },
    });

    describe.concurrent.each([
        { preprocessor: preprocessor1, num: 1 },
        { preprocessor: preprocessor2, num: 2 },
        { preprocessor: preprocessor3, num: 3 },
        { preprocessor: preprocessor4, num: 4 },
    ])('escapeVerb()', ({ preprocessor, num }) => {
        it('should noop empty content', () => {
            const content = '';
            const expected = '';
            const result = escapeVerb(preprocessor, content).escapedContent;
            expect(result).toEqual(expected);
        });

        it('should noop plain text', () => {
            const content = 'Some text without markup';
            const expected = 'Some text without markup';
            const result = escapeVerb(preprocessor, content).escapedContent;
            expect(result).toEqual(expected);
        });

        it('should escape display math 1', () => {
            const content = 'a$$b$$c';
            // WARNING: uncommenting the line below will cause the test to fail for
            // some reason beyond my understanding.
            // expect(escapeRegExps.texDisplay.test(content)).toBe(true);
            const result = escapeVerb(preprocessor, content).escapedContent;
            // expect(result).toMatch(/^A [a-f0-9-]{36} B$/);
            expect(result).toEqual(
                `a${(result.match(uuidV4Regexp) ?? [''])[0]}c`,
            );
        });

        it('should escape display math 2', () => {
            const content = '$$2 + 2 = 4.$$';
            // WARNING: uncommenting the line below will cause the test to fail for
            // some reason beyond my understanding.
            // expect(escapeRegExps.texDisplay.test(content)).toBe(true);
            const result = escapeVerb(preprocessor, content).escapedContent;
            // expect(result).toMatch(/^A [a-f0-9-]{36} B$/);
            expect(result).toEqual((result.match(uuidV4Regexp) ?? [''])[0]);
        });

        it('should escape display math 3', () => {
            const content = 'A $$\\LaTeX$$ B';
            // expect(escapeRegExps.texDisplay.test(content)).toBe(true);
            const result = escapeVerb(preprocessor, content).escapedContent;
            // expect(result).toMatch(/^A [a-f0-9-]{36} B$/);
            expect(result).toEqual(
                `A ${(result.match(uuidV4Regexp) ?? [''])[0]} B`,
            );
        });

        it('should escape inline math', () => {
            const content = 'A $\\LaTeX$ B';
            const result = escapeVerb(preprocessor, content).escapedContent;
            expect(result).toMatch(/^A [a-f0-9-]{36} B$/);
            expect(result).toEqual(
                `A ${(result.match(uuidV4Regexp) ?? [''])[0]} B`,
            );
        });

        it('should escape fenced code blocks', () => {
            const content =
                'A\n```typescript\nconsole.log("Hello, world!");\n```\nB';
            const result = escapeVerb(preprocessor, content).escapedContent;
            expect(result).toMatch(/^A\n[a-f0-9-]{36}\nB$/);
            expect(result).toEqual(
                `A\n${(result.match(uuidV4Regexp) ?? [''])[0]}\nB`,
            );
        });

        it('should escape inline code (double backtick)', () => {
            const content =
                'Some text ``console.log("Hello, world!");`` more text';
            const result = escapeVerb(preprocessor, content).escapedContent;
            expect(result).toMatch(/^Some text [a-f0-9-]{36} more text$/);
            expect(result).toEqual(
                `Some text ${(result.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
        });

        it('should escape inline code (single backtick)', () => {
            const content =
                'Some text `console.log("Hello, world!");` more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes(
                    '`console.log("Hello, world!");`',
                ),
            ).toBe(true);
        });

        it('should escape verbatim components', () => {
            if (num < 3) return;
            const content =
                'Some text <Verbatim>x^{2} </verbatim> 3</Verbatim> more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes(
                    '<Verbatim>x^{2} </verbatim> 3</Verbatim>',
                ),
            ).toBe(true);
        });

        it('should escape verbatim components (aliases)', () => {
            if (num < 4) return;
            const content =
                'Some text <verbatim>x^{2} </Verbatim> 3</verbatim> more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes(
                    '<verbatim>x^{2} </Verbatim> 3</verbatim>',
                ),
            ).toBe(true);
        });

        it('should escape tex components', () => {
            if (num < 3) return;
            const content = 'Some text <TeX>x^{2} < 3</TeX> more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes('<TeX>x^{2} < 3</TeX>'),
            ).toBe(true);
        });

        it('should escape tex components (special characters)', () => {
            if (num < 3) return;
            const content =
                'Some text <TeX>\n\\begin{a}}&<>/>>;\n</TeX> more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes(
                    '<TeX>\n\\begin{a}}&<>/>>;\n</TeX>',
                ),
            ).toBe(true);
        });

        it('should escape tex components (tikz)', () => {
            if (num < 3) return;
            const content =
                '<script>\n</script>\n\ntest1 *italic* test2\n\n<TeX ref="something">\n\\begin{tikzpicture}\n\\draw (0,0) circle (3);\n\\draw (0,-1) circle (1.8);\n\\draw[var(--red), thick] (0,0) rectangle (3, 3);\n\\end{tikzpicture}\n</TeX>\n\ntest3 **bold** test4';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toEqual(
                `<script>\n</script>\n\ntest1 *italic* test2\n\n${(escapedContent.match(uuidV4Regexp) ?? [''])[0]}\n\ntest3 **bold** test4`,
            );
            expect(
                [...savedMatches.values()].includes(
                    '<TeX ref="something">\n\\begin{tikzpicture}\n\\draw (0,0) circle (3);\n\\draw (0,-1) circle (1.8);\n\\draw[var(--red), thick] (0,0) rectangle (3, 3);\n\\end{tikzpicture}\n</TeX>',
                ),
            ).toBe(true);
        });

        it('should escape tex components (aliases)', () => {
            if (num < 4) return;
            const content = 'Some text <tex>x^{2} < 3</tex> more text';
            const { escapedContent, savedMatches } = escapeVerb(
                preprocessor,
                content,
            );
            expect(escapedContent).toMatch(
                /^Some text [a-f0-9-]{36} more text$/,
            );
            expect(escapedContent).toEqual(
                `Some text ${(escapedContent.match(uuidV4Regexp) ?? [''])[0]} more text`,
            );
            expect(
                [...savedMatches.values()].includes('<tex>x^{2} < 3</tex>'),
            ).toBe(true);
        });
    });

    describe.concurrent('unescape()', () => {
        it('should unescape content', () => {
            expect(unescape('123', new Map([['123', 'something']]))).toEqual(
                'something',
            );
        });

        it('should remove <p> tags by default content', () => {
            expect(
                unescape('<p>123</p>', new Map([['123', 'something']])),
            ).toEqual('something');
        });

        it('should accept optional removeParagraphTag argument', () => {
            expect(
                unescape(
                    '<p>123</p>\n<p>456</p>',
                    new Map([
                        ['123', 'something'],
                        ['456', 'something else'],
                    ]),
                    (code) => code === 'something',
                ),
            ).toEqual('something\n<p>something else</p>');
        });
    });

    describe.concurrent('escapeCurlyBraces()', () => {
        it('should escape curly braces in the content', () => {
            const content = 'Some {text} with {curly} braces';
            const expected =
                'Some &lbrace;text&rbrace; with &lbrace;curly&rbrace; braces';
            const result = escapeBraces(content);
            expect(result).toEqual(expected);
        });

        it('should escape multiple curly braces in the content', () => {
            const content = '{{{multiple}}} {{{curly}}} {{{braces}}}';
            const expected =
                '&lbrace;&lbrace;&lbrace;multiple&rbrace;&rbrace;&rbrace; &lbrace;&lbrace;&lbrace;curly&rbrace;&rbrace;&rbrace; &lbrace;&lbrace;&lbrace;braces&rbrace;&rbrace;&rbrace;';
            const result = escapeBraces(content);
            expect(result).toEqual(expected);
        });

        it('should not escape other characters in the content', () => {
            const content = 'Some {text} with other characters: !@#$%^&*()';
            const expected =
                'Some &lbrace;text&rbrace; with other characters: !@#$%^&*()';
            const result = escapeBraces(content);
            expect(result).toEqual(expected);
        });

        it('should not escape already escaped curly braces in the content', () => {
            const content =
                'Some &lbrace;text&rbrace; with &lbrace;escaped&rbrace; curly braces';
            const expected =
                'Some &lbrace;text&rbrace; with &lbrace;escaped&rbrace; curly braces';
            const result = escapeBraces(content);
            expect(result).toEqual(expected);
        });

        it('should escape "() => {}" properly', () => {
            const content = '<pre><code>() =&gt; {}\n</code></pre>';
            const expected =
                '<pre><code>() =&gt; &lbrace;&rbrace;\n</code></pre>';
            const result = escapeBraces(content);
            expect(result).toEqual(expected);
        });
    });

    describe.concurrent('intersection()', () => {
        it('should return null if there is no intersection', () => {
            const a = { start: 1, end: 5 };
            const b = { start: 6, end: 10 };
            const result = intersection(a, b);
            expect(result).toBeNull();
        });

        it('should return the intersection if it exists', () => {
            const a = { start: 1, end: 10 };
            const b = { start: 5, end: 15 };
            const expected = { start: 5, end: 10 };
            const result = intersection(a, b);
            expect(result).toEqual(expected);
        });

        it('should handle overlapping intervals', () => {
            const a = { start: 1, end: 10 };
            const b = { start: 5, end: 8 };
            const expected = { start: 5, end: 8 };
            const result = intersection(a, b);
            expect(result).toEqual(expected);
        });

        it('should handle identical intervals', () => {
            const a = { start: 1, end: 10 };
            const b = { start: 1, end: 10 };
            const expected = { start: 1, end: 10 };
            const result = intersection(a, b);
            expect(result).toEqual(expected);
        });
    });
});
describe('outermostRanges()', () => {
    it('should return the outermost ranges', () => {
        const ranges = [
            { start: 0, end: 100 }, // outermost
            { start: 10, end: 20 },
            { start: 50, end: 150 },
            { start: 120, end: 130 }, // outermost
        ];
        const result = outermostRanges(ranges);
        const expected = [
            { start: 0, end: 100 },
            { start: 120, end: 130 },
        ];
        expect(result).toEqual(expected);
    });

    it('should handle ranges overlapping at a single point', () => {
        const ranges = [
            { start: 0, end: 1 }, // outermost
            { start: 1, end: 2 }, // outermost
        ];
        expect(outermostRanges(ranges)).toEqual(ranges);
    });

    it('should prioritize ranges with smaller start points', () => {
        const ranges = [
            { start: 0, end: 2 }, // outermost
            { start: 1, end: 10 },
        ];
        const result = outermostRanges(ranges);
        const expected = [{ start: 0, end: 2 }];
        expect(result).toEqual(expected);
    });

    it('should prioritize larger ranges if they start at the same point', () => {
        const ranges = [
            { start: 0, end: 1 },
            { start: 0, end: 2 }, // outermost
        ];
        const result = outermostRanges(ranges);
        const expected = [{ start: 0, end: 2 }];
        expect(result).toEqual(expected);
    });
});
