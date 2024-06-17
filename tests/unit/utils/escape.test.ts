import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { spy } from '$tests/unit/fixtures.js';
import {
    colonUuid,
    escape,
    escapeSnippets,
    escapeStringForRegExp,
    getColonES,
    getMathInSpecialDelimsES,
    getMdastES,
    getSvelteES,
    outermostRanges,
    padString,
    parseToMdast,
    unescapeSnippets,
} from '$utils/escape.js';
import { cartesianProduct, range, uuidV4Regexp } from '$tests/unit/utils.js';
import { typeAssert, is } from '$deps.js';
import {
    EscapableSnippet,
    EscapedSnippet,
    ProcessedSnippet,
    Snippet,
    UnescapeOptions,
} from '$types/utils/Escape.js';
import { isArray, isString } from '$typeGuards/utils.js';
import type { FullVerbEnvConfig } from '$types/handlers/Verbatim.js';
import { getDefaultMathConfiguration } from '$mod.js';
import { mergeConfigs } from '$utils/merge.js';
import type { WithDelims } from '$types/handlers/Math.js';

function fixture() {
    beforeEach(() => {
        vi.resetAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
}

const verbEnvs = new Map<string, FullVerbEnvConfig>();

describe.concurrent.shuffle('escape()', () => {
    fixture();
    beforeAll(async () => {
        await spy(['log', 'fancyWrite', 'writeFile']);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.concurrent.each([
        [
            'code (inline)',
            [1, 2, 3, 4, 5].map((n) => [
                `a ${'`'.repeat(n)}b${'`'.repeat(n)} c`,
                'a □ c',
                [
                    {
                        type: 'code',
                        processable: {
                            innerContent: 'b',
                            optionsForProcessor: { inline: true },
                        },
                    },
                ],
            ]),
        ],
        [
            'code (block)',
            (
                [[0], [0, '1', '2', 0], [1], [2, undefined, undefined, 1]] as [
                    number,
                    string | undefined,
                    string | undefined,
                    number | undefined,
                ][]
            ).map(([n, lang, info, padding]) => [
                `a${'\n'.repeat(padding ?? 0)}\n\`\`\`${'`'.repeat(n)}${lang ?? ''}${info ? ` ${info}` : ''}\nb\n${'`'.repeat(n)}\`\`\`\n${'\n'.repeat(padding ?? 0)}c`,
                `a${'\n'.repeat(padding ? padding - 1 : 0)}\n\n□\n\n${'\n'.repeat(padding ? padding - 1 : 0)}c`,
                [
                    {
                        type: 'code',
                        processable: {
                            innerContent: 'b',
                            optionsForProcessor: {
                                inline: false,
                                lang,
                                metaString: info,
                            },
                        },
                    } as Partial<EscapedSnippet<'code'>>,
                ],
            ]),
        ],
        ...generateTexTests(),
        [
            'mustacheTag',
            [1, 2, 3, 4, 5].map((n) => [
                `a ${'{'.repeat(n)}b${'}'.repeat(n)} c`,
                'a □ c',
                [
                    {
                        type: 'mustacheTag',
                        original: {
                            outerContent: `${'{'.repeat(n)}b${'}'.repeat(n)}`,
                        },
                    },
                ],
            ]),
        ],
        [
            'svelte',
            [
                'script',
                'style',
                'svelte:head',
                'svelte:window',
                'svelte:document',
                'svelte:body',
                'svelte:options',
            ].map((tag) => [
                `a <${tag}>b</${tag}> c`,
                'a \n\n□\n\n c',
                [
                    {
                        type: 'svelte',
                        original: {
                            outerContent: `<${tag.replace(':', colonUuid)}>b</${tag.replace(':', colonUuid)}>`,
                        },
                        processable: undefined,
                        escapeOptions: { pad: 2 },
                        unescapeOptions: { removeParagraphTag: true },
                    },
                ],
            ]),
        ],
    ] as [
        string,
        [
            string,
            string,
            Partial<EscapedSnippet>[],
            WithDelims['delims'] | undefined,
        ][],
    ][])('%s', (_label, tests) => {
        it.concurrent.each(tests)(
            '%o → %o',
            (raw, escaped, escapedSnippets, texEscapeSettings) => {
                // expect(escape('a')).toEqual({
                //     escapedDocument: 'a',
                //     escapedSnippets: [],
                // });

                const res = escape(
                    raw,
                    [],
                    mergeConfigs(
                        getDefaultMathConfiguration('custom').delims,
                        texEscapeSettings ?? {},
                    ),
                    verbEnvs,
                    {},
                );
                expect(res.escapedDocument).toEqual(
                    expect.stringMatching(
                        new RegExp(
                            escapeStringForRegExp(escaped).replaceAll(
                                '□',
                                uuidV4Regexp.source,
                            ),
                        ),
                    ) as unknown,
                );
                escapedSnippets.forEach((snip, i) => {
                    expect(res.escapedSnippets[i]?.[0]).toEqual(
                        expect.stringMatching(uuidV4Regexp),
                    );
                    expect(res.escapedSnippets[i]?.[1]).toMatchObject(snip);
                });
            },
        );
    });

    describe('edge cases', () => {
        fixture();

        it.each([
            [
                '${...}$',
                '□',
                [
                    {
                        type: 'math',
                        processable: {
                            innerContent: '{...}',
                            optionsForProcessor: { inline: true },
                        },
                        escapeOpts: { pad: false },
                        unescapeOpts: { removeParagraphTag: false },
                    },
                ],
            ],
            [
                '${$}',
                '□}',
                [
                    {
                        type: 'math',
                        processable: {
                            innerContent: '{',
                            optionsForProcessor: { inline: true },
                        },
                    },
                ],
            ],
            [
                '{$}$',
                '□$',
                [
                    {
                        type: 'mustacheTag',
                        original: {
                            outerContent: '{$}',
                        },
                    },
                ],
            ],
            [
                '`{$}$`',
                '□',
                [
                    {
                        type: 'code',
                        processable: {
                            innerContent: '{$}$',
                        },
                    },
                ],
            ],
            [
                '<script attr="{a}$b$`c`">{1}$2$`3`</script>',
                '□',
                [
                    {
                        type: 'svelte',
                        original: {
                            loc: {
                                end: 43,
                                start: 0,
                            },
                            outerContent:
                                '<script attr="{a}$b$`c`">{1}$2$`3`</script>',
                        },
                    },
                ],
            ],
            [
                '<script>a</script>\n...\n<script>c</script>',
                '\n\n□\n\n\n...\n\n\n□\n\n',
                [
                    {
                        type: 'svelte',
                        original: {
                            outerContent: '<script>a</script>',
                        },
                    },
                    {
                        type: 'svelte',
                        original: {
                            outerContent: '<script>c</script>',
                        },
                    },
                ],
            ],
            [
                'a \\[b\\] c',
                'a \n\n□\n\n c',
                [
                    {
                        type: 'math',
                        processable: {
                            innerContent: 'b',
                            optionsForProcessor: { inline: false },
                        },
                    },
                ],
            ],
        ] as [string, string, PartialSnippet[]][])(
            '%o → %o',
            (str, escaped, snippets) => {
                const res = escape(
                    str,
                    [],
                    getDefaultMathConfiguration('custom').delims,
                    verbEnvs,
                    {},
                );
                expect(res.escapedDocument).toMatch(
                    new RegExp(
                        escapeStringForRegExp(escaped).replaceAll(
                            '□',
                            uuidV4Regexp.source,
                        ),
                    ),
                );
                expect(res.escapedSnippets.length).toEqual(snippets.length);
                res.escapedSnippets.forEach((snippet, i) => {
                    expect(snippet[0]).toEqual(
                        expect.stringMatching(uuidV4Regexp),
                    );
                    const snip = snippets[i];
                    typeAssert(is<PartialSnippet>(snip));
                    expect(snippet[1].type).toEqual(snip.type);
                    if (snip.original?.outerContent) {
                        expect(snippet[1].original.outerContent).toEqual(
                            snip.original.outerContent,
                        );
                    }
                    if (snip.original?.loc) {
                        expect(snippet[1].original.loc).toEqual(
                            snip.original.loc,
                        );
                    }
                    if (snip.processable?.innerContent) {
                        expect(snippet[1].processable?.innerContent).toEqual(
                            snip.processable.innerContent,
                        );
                    }
                    if (snip.processable?.optionsForProcessor) {
                        expect(
                            snippet[1].processable?.optionsForProcessor,
                        ).toEqual(snip.processable.optionsForProcessor);
                    }
                    if (snip.unescapeOpts?.removeParagraphTag) {
                        expect(
                            snippet[1].unescapeOptions?.removeParagraphTag,
                        ).toEqual(snip.unescapeOpts.removeParagraphTag);
                    }
                });
            },
        );
    });
});

interface PartialSnippet {
    type: Snippet['type'];
    original?: Partial<Snippet['original']>;
    processable?: Partial<Snippet['processable']>;
    unescapeOpts?: Partial<UnescapeOptions>;
}

describe.concurrent.shuffle('padString()', () => {
    it('should add a newline on both sides by default', () => {
        expect(padString('foo')).toEqual('\nfoo\n');
    });

    it('should add a newline on both sides when padInstr is true', () => {
        expect(padString('foo', true)).toEqual('\nfoo\n');
    });

    it('should add a newline on both sides when padInstr is 1', () => {
        expect(padString('foo', 1)).toEqual('\nfoo\n');
    });

    it('should add 2 newlines on each side when padInstr is 2', () => {
        expect(padString('foo', 2)).toEqual('\n\nfoo\n\n');
    });

    it('should not add any padding when padInstr is false', () => {
        expect(padString('foo', false)).toEqual('foo');
    });

    it('should add the specified string on both sides', () => {
        expect(padString('foo', 'bar')).toEqual('barfoobar');
    });

    it('should add the specified string on the left side', () => {
        expect(padString('foo', ['bar', false])).toEqual('barfoo');
    });

    it('should add the specified string on the right side', () => {
        expect(padString('foo', [false, 'bar'])).toEqual('foobar');
    });

    it('should add the specified strings on both sides', () => {
        expect(padString('foo', ['bar', 'baz'])).toEqual('barfoobaz');
    });

    it('should work with 2-tuples of strings _and_ numbers', () => {
        expect(padString('foo', ['bar', 3])).toEqual('barfoo\n\n\n');
        expect(padString('foo', [3, 'bar'])).toEqual('\n\n\nfoobar');
    });
});

describe.concurrent.shuffle('escapeSnippets()', () => {
    // vi.mock('□', () => {
    //     return {
    //         v4: vi.fn().mockReturnValue('□'),
    //     };
    // });
    // const □Mock = vi.spyOn(await import('□'), 'v4');
    // let c = 1;
    // □Mock.mockReturnValue('□' + String(c++));
    // beforeEach(() => {
    //     vi.resetAllMocks();
    //     c = 1;
    // });
    // afterAll(() => {
    //     vi.restoreAllMocks();
    // });
    it.each([
        {
            document: 'a b c',
            type: 'svelte',
            original: { loc: { start: 2, end: 3 } },
            escapedDocument: 'a □ c',
            escapedSnippets: [
                [
                    '□',
                    {
                        type: 'svelte',
                        original: { loc: { start: 2, end: 3 } },
                    },
                ],
            ],
        },
        {
            document: 'a b c',
            type: 'svelte',
            original: { loc: { start: 2, end: 3 } },
            escapeOptions: { pad: false },
            escapedDocument: 'a □ c',
            escapedSnippets: [
                [
                    '□',
                    {
                        type: 'svelte',
                        original: { loc: { start: 2, end: 3 } },
                    },
                ],
            ],
        },
        {
            document: 'a b c',
            type: 'svelte',
            original: { loc: { start: 2, end: 3 } },
            escapeOptions: { pad: true },
            escapedDocument: 'a \n□\n c',
            escapedSnippets: [
                [
                    '□',
                    {
                        type: 'svelte',
                        original: { loc: { start: 2, end: 3 } },
                    },
                ],
            ],
        },
        {
            document: 'a b c',
            type: 'svelte',
            original: { loc: { start: 2, end: 3 } },
            escapeOptions: { pad: ['\n\n', '\n\n'] },
            escapedDocument: 'a \n\n□\n\n c',
            escapedSnippets: [
                [
                    '□',
                    {
                        type: 'svelte',
                        original: { loc: { start: 2, end: 3 } },
                    },
                ],
            ],
        },
        {
            document: '<script>...</script>\ntest',
            type: 'svelte',
            original: { loc: { start: 0, end: 20 } },
            escapeOptions: { pad: ['\n\n', '\n\n'] },
            escapedDocument: '\n\n□\n\n\ntest',
            escapedSnippets: [
                [
                    '□',
                    {
                        type: 'svelte',
                        original: { loc: { start: 0, end: 20 } },
                    },
                ],
            ],
        },
    ] as (ProcessedSnippet &
        EscapableSnippet & {
            document: string;
            escapedDocument: string;
            escapedSnippets: [string, EscapedSnippet][];
        })[])('$type: $document → $escapedDocument', (test) => {
        expect(
            escapeSnippets(test.document, [
                {
                    type: test.type,
                    escapeOptions: test.escapeOptions,
                    original: test.original,
                    processable: test.processable,
                },
            ]),
        ).toMatchObject({
            escapedDocument: expect.stringMatching(
                new RegExp(
                    escapeStringForRegExp(test.escapedDocument).replaceAll(
                        '□',
                        uuidV4Regexp.source,
                    ),
                ),
            ) as unknown,
            escapedSnippets: test.escapedSnippets.map(
                (snip) =>
                    [expect.stringMatching(uuidV4Regexp), snip[1]] as [
                        string,
                        EscapedSnippet,
                    ],
            ),
        });
    });
});

describe.concurrent.shuffle('unescapeSnippets()', () => {
    describe('removeParagraphTag: true', () => {
        const ps: ProcessedSnippet = {
            processed: 'b',
            unescapeOptions: { removeParagraphTag: true },
        };
        it.each([
            ['a □ c', 'a b c', [['□', ps]]],
            ['a <p>□</p> c', 'a b c', [['□', ps]]],
            ['a <p>\n□</p> c', 'a b c', [['□', ps]]],
            ['a <p>□\n</p> c', 'a b c', [['□', ps]]],
            ['a <p>\n\t \n□\n\n\n</p> c', 'a b c', [['□', ps]]],
            ['<p>□</p>\nc', 'b\nc', [['□', ps]]],
        ] as [string, string, [string, ProcessedSnippet][]][])(
            '%o → %o',
            (document, unescaped, processedSnippets) => {
                expect(unescapeSnippets(document, processedSnippets)).toEqual(
                    unescaped,
                );
            },
        );
    });

    describe('removeParagraphTag: false', () => {
        const ps: ProcessedSnippet = {
            processed: 'b',
            unescapeOptions: { removeParagraphTag: false },
        };
        it.each([
            ['a □ c', 'a b c', [['□', ps]]],
            ['a <p>□</p> c', 'a <p>b</p> c', [['□', ps]]],
            ['a <p>\n□</p> c', 'a <p>\nb</p> c', [['□', ps]]],
            ['a <p>□\n</p> c', 'a <p>b\n</p> c', [['□', ps]]],
            [
                'a <p>\n\t \n□\n\n\n</p> c',
                'a <p>\n\t \nb\n\n\n</p> c',
                [['□', ps]],
            ],
            ['<p>□</p>\nc', '<p>b</p>\nc', [['□', ps]]],
        ] as [string, string, [string, ProcessedSnippet][]][])(
            '%o → %o',
            (document, unescaped, processedSnippets) => {
                expect(unescapeSnippets(document, processedSnippets)).toEqual(
                    unescaped,
                );
            },
        );
    });

    describe('behaves gracefully if processed snippet for UUID is undefined', () => {
        it.each([['a □ c', 'a □ c', [['□', undefined]]]] as unknown as [
            string,
            string,
            [string, ProcessedSnippet][],
        ][])('%o → %o', (document, unescaped, processedSnippets) => {
            expect(unescapeSnippets(document, processedSnippets)).toEqual(
                unescaped,
            );
        });
    });
});

describe.concurrent.shuffle('outermostRanges()', () => {
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

describe.concurrent.shuffle('getSvelteES()', () => {
    describe.each([
        [
            'normal',
            [
                ...[
                    'script',
                    'style',
                    'svelte:head',
                    'svelte:window',
                    'svelte:document',
                    'svelte:body',
                    'svelte:options',
                ].map(
                    (tag) =>
                        [
                            `a<${tag}>...</${tag}>b`,
                            `<${tag}>...</${tag}>`,
                            [
                                {
                                    escapeOptions: { pad: 2 },
                                    original: {
                                        loc: {
                                            start: 1,
                                            end:
                                                9 +
                                                2 *
                                                    tag.replace(':', colonUuid)
                                                        .length,
                                        },
                                        outerContent: `<${tag.replace(':', colonUuid)}>...</${tag.replace(':', colonUuid)}>`,
                                    },
                                    processable: undefined,
                                    type: 'svelte',
                                    unescapeOptions: {
                                        removeParagraphTag: true,
                                    },
                                },
                            ],
                        ] as [string, string, EscapableSnippet[]],
                ),
            ],
        ],
        [
            'self-closing',
            [
                ['a<script/>b', undefined, []],
                ['a<style/>b', undefined, []],
                ['a<svelte:head/>b', undefined, []],
                ...[
                    'svelte:window',
                    'svelte:document',
                    'svelte:body',
                    'svelte:options',
                ].map((tag) => [
                    `a<${tag}/>b`,
                    `<${tag}/>`,
                    [
                        {
                            escapeOptions: { pad: 2 },
                            original: {
                                loc: {
                                    start: 1,
                                    end: 4 + tag.replace(':', colonUuid).length,
                                },
                                outerContent: `<${tag.replace(':', colonUuid)}/>`,
                            },
                            processable: undefined,
                            type: 'svelte',
                            unescapeOptions: { removeParagraphTag: true },
                        },
                    ],
                ]),
            ],
        ],
    ] as [string, [string, string, EscapableSnippet[]][]][])(
        '%s Svelte elements',
        (_label, tests) => {
            it.each(tests)(
                '%o → %o',
                (document, _outerContent, escapedSnippets) => {
                    expect(
                        getSvelteES(document.replaceAll(':', colonUuid)),
                    ).toMatchObject(escapedSnippets);
                },
            );
        },
    );
});

describe.concurrent.shuffle('getColonES()', () => {
    describe.each([
        [
            'normal',
            [
                ...[
                    'svelte:self',
                    'svelte:component',
                    'svelte:element',
                    'svelte:fragment',
                ].map(
                    (tag) =>
                        [
                            `a<${tag}>...</${tag}>b`,
                            "':', ':'",
                            [
                                {
                                    escapeOptions: {
                                        pad: false,
                                        hyphens: false,
                                    },
                                    original: {
                                        loc: { start: 8, end: 9 },
                                        outerContent: ':',
                                    },
                                    processable: undefined,
                                    type: 'svelte',
                                    unescapeOptions: {
                                        removeParagraphTag: false,
                                    },
                                },
                                {
                                    escapeOptions: {
                                        pad: false,
                                        hyphens: false,
                                    },
                                    original: {
                                        loc: {
                                            start: 14 + tag.length,
                                            end: 15 + tag.length,
                                        },
                                        outerContent: ':',
                                    },
                                    processable: undefined,
                                    type: 'svelte',
                                    unescapeOptions: {
                                        removeParagraphTag: false,
                                    },
                                },
                            ],
                        ] as [string, string, EscapableSnippet[]],
                ),
            ],
        ],
        [
            'self-closing',
            [
                ...[
                    'svelte:self',
                    'svelte:component',
                    'svelte:element',
                    'svelte:fragment',
                ].map(
                    (tag) =>
                        [
                            `a<${tag}/>b`,
                            "':'",
                            [
                                {
                                    escapeOptions: {
                                        pad: false,
                                        hyphens: false,
                                    },
                                    original: {
                                        loc: { start: 8, end: 9 },
                                        outerContent: ':',
                                    },
                                    processable: undefined,
                                    type: 'svelte',
                                    unescapeOptions: {
                                        removeParagraphTag: false,
                                    },
                                },
                            ],
                        ] as [string, string, EscapableSnippet[]],
                ),
            ],
        ],
    ] as [string, [string, string, EscapableSnippet[]][]][])(
        '%s Svelte elements',
        (_label, tests) => {
            it.each(tests)(
                '%o → %s',
                (document, _outerContent, escapedSnippets) => {
                    expect(getColonES(document)).toMatchObject(escapedSnippets);
                },
            );
        },
    );
});

describe.concurrent.shuffle('getMathInSpecialDelimsES()', () => {
    describe.each([
        ['tex disabled', false],
        ['tex enabled', true],
    ])('%s', (_label, enabled) => {
        describe.each([
            ['\\(...\\)', true],
            ['\\[...\\]', false],
        ])('%s', (label, inline) => {
            const tests: [string, string, EscapableSnippet<'math'>[]][] = [
                'x^2',
                '[1,2]',
                'a\\cdot b',
                '\\int_0^1 f(x) dx',
                '\\sum_{i=0}^n i',
                '\\begin{align} x &= 1 \\\\ y &= 2 \\end{align}',
                '\\text{$x^2$}',
                '1 / 2',
            ].map((inner) => {
                const outerContent = label.replace('...', inner);
                return [
                    `a${outerContent}c`,
                    enabled ? outerContent : undefined,
                    enabled
                        ? [
                              {
                                  original: {
                                      loc: {
                                          start: 1,
                                          end: 1 + outerContent.length,
                                      },
                                  },
                                  escapeOptions: { pad: inline ? 0 : 2 },
                                  processable: {
                                      innerContent: inner,
                                      optionsForProcessor: { inline },
                                  },
                                  type: 'math',
                              },
                          ]
                        : [],
                ] as [string, string, EscapableSnippet<'math'>[]];
            });
            it.each(tests)(
                '%o → %o',
                (document, _outerContent, escapedSnippets) => {
                    expect(
                        getMathInSpecialDelimsES(document, {
                            dollars: enabled,
                            inline: {
                                singleDollar: enabled,
                                escapedParentheses: enabled,
                            },
                            display: { escapedSquareBrackets: enabled },
                            doubleDollarSignsDisplay: 'fenced',
                        }),
                    ).toMatchObject(escapedSnippets);
                },
            );
        });
    });
});

describe.concurrent.shuffle('getMdastES()', () => {
    describe('frontmatter', () => {
        const tests: [string, string, EscapableSnippet<'frontmatter'>[]][] = (
            [
                [
                    '---\ntitle: Something\n---\n\n...',
                    'title: Something',
                    'yaml',
                ],
                [
                    '+++\ntitle = "Something"\n+++\n\n...',
                    'title = "Something"',
                    'toml',
                ],
                [
                    '---yaml\ntitle: Something\n---\n\n...',
                    'title: Something',
                    'yaml',
                ],
                [
                    '---toml\ntitle = "Something"\n---\n\n...',
                    'title = "Something"',
                    'toml',
                ],
                [
                    '---json\n  "title": "Something"\n---\n\n...',
                    '  "title": "Something"',
                    'json',
                ],
            ] as const
        ).map(([str, innerContent, type]) => [
            str,
            str.slice(0, -5),
            [
                {
                    original: {
                        loc: { start: 0, end: str.length - 5 },
                        outerContent: undefined,
                    },
                    processable: {
                        innerContent,
                        optionsForProcessor: { type },
                    },
                    type: 'frontmatter',
                },
            ],
        ]);
        it.each(tests)(
            '%o → %o',
            (document, _innerContent, escapedSnippets) => {
                // const ast = parseToMdast(document, [
                //     'script',
                //     'style',
                //     'svelte:window',
                //     'svelte:head',
                //     'svelte:component',
                // ]);
                // removePosition(ast, { force: true });
                // console.log(inspect(ast, { depth: 10, colors: true }));
                expect(
                    getMdastES({
                        ast: parseToMdast(document),
                        texSettings:
                            getDefaultMathConfiguration('custom').delims,
                        document,
                        lines: document.split('\n'),
                        directiveSettings: {},
                    }),
                ).toMatchObject(escapedSnippets);
            },
        );
    });

    describe('mustacheTag', () => {
        const tests: [string, string, EscapableSnippet<'mustacheTag'>[]][] = [
            '@html b',
            'b',
            '{b}',
            '{{b}}',
            '$b$',
            '$$b$$',
            '$$$b$$$',
            '$b$$',
            '$$b$',
            '`b`',
            '``b``',
            '```b```',
            '`b``',
            '``b`',
            '"!@#$%^&*()_+{}|:"<>?~`"',
        ].map((inner) => [
            `a{${inner}}c`,
            `{${inner}}`,
            [
                {
                    original: {
                        loc: { start: 1, end: 3 + inner.length },
                        outerContent: `{${inner}}`,
                    },
                    processable: undefined,
                    type: 'mustacheTag',
                },
            ],
        ]);
        it.each(tests)(
            '%o → %o',
            (document, _outerContent, escapedSnippets) => {
                expect(
                    getMdastES({
                        ast: parseToMdast(document),
                        document,
                        lines: document.split('\n'),
                        texSettings:
                            getDefaultMathConfiguration('custom').delims,
                        directiveSettings: {},
                    }),
                ).toMatchObject(escapedSnippets);
            },
        );
    });

    describe('svelte', () => {
        const tests: [string, string, EscapableSnippet<'svelte'>[]][] = [
            'a{@debug b}c',
            'a{@const b}c',
            'a{#if b}c',
            'a{/if b}c',
            'a{#each b}c',
            'a{/each b}c',
            'a{#await b}c',
            'a{/await b}c',
            'a{:then b}c',
            'a{:catch b}c',
            'a{#key b}c',
            'a{/key b}c',
        ].map((str) => [
            str,
            str.slice(1, -1),
            [
                {
                    original: {
                        loc: { start: 1, end: str.length - 1 },
                        outerContent: str.slice(1, -1),
                    },
                    processable: undefined,
                    type: 'svelte',
                },
            ],
        ]);
        it.each(tests)(
            '%o → %o',
            (document, _outerContent, escapedSnippets) => {
                // const ast = parseToMdast(document, [
                //     'script',
                //     'style',
                //     'svelte:window',
                //     'svelte:head',
                //     'svelte:component',
                // ]);
                // removePosition(ast, { force: true });
                // console.log(inspect(ast, { depth: 10, colors: true }));
                expect(
                    getMdastES({
                        ast: parseToMdast(document),
                        texSettings:
                            getDefaultMathConfiguration('custom').delims,
                        document,
                        lines: document.split('\n'),
                        directiveSettings: {},
                    }),
                ).toMatchObject(escapedSnippets);
            },
        );
    });

    describe('code spans', () => {
        it.each([
            ...(
                [
                    ['`', 'b', ' b '],
                    ['`', 'b', '\nb\n'],
                    ['`', 'b', ' b\n'],
                    ['`', 'b', '\nb '],
                    ['`', 'b ', 'b '],
                    ['`', ' b', ' b'],
                    ['`', '\nb', '\nb'],
                    ['`', 'b\n', 'b\n'],
                    ['``', '`', ' ` '],
                    ['`', '``', ' `` '],
                    ['`', '```', ' ``` '],
                ] as [string, string, string?][]
            ).map(([delim, innerContent, innerContentRaw]) => {
                const outerContent = `${delim}${innerContentRaw ?? innerContent}${delim}`;
                return [
                    `a␠${outerContent.replaceAll(' ', '␠')}␠c`,
                    outerContent.replaceAll(' ', '␠'),
                    [
                        {
                            original: {
                                loc: { start: 2, end: 2 + outerContent.length },
                            },
                            processable: {
                                innerContent,
                                optionsForProcessor: { inline: true },
                            },
                            type: 'code',
                        },
                    ],
                ] as [string, string, EscapableSnippet[]];
            }),
        ] as [string, string, EscapableSnippet[]][])(
            '%o → %o',
            (document, _outerContent, escapedSnippets) => {
                expect(
                    getMdastES({
                        ast: parseToMdast(document.replaceAll('␠', ' ')),
                        texSettings:
                            getDefaultMathConfiguration('custom').delims,
                        document,
                        lines: document.split('\n'),
                        directiveSettings: {},
                    }),
                ).toMatchObject(escapedSnippets);
            },
        );
    });

    describe('code blocks', () => {
        it.each([
            ...(
                [
                    ['```', 'b', 'ts', 'info'],
                    ['```', ''],
                    ['```', '\nb\n'],
                    ['~~~', '````\nb\n````'],
                    ['````', '```\nb\n```'],
                    ['````', '~~~~\nb\n~~~~'],
                    ['````', '{{$$$` {\n\n\n\n'],
                ] as [string, string, string?, string?][]
            ).map(([delim, innerContent, lang, info]) => {
                const outerContent = `${delim}${lang ?? ''}${info ? ' ' + info : ''}\n${innerContent}\n${delim}`;
                return [
                    `a\n${outerContent}\nc`,
                    outerContent,
                    [
                        {
                            original: {
                                loc: { start: 2, end: 2 + outerContent.length },
                            },
                            processable: {
                                innerContent: innerContent,
                                optionsForProcessor: {
                                    inline: false,
                                    lang,
                                    metaString: info,
                                },
                            },
                            type: 'code',
                            // escapeOptions: { pad: ['\n', 1] },
                            unescapeOptions: { removeParagraphTag: true },
                        },
                    ],
                ] as [string, string, EscapableSnippet[]];
            }),
        ] as [string, string, EscapableSnippet[]][])(
            '%o → %o',
            (document, _outerContent, escapedSnippets) => {
                expect(
                    getMdastES({
                        ast: parseToMdast(document),
                        texSettings:
                            getDefaultMathConfiguration('custom').delims,
                        document,
                        lines: document.split('\n'),
                        directiveSettings: {},
                    }),
                ).toMatchObject(escapedSnippets);
            },
        );
    });

    describe('verbatim', () => {
        describe.each([
            [
                'hides code spans',
                [
                    'a<Verb>`b`</Verb>c',
                    'a<Verb>``b``</Verb>c',
                    'a<Verb>```b```</Verb>c',
                    'a\n<Verb>\n`b`\n</Verb>\nc',
                    'a\n<Verb>\n``b``\n</Verb>\nc',
                    'a\n<Verb>\n```b```\n</Verb>\nc',
                    'a\n<Verb>\n\n`b`\n\n</Verb>\nc',
                    'a\n<Verb>\n\n``b``\n\n</Verb>\nc',
                    'a\n<Verb>\n\n```b```\n\n</Verb>\nc',
                    'a\n\n<Verb>\n`b`\n</Verb>\n\nc',
                    'a\n\n<Verb>\n``b``\n</Verb>\n\nc',
                    'a\n\n<Verb>\n```b```\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n`b`\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n``b``\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n```b```\n\n</Verb>\n\nc',
                ],
            ],
            [
                'hides code blocks',
                [
                    'a\n<Verb>\n```\nb\n```\n</Verb>\nc',
                    'a\n<Verb>\n```ts\nb\n```\n</Verb>\nc',
                    'a\n<Verb>\n\n```\nb\n```\n\n</Verb>\nc',
                    'a\n<Verb>\n\n```ts\nb\n```\n\n</Verb>\nc',
                    'a\n\n<Verb>\n```\nb\n```\n</Verb>\n\nc',
                    'a\n\n<Verb>\n```ts\nb\n```\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n```\nb\n```\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n```ts\nb\n```\n\n</Verb>\n\nc',
                    'a\n<Verb>\n~~~\nb\n~~~\n</Verb>\nc',
                    'a\n<Verb>\n~~~ts\nb\n~~~\n</Verb>\nc',
                    'a\n<Verb>\n\n~~~\nb\n~~~\n\n</Verb>\nc',
                    'a\n<Verb>\n\n~~~ts\nb\n~~~\n\n</Verb>\nc',
                    'a\n\n<Verb>\n~~~\nb\n~~~\n</Verb>\n\nc',
                    'a\n\n<Verb>\n~~~ts\nb\n~~~\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n~~~\nb\n~~~\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n~~~ts\nb\n~~~\n\n</Verb>\n\nc',
                ],
            ],
            [
                'hides math',
                [
                    'a<Verb>\\(b\\)</Verb>c',
                    'a<Verb>\\[b\\]</Verb>c',
                    'a<Verb>$b$</Verb>c',
                    'a<Verb>$$b$$</Verb>c',
                    'a<Verb>$$$b$$$</Verb>c',
                    'a\n<Verb>\n\\(b\\)\n</Verb>\nc',
                    'a\n<Verb>\n\\[b\\]\n</Verb>\nc',
                    'a\n<Verb>\n$b$\n</Verb>\nc',
                    'a\n<Verb>\n$$b$$\n</Verb>\nc',
                    'a\n<Verb>\n$$$b$$$\n</Verb>\nc',
                    'a\n<Verb>\n\n$b$\n\n</Verb>\nc',
                    'a\n<Verb>\n\n$$b$$\n\n</Verb>\nc',
                    'a\n<Verb>\n\n$$$b$$$\n\n</Verb>\nc',
                    'a\n\n<Verb>\n\\(b\\)\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\\[b\\]\n</Verb>\n\nc',
                    'a\n\n<Verb>\n$b$\n</Verb>\n\nc',
                    'a\n\n<Verb>\n$$b$$\n</Verb>\n\nc',
                    'a\n\n<Verb>\n$$$b$$$\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n\\(b\\)\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n\\[b\\]\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n$b$\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n$$b$$\n\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n$$$b$$$\n\n</Verb>\n\nc',
                ],
            ],
            [
                'hides mustache tags',
                [
                    'a<Verb>{b}</Verb>c',
                    'a\n<Verb>\n{b}\n</Verb>\nc',
                    'a\n<Verb>\n\n{b}\n\n</Verb>\nc',
                    'a\n\n<Verb>\n{b}\n</Verb>\n\nc',
                    'a\n\n<Verb>\n\n{b}\n\n</Verb>\n\nc',
                ],
            ],
            [
                'misc',
                [
                    ...['Verb', 'V3_rb'].flatMap((tag) => [
                        // opening tag only
                        `a<${tag}>{b}`,
                        `a\n<${tag}>{b}`,
                        [`a<${tag}>\n{b}`, 1],
                        `a\n<${tag}>\n{b}`,
                        `a\n<${tag}>\n\nb\n`,
                        // different closing tag
                        `a<${tag}>{b}</div>`,
                        `a<${tag}>{b}</div></${tag}>`,
                        `a<${tag}>{b}</3div></${tag}>`,
                        `a<${tag}>{b}</_div></${tag}>`,
                        `a<${tag}>{b}</div%div></${tag}>`,
                        // closing tag only
                        // [`a</${tag}>{b}`, 1],
                        // [`a\n</${tag}>{b}`, 1],
                        // [`a</${tag}>\n{b}`, 1],
                        // [`a\n</${tag}>\n{b}`, 1],
                        // whitespace in tag
                        [`a< ${tag}>{b}`, 1],
                        `a<${tag} >{b}`,
                        [`a< ${tag} >{b}`, 1],
                        [`a<\n${tag}>{b}`, 1],
                        [`a<${tag}\n>{b}`, 1],
                        // attributes in tag
                        `<${tag} attr="val">{b}`,
                        `<${tag} attr="val" attr2="val2">{b}`,
                        [`< ${tag} >{b}`, 1],
                        [`<\n${tag}>{b}`, 1],
                        `<${tag} attr="val">{b}</${tag}>`,
                        `<${tag} attr="val" attr2="val2">{b}</${tag}>`,
                        // [`< ${tag} >{b}</${tag}>`, 1],
                        // [`<\n${tag}>{b}</${tag}>`, 1],
                        // with prefix
                        `> <${tag} attr="val"></${tag}>`,
                        `> <${tag} attr="val" attr2="val2">\n> b\n> </${tag}>`,
                        `> <${tag}>`,
                        `>> <${tag}>`,
                        `> <${tag}>\n`,
                        `>> <${tag}>\n`,
                        // `> </${tag}>.`,
                        `- <${tag}>\n  </${tag}>`,
                        `- *<${tag}>\n  </${tag}>*`,
                        `> - <${tag}>\n>   </${tag}>`,
                        `> - *<${tag}>\n>   </${tag}>*`,
                        `- <${tag}>\n  ...`,
                        `- *<${tag}>\n  ...*`,
                        `> - <${tag}>\n>   ...`,
                        `> - *<${tag}>\n>   ...*`,
                        `- <${tag}>\n  ...\n  ...`,
                        `- <${tag}>\n  ...\n  ...\n  </${tag}>`,
                        `- *a\n  <${tag}>b*.`,
                        [`- *a\n  <${tag}>...</${tag}>b*.`, -1],
                        [`- *a\n  <${tag}>b*</${tag}>.`, -1],
                        `- *a\n  \n  \n<${tag}>b*.`,
                        [`- *a\n  \n  \n<${tag}></${tag}>b*.`, -1],
                        [`- *a\n  \n  \n<${tag}>b*</${tag}>.`, -1],
                        `<${tag}>\n- *a\n  b*\n- c\n</${tag}>`,
                        `\n\n<${tag}>\n\n- *a\n  b*\n- c\n\n</${tag}>\n\n`,
                    ]),
                    // `a<tag>`,
                    // `a\n<tag>`,
                    // `a<tag>\n`,
                    // `a\n<tag>\n`,
                    // // closing tag only
                    // // `a</tag>`,
                    // // `a\n</tag>`,
                    // // `a</tag>\n`,
                    // // `a\n</tag>\n`,
                    // // whitespace in tag
                    // `a< tag>`,
                    // `a<tag >`,
                    // `a< tag >`,
                    // `a<\ntag>`,
                    // `a<tag/>`,
                    // // attributes in tag
                    // `<tag attr="val">`,
                    // `<tag attr="val" attr2="val2">`,
                    // `< tag >`,
                    // `<\ntag>`,
                    // // with prefix
                    // `> <tag attr="val">`,
                    // `> <tag attr="val" attr2="val2">`,
                    // `> < tag >`,
                    // `> <\ntag>`,
                    // invalid tag
                    [`<%tag attr="val">`, -1],
                    [`<t%ag attr="val">`, -1],
                    [`<ta%g attr="val">`, -1],
                    [`<tag% attr="val" attr2="val2">`, -1],
                ],
            ],
        ])('%s', (_label, tests) => {
            it.each(tests as (string | [string, number | undefined])[])(
                '%o',
                (doc) => {
                    const n = isArray(doc) ? doc[1] ?? 0 : 0;
                    const document = isArray(doc) ? doc[0] : doc;
                    // console.log(inspect(ast, { depth: 10, colors: true }));
                    if (n === -1) {
                        expect(() =>
                            parseToMdast(document, ['Verb', 'V3_rb']),
                        ).toThrowError();
                    } else {
                        const ast = parseToMdast(document, ['Verb', 'V3_rb']);
                        expect(
                            getMdastES({
                                ast,
                                texSettings:
                                    getDefaultMathConfiguration('custom')
                                        .delims,
                                document,
                                lines: document.split('\n'),
                                directiveSettings: {},
                            }).length,
                        ).toEqual(n);
                    }
                },
            );
        });
    });

    describe('math', () => {
        describe.each([
            ...(
                [
                    [false, true],
                    [true, false],
                    [true, true],
                ] as const
            ).map(
                ([enabled, singleDollar]) =>
                    [
                        `tex (${enabled ? 'enabled' : 'disabled'}${enabled ? (singleDollar ? ', singleDollar: true' : ', singleDollar: false') + ", doubleDollarSignsDisplay: 'always'" : ''})`,
                        [
                            { str: 'a$b$c', n: 1 },
                            { str: 'a$$b$$c', n: 2 },
                            { str: 'a$$$b$$$c', n: 3 },
                        ].map(
                            ({ str, n }) =>
                                [
                                    str,
                                    !enabled || (n === 1 && !singleDollar)
                                        ? undefined
                                        : str.slice(1, -1),
                                    {
                                        dollars: enabled,
                                        inline: { singleDollar },
                                        doubleDollarSignsDisplay: 'always',
                                    } as WithDelims['delims'],
                                    !enabled || (n === 1 && !singleDollar)
                                        ? []
                                        : [
                                              {
                                                  original: {
                                                      loc: {
                                                          start: 1,
                                                          end: 2 + 2 * n,
                                                      },
                                                  },
                                                  processable: {
                                                      innerContent: 'b',
                                                      optionsForProcessor: {
                                                          inline: n === 1,
                                                      },
                                                  },
                                                  type: 'math',
                                              },
                                          ],
                                ] as [
                                    string,
                                    string | undefined,
                                    WithDelims['delims'],
                                    EscapableSnippet[],
                                ],
                        ),
                    ] as [
                        string,
                        [
                            string,
                            string | undefined,
                            WithDelims['delims'],
                            EscapableSnippet[],
                        ][],
                    ],
            ),
        ])('%s', (_label, tests) => {
            it.each(tests)(
                '%o → %o',
                (
                    document,
                    _outerContent,
                    texEscapeSettings,
                    escapedSnippets,
                ) => {
                    expect(
                        getMdastES({
                            ast: parseToMdast(
                                document,
                                undefined,
                                mergeConfigs(
                                    getDefaultMathConfiguration('custom')
                                        .delims,
                                    texEscapeSettings ?? {},
                                ),
                            ),
                            document,
                            lines: document.split('\n'),
                            texSettings: mergeConfigs(
                                getDefaultMathConfiguration('custom').delims,
                                texEscapeSettings ?? {},
                            ),
                            directiveSettings: {},
                        }),
                    ).toMatchObject(escapedSnippets);
                },
            );
        });
    });
});

function generateTexTests(): [
    string,
    [
        string,
        string,
        Partial<EscapedSnippet>[],
        WithDelims['delims'] | undefined,
    ][],
][] {
    const isDisplayMath = ['always', 'newline', 'fenced'] as const;
    const delims = ['\\(...\\)', '\\[...\\]', 1, 2, 3] as [
        '\\(...\\)',
        '\\[...\\]',
        1,
        2,
        3,
    ];
    return isDisplayMath.map((doubleDollarSignsDisplay) => [
        `tex (${doubleDollarSignsDisplay})`,
        cartesianProduct(delims, range(0, 1), range(0, 2), range(0, 2)).map(
            ([delims, inner, leftOuter, rightOuter]) =>
                texTest({
                    input: {
                        padding: {
                            left: {
                                inner,
                                outer: inner + leftOuter,
                            },
                            right: {
                                inner,
                                outer: inner + rightOuter,
                            },
                        },
                        content: {
                            outer: { before: 'a', after: 'c' },
                            inner: 'b',
                        },
                        delims: isString(delims) ? delims : ['$', delims],
                    },
                    settings: {
                        dollars: true,
                        inline: {
                            singleDollar: true,
                            escapedParentheses: true,
                        },
                        display: {
                            escapedSquareBrackets: true,
                        },
                        doubleDollarSignsDisplay,
                    },
                }),
        ),
    ]);
}

function texTest(opts: {
    input: {
        padding: {
            left: { inner: number; outer: number };
            right: { inner: number; outer: number };
        };
        content: {
            outer: { before: string; after: string };
            inner: string;
        };
        delims: ['$', number] | '\\[...\\]' | '\\(...\\)';
    };
    settings: WithDelims['delims'];
}): [
    string,
    string,
    Partial<EscapedSnippet>[],
    WithDelims['delims'] | undefined,
] {
    const { input, settings } = opts;
    const { padding, delims, content } = input;
    const { left, right } = padding;
    const { outer, inner } = content;
    const { before, after } = outer;
    const ldelim =
        delims === '\\(...\\)'
            ? '\\('
            : delims === '\\[...\\]'
              ? '\\['
              : '$'.repeat(delims[1]);
    const rdelim =
        delims === '\\(...\\)'
            ? '\\)'
            : delims === '\\[...\\]'
              ? '\\]'
              : '$'.repeat(delims[1]);
    const inputStr =
        before +
        '\n'.repeat(left.outer) +
        ldelim +
        '\n'.repeat(left.inner) +
        inner +
        '\n'.repeat(right.inner) +
        rdelim +
        '\n'.repeat(right.outer) +
        after;
    let inline =
        delims === '\\(...\\)' || (delims !== '\\[...\\]' && delims[1] <= 1);
    if (!inline && delims !== '\\[...\\]') {
        if (settings?.doubleDollarSignsDisplay === 'newline') {
            inline = !(left.outer > 0 && right.outer > 0);
        } else if (settings?.doubleDollarSignsDisplay === 'fenced') {
            inline = !(
                left.outer > 0 &&
                right.outer > 0 &&
                left.inner > 0 &&
                right.inner > 0
            );
        }
    }
    const expected = {
        padding: {
            left: inline ? 0 : 2,
            right: inline ? 0 : 2,
        },
    };
    const expectedStr =
        before +
        '\n'.repeat(left.outer) +
        '\n'.repeat(expected.padding.left) +
        '□' +
        '\n'.repeat(expected.padding.right) +
        '\n'.repeat(right.outer) +
        after;
    const innerContent =
        '\n'.repeat(
            left.inner === right.inner && left.inner >= 1
                ? left.inner - 1
                : left.inner,
        ) +
        inner +
        '\n'.repeat(
            right.inner === left.inner && right.inner >= 1
                ? right.inner - 1
                : right.inner,
        );
    const expectedSnippets: Partial<EscapedSnippet<'math'>>[] = [
        {
            type: 'math',
            processable: {
                innerContent,
                optionsForProcessor: { inline },
            },
        },
    ];
    return [inputStr, expectedStr, expectedSnippets, settings];
}
