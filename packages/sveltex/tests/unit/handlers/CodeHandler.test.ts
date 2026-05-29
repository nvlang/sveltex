import {
    describe,
    test,
    expect,
    vi,
    beforeAll,
    beforeEach,
    type MockInstance,
    afterAll,
    afterEach,
} from 'vitest';
import { CodeHandler } from '../../../src/handlers/CodeHandler.js';
import { consoles } from '../../../src/utils/debug.js';
import type {
    CodeBackend,
    CodeConfiguration,
} from '../../../src/types/handlers/Code.js';
import { codeBackends } from '../../../src/utils/diagnosers/backendChoices.js';
import { getDefaultCodeConfig } from '../../../src/base/defaults.js';
import { nodeAssert } from '../../../src/deps.js';
import { isFunction, isString } from '../../../src/typeGuards/utils.js';
import { mergeConfigs } from '../../../src/utils/merge.js';
import { bundledLanguages, bundledThemes } from 'shiki';

import {
    fuzzyTest,
    fc,
    shikiTransformerMetaHighlight,
    shikiTransformerNotationDiff,
} from '../../../src/dev_deps.js';
import {
    escapeStringForRegExp,
    generateId,
} from '../../../src/utils/escape.js';
import { sveltex } from '../../../src/base/Sveltex.js';
import type { SupportedCdn } from '../../../src/types/handlers/Css.js';
import { supportedCdns } from '../../../src/typeGuards/code.js';
import { spy } from '../fixtures.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

/**
 * Arbitrary for the `code` argument of the syntax-highlighting fuzz tests.
 *
 * The fuzzed string is prefixed with `!` so it cannot be parsed as inline
 * metadata. SvelTeX's `inlineMeta` parser extracts a language tag from the
 * code itself (overriding the `lang` passed explicitly) when the code starts
 * with `{` or a word character; a leading `!` is neither, so the explicit
 * `lang` is always the one reflected in the output.
 */
const codeArbitrary = fc.string({ minLength: 1 }).map((s) => `!${s}`);

describe('CodeHandler.create', () => {
    describe.each(
        codeBackends.flatMap((backend) => [
            [backend, '{}', {}],
            [
                backend,
                'config',
                {
                    addLanguageClass: 'something',
                    appendNewline: false,
                    transformers: {
                        post: [() => '', ['a', 'b'], [/a/u, 'b']],
                        pre: [/a/u, 'b'],
                    },
                },
            ],
        ]) as [CodeBackend, string, CodeConfiguration<CodeBackend>][],
    )('(%o, %s) → [object Object]', (backend, _configStr, config) => {
        test(`_premise_`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler).toBeDefined();
            expect(handler).toBeTypeOf('object');
        });
        // Vite needs stuff to be serializable (i.e., "JSON.stringify-able").
        test(`_serializable_`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler).toBeDefined();
            expect(() => JSON.stringify(handler)).not.toThrow();
            expect(JSON.stringify(handler)).not.toMatch(/circular|circle/iu);
        });
        test(`.backend → '${backend}'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.backend).toEqual(backend);
        });
        const configIsEmpty = Object.entries(config).length === 0;
        test(
            `.configuration → ` +
                (configIsEmpty ? `default` : `mergeConfigs(default, config)`),
            async () => {
                const handler = await CodeHandler.create(backend, config);
                const expected = mergeConfigs(
                    getDefaultCodeConfig(backend),
                    config,
                );
                Object.entries(handler.configuration).forEach(
                    ([key, value]) => {
                        if (isFunction(value)) {
                            const defaultFunction =
                                expected[key as keyof typeof expected];
                            nodeAssert(isFunction(defaultFunction));
                            expect(value.toString()).toEqual(
                                defaultFunction.toString(),
                            );
                        } else {
                            expect(value).toEqual(
                                expected[key as keyof typeof expected],
                            );
                        }
                    },
                );
            },
        );
        test(`typeof .process → 'function'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.process).toBeTypeOf('function');
        });
    });
});

describe.each(codeBackends)('CodeHandler<%o>', (backend) => {
    describe('.process', () => {
        describe.each([['', {}]])('(%o) → ParsedSnippet', (input, opts) => {
            test(`_premise_`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process(input, opts);
                expect(output).toBeDefined();
                expect(output).toBeTypeOf('object');
            });
            test(`typeof .processed → 'string'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process(input, opts);
                expect(output.processed).toBeDefined();
                expect(output.processed).toBeTypeOf('string');
            });
            test(`typeof .unescapeOptions → 'object'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process('let a');
                expect(output.unescapeOptions).toBeTypeOf('object');
            });
            test(`typeof .unescapeOptions.removeParagraphTag → 'boolean'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process('let a');
                expect(output.unescapeOptions.removeParagraphTag).toBeTypeOf(
                    'boolean',
                );
            });
            if (backend === 'none') {
                test(`.processed → ''`, async () => {
                    const handler = await CodeHandler.create(backend, {});
                    const output = await handler.process(input, opts);
                    expect(output.processed).toEqual('');
                });
            } else {
                test(`.processed → '<pre...><code...>...</code...></pre>'`, async () => {
                    const handler = await CodeHandler.create(backend, {});
                    const output = await handler.process(input, opts);
                    expect(output.processed).toMatch(
                        /^(?:<!-- svelte-ignore[^>]*-->\n)?<pre[^>]*?><code[^>]*?>.*<\/code[^>]*?><\/pre[^>]*?>/su,
                    );
                });
            }
        });
        if (backend !== 'none') {
            describe('features', () => {
                if (backend === 'starry-night' || backend === 'highlight.js') {
                    describe(
                        'generates CSS on first run',
                        { concurrent: false },
                        () => {
                            let writeFileEnsureDir: MockInstance;
                            let log: MockInstance;
                            let existsSync: MockInstance;
                            beforeAll(async () => {
                                const mocks = await spy([
                                    'writeFileEnsureDir',
                                    'log',
                                    'existsSync',
                                ]);
                                writeFileEnsureDir = mocks.writeFileEnsureDir;
                                existsSync = mocks.existsSync;
                                log = mocks.log;
                            });
                            afterAll(() => {
                                writeFileEnsureDir.mockRestore();
                                existsSync.mockRestore();
                                log.mockRestore();
                            });
                            afterEach(() => {
                                vi.clearAllMocks();
                            });
                            test.each([
                                ...[['jsdelivr'], ['cdnjs']],
                                ...['jsdelivr', 'cdnjs', 'esm.sh'].map(
                                    (cdn) =>
                                        [[cdn, ...supportedCdns]] as [
                                            [SupportedCdn, ...SupportedCdn[]],
                                        ],
                                ),
                            ] as (
                                | SupportedCdn
                                | [SupportedCdn, ...SupportedCdn[]]
                            )[])('cdn: %o', async (cdn) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: { type: 'self-hosted', cdn },
                                    },
                                );
                                await handler.process('', {});
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenCalledTimes(1);
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenNthCalledWith(
                                    1,
                                    expect.stringMatching(
                                        new RegExp(
                                            `sveltex/${backend}@.*\\.css`,
                                            'u',
                                        ),
                                    ),
                                    expect.stringContaining('color:'),
                                );
                                await handler.process('', {});
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenCalledTimes(1);
                            });

                            test("shouldn't write CSS if configuration.theme.type is none", async () => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: { type: 'none' },
                                    },
                                );
                                await handler.process('', {});
                                expect(log).not.toHaveBeenCalled();
                                expect(
                                    writeFileEnsureDir,
                                ).not.toHaveBeenCalled();
                                expect(existsSync).not.toHaveBeenCalled();
                            });

                            test("shouldn't write CSS if configuration is not valid", async () => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: 123 as unknown as {
                                            type: 'none';
                                        },
                                    },
                                );
                                await handler.process('', {});
                                expect(log).toHaveBeenCalledTimes(1);
                                expect(
                                    writeFileEnsureDir,
                                ).not.toHaveBeenCalled();
                                expect(existsSync).not.toHaveBeenCalled();
                            });

                            test("should work even if version can't be fetched", async () => {
                                const getVersionMock = vi
                                    .spyOn(
                                        await import('../../../src/utils/env.js'),
                                        'getVersion',
                                    )
                                    .mockResolvedValueOnce(undefined);
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: { type: 'self-hosted' },
                                    },
                                );
                                await handler.process('', {});
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenCalledTimes(1);
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenNthCalledWith(
                                    1,
                                    expect.stringMatching(
                                        new RegExp(
                                            `static/sveltex/${backend}@latest.*\\.css`,
                                            'u',
                                        ),
                                    ),
                                    expect.stringContaining('color:'),
                                );
                                getVersionMock.mockRestore();
                            });

                            test("should return early if CSS can't be fetched", async () => {
                                const fetchCssMock = vi
                                    .spyOn(
                                        await import('../../../src/utils/cdn.js'),
                                        'fancyFetch',
                                    )
                                    .mockResolvedValueOnce(undefined);
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: { type: 'self-hosted' },
                                    },
                                );
                                await handler.process('', {});
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenCalledTimes(0);
                                fetchCssMock.mockRestore();
                            });

                            test('should return early if CSS file is already present', async () => {
                                const fetchCssMock = vi
                                    .spyOn(
                                        await import('../../../src/utils/cdn.js'),
                                        'fancyFetch',
                                    )
                                    .mockResolvedValueOnce(undefined);
                                existsSync.mockReturnValueOnce(true);
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        theme: { type: 'self-hosted' },
                                    },
                                );
                                await handler.process('', {});
                                expect(
                                    writeFileEnsureDir,
                                ).toHaveBeenCalledTimes(0);
                                fetchCssMock.mockRestore();
                            });
                        },
                    );
                }
                describe('escapes special characters', () => {
                    test.each([
                        ['{', ['&lbrace;', '&#x7B;']],
                        ['}', ['&rbrace;', '&#x7D;']],
                        ['<', ['&lt;', '&#x3C;']],
                        ...(backend !== 'shiki'
                            ? [['>', ['&gt;', '&#x3E;']]]
                            : []),
                    ] as [string, string[]][])(
                        '%s → %o',
                        async (char, escaped) => {
                            const handler = await CodeHandler.create(backend);
                            expect(
                                (await handler.process(`a ${char} b`))
                                    .processed,
                            ).toMatch(new RegExp(escaped.join('|'), 'u'));
                            if (backend !== 'escape') {
                                expect(
                                    (
                                        await handler.process(`a ${char} b`, {
                                            lang: 'js',
                                        })
                                    ).processed,
                                ).toMatch(new RegExp(escaped.join('|'), 'u'));
                            }
                        },
                    );
                });
                describe('addLanguageClass', () => {
                    test.each([true, false, 'something-', ''])(
                        '%o',
                        async (addLanguageClass) => {
                            const handler = await CodeHandler.create(backend, {
                                addLanguageClass,
                            });
                            const output = await handler.process('let a;', {
                                lang: 'js',
                            });
                            if (addLanguageClass === true) {
                                expect(output.processed).toContain(
                                    'class="language-js"',
                                );
                            } else if (isString(addLanguageClass)) {
                                expect(output.processed).toContain(
                                    `class="${addLanguageClass}js"`,
                                );
                            } else {
                                expect(output.processed).not.toMatch(
                                    /class=".*(js|javascript)("| .*")/u,
                                );
                            }
                        },
                    );
                });
                if (backend === 'shiki') {
                    describe('theme', () => {
                        fuzzyTest.concurrent.prop(
                            [
                                fc.constantFrom(...Object.keys(bundledThemes)),
                                fc.constantFrom(
                                    ...Object.keys(bundledLanguages),
                                ),
                                codeArbitrary,
                                fc.boolean(),
                            ],
                            { verbose: 2 },
                        )(
                            'fuzzy: (theme, lang, inline, code)',
                            async (theme, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        // a11y is exercised separately; keep it
                                        // off here so the <pre> class assertion
                                        // matches from the start of the string.
                                        a11y: false,
                                        shiki: { theme },
                                    },
                                );
                                const output = await handler.process(code, {
                                    inline,
                                    lang,
                                });
                                expect(output).toBeDefined();
                                let pre;
                                if (inline) {
                                    pre = `<code class="language-${escapeStringForRegExp(lang)} `;
                                } else {
                                    pre = `<pre class="`;
                                }
                                expect(output.processed).toMatch(
                                    new RegExp(`^${pre}shiki ${theme}`, 'u'),
                                );
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            },
                        );
                    });
                    describe('themes', () => {
                        fuzzyTest.concurrent.prop(
                            [
                                fc.constantFrom(...Object.keys(bundledThemes)),
                                fc.dictionary(
                                    fc.stringMatching(/^[\w-]+$/u),
                                    fc.constantFrom(
                                        ...Object.keys(bundledThemes),
                                    ),
                                    { maxKeys: 5, minKeys: 1 },
                                ),
                                fc.constantFrom(
                                    ...Object.keys(bundledLanguages),
                                ),
                                codeArbitrary,
                                fc.boolean(),
                            ],
                            { verbose: 2 },
                        )(
                            'fuzzy: (themes, lang, inline, code)',
                            async (light, otherThemes, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        a11y: false,
                                        shiki: {
                                            themes: {
                                                light,
                                                ...otherThemes,
                                            },
                                        },
                                    },
                                );
                                const output = await handler.process(code, {
                                    inline,
                                    lang,
                                });
                                expect(output).toBeDefined();
                                const str = Object.values(otherThemes)
                                    .map(escapeStringForRegExp)
                                    .join(' ');
                                let pre;
                                if (inline) {
                                    pre = `<code class="language-${escapeStringForRegExp(lang)} `;
                                } else {
                                    pre = `<pre class="`;
                                }
                                expect(output.processed).toMatch(
                                    // eslint-disable-next-line require-unicode-regexp
                                    new RegExp(
                                        `^${pre}shiki shiki-themes ${light}${str ? ' ' + str : ''}`,
                                    ),
                                );
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            },
                        );
                    });
                }
                if (backend !== 'escape') {
                    describe('inline syntax highlighting', () => {
                        test('w/ language flag set internally', async () => {
                            type PossibleBackend = typeof backend;
                            let handler: CodeHandler<typeof backend>;
                            if (backend === 'shiki') {
                                handler = (await CodeHandler.create(backend, {
                                    shiki: { theme: 'github-light' },
                                })) as CodeHandler<PossibleBackend>;
                            } else {
                                handler = (await CodeHandler.create(backend, {
                                    theme: { type: 'none' },
                                    ...(backend === 'starry-night'
                                        ? { languages: 'common' }
                                        : {}),
                                })) as CodeHandler<PossibleBackend>;
                            }
                            const output = await handler.process(
                                'const x = 3;',
                                {
                                    inline: true,
                                    lang: 'js',
                                },
                            );
                            expect(output).toBeDefined();
                            if (backend === 'shiki') {
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            } else {
                                expect(output.processed).toContain(
                                    '<span class=',
                                );
                            }
                        });
                        test.each([
                            'js',
                            '{js}',
                            '{js a b=false c}',
                            'someAlias',
                        ])(
                            'w/ language flag set ad hoc (`%s ...`)',
                            async (str) => {
                                type PossibleBackend = typeof backend;
                                let handler: CodeHandler<typeof backend>;
                                if (backend === 'shiki') {
                                    handler = (await CodeHandler.create(
                                        backend,
                                        {
                                            shiki: { theme: 'github-light' },
                                            langAlias: {
                                                someAlias: 'javascript',
                                            },
                                        },
                                    )) as CodeHandler<PossibleBackend>;
                                } else {
                                    handler = (await CodeHandler.create(
                                        backend,
                                        {
                                            theme: { type: 'none' },
                                            langAlias: {
                                                someAlias: 'javascript',
                                            },
                                            ...(backend === 'starry-night'
                                                ? { languages: 'common' }
                                                : {}),
                                        },
                                    )) as CodeHandler<PossibleBackend>;
                                }

                                const output = await handler.process(
                                    `${str} const x = 3;`,
                                    { inline: true },
                                );
                                expect(output).toBeDefined();
                                if (backend === 'shiki') {
                                    expect(output.processed).toContain(
                                        ' <span style="color:',
                                    );
                                } else {
                                    expect(output.processed).toContain(
                                        ' <span class=',
                                    );
                                }
                            },
                        );
                    });
                }
                describe('appendNewline', () => {
                    test.each([
                        [true, 'appends \\n'],
                        [false, "doesn't append \\n"],
                    ])('%o → %s', async (appendNewline) => {
                        const handler = await CodeHandler.create(backend, {
                            a11y: false,
                            appendNewline,
                            ...(backend === 'starry-night' ||
                            backend === 'highlight.js'
                                ? { theme: { type: 'none' } }
                                : {}),
                        });
                        const output = await handler.process('const x = 3;', {
                            inline: false,
                        });
                        if (appendNewline) {
                            expect(output.processed).toContain('\n');
                        } else {
                            expect(output.processed).not.toContain('\n');
                        }
                    });
                    if (
                        backend === 'starry-night' ||
                        backend === 'highlight.js' ||
                        backend === 'escape'
                    ) {
                        test.each([true, false])(
                            '%o → empty string stays empty',
                            async (appendNewline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        a11y: false,
                                        appendNewline,
                                        ...(backend === 'starry-night' ||
                                        backend === 'highlight.js'
                                            ? { theme: { type: 'none' } }
                                            : {}),
                                    },
                                );
                                expect(
                                    (
                                        await handler.process('', {
                                            inline: true,
                                        })
                                    ).processed,
                                ).toMatch(
                                    /^<code[^>]*?>(<span><\/span>)?<\/code>$/su,
                                );
                                expect(
                                    (
                                        await handler.process('', {
                                            inline: false,
                                        })
                                    ).processed,
                                ).toMatch(
                                    /^<pre[^>]*?><code[^>]*?>(<span><\/span>)?<\/code><\/pre>$/su,
                                );
                            },
                        );
                    }
                });
            });
        }
    });
});

describe('fixtures', () => {
    describe.each([
        [
            'starry-night',
            [
                [
                    { languages: 'common' },
                    [
                        [
                            '```js\nlet a\n```',
                            '<pre><code class="language-js"><span class="pl-k">let</span> a\n</code></pre>',
                        ],
                    ],
                ],
                [
                    { languages: 'common' },
                    [
                        [
                            '```tex\n\\example\n```',
                            '<pre><code class="language-tex">\\example\n</code></pre>',
                        ],
                    ],
                ],
                [
                    {
                        languages: ['common', 'tex'],
                    },
                    [
                        [
                            '```tex\n\\example\n```',
                            '<pre><code class="language-tex"><span class="pl-c1">\\example</span>\n</code></pre>',
                        ],
                    ],
                ],
                [
                    {
                        languages: ['common'],
                    },
                    [
                        [
                            '```ebnf\na ::= b\n```',
                            '<pre><code class="language-ebnf">a ::= b\n</code></pre>',
                        ],
                    ],
                ],
                [
                    {
                        languages: 'all',
                    },
                    [
                        [
                            '```ebnf\na ::= b\n```',
                            '<pre><code class="language-ebnf"><span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                        ],
                    ],
                ],
                [
                    { languages: 'all' },
                    [
                        [
                            '```custom-language\nsomething a\n```',
                            '<pre><code class="language-custom-language">something a\n</code></pre>',
                        ],
                    ],
                ],
                [
                    {
                        languages: [
                            {
                                extensions: ['.custom'],
                                names: ['Custom Language', 'custom-language'],
                                patterns: [
                                    {
                                        match: '\\b(something)\\b',
                                        name: 'keyword',
                                    },
                                ],
                                scopeName: 'source.custom',
                            },
                        ],
                    },
                    [
                        [
                            '```custom-language\nsomething a\n```',
                            '<pre><code class="language-custom-language"><span class="pl-k">something</span> a\n</code></pre>',
                        ],
                    ],
                ],
            ],
        ],
        [
            'shiki',
            [
                [
                    { shiki: { theme: 'red' } },
                    [['```js\nlet a = 1;\n```', '<span style="']],
                ],
                [
                    { shiki: { themes: { light: 'red' } } },
                    [['```js\nlet a = 1;\n```', '<span style="']],
                ],
                [
                    { shiki: { theme: { name: 'custom' } } },
                    [['```js\nlet a = 1;\n```', '<span style="']],
                ],
                [
                    { shiki: { themes: { light: { name: 'custom' } } } },
                    [['```js\nlet a = 1;\n```', '<span style="']],
                ],
                [
                    {
                        shiki: {
                            theme: 'github-dark-default',
                            transformers: [
                                {
                                    code: (hast) => {
                                        hast.properties['className'] = [
                                            'test-class',
                                        ];
                                        return hast;
                                    },
                                },
                            ],
                        },
                    },
                    [
                        [
                            '```js\nlet a = 1;\n```',
                            '<code class="language-js test-class">',
                        ],
                    ],
                ],
                [
                    {
                        shiki: {
                            theme: 'github-dark-default',
                            transformers: [
                                shikiTransformerNotationDiff(),
                                shikiTransformerMetaHighlight(),
                            ],
                        },
                    },
                    [
                        [
                            '```js {1,3-4}\nlet a = 1;\nlet b = 2; // [!code --]\nlet c = 3; // [!code ++]\nlet d = 4;\n```',
                            '<span class="line highlighted diff add">',
                        ],
                    ],
                ],
            ],
        ],
        [
            'none',
            [
                [undefined, [['```js\nlet a\n```', '\nlet a']]],
                [null, [['```js\nlet a\n```', '\nlet a']]],
                [{}, [['```js\nlet a\n```', '\nlet a']]],
                [
                    {
                        transformers: {
                            pre: ['var', 'let'],
                            post: [/$/mu, '\n // comment'],
                        },
                    },
                    [['```js\nvar a\n```', '\nlet a\n']],
                ],
            ],
        ],
    ] as [
        CodeBackend,
        [CodeConfiguration<CodeBackend> | undefined, [string, string][]][],
    ][])('CodeHandler<%o>', (codeBackend, tests) => {
        test.each(tests)('%o', async (configuration, samples) => {
            const processor = await sveltex(
                { codeBackend },
                // a11y is covered separately; disable it here so these fixture
                // assertions match the bare rendered output.
                { code: { ...(configuration ?? {}), a11y: false } },
            );
            for (const [input, expected] of samples) {
                const output = (
                    await processor.markup({
                        filename: generateId() + '.sveltex',
                        content: input,
                    })
                )?.code;
                expect(output).toContain(expected);
            }
        });
    });
});

describe('CodeHandler edge cases', () => {
    let log: MockInstance;
    let writeFileEnsureDir: MockInstance;
    let existsSync: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['log', 'writeFileEnsureDir', 'existsSync']);
        log = mocks.log;
        writeFileEnsureDir = mocks.writeFileEnsureDir;
        existsSync = mocks.existsSync;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    beforeEach(() => {
        // Pretend no CSS file is on disk yet, so that CSS handling always
        // attempts a fetch + write (and is deterministic across runs).
        existsSync.mockReturnValue(false);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('handleCss', () => {
        test('concurrent calls only handle CSS once', async () => {
            const handler = await CodeHandler.create('highlight.js', {
                theme: { type: 'self-hosted' },
            });
            // Kick off two `process` calls without awaiting the first one, so
            // that the second call observes `_handlingCss === true` and has to
            // wait via the polling interval.
            const first = handler.process('let a;', { lang: 'js' });
            const second = handler.process('let b;', { lang: 'js' });
            const [r1, r2] = await Promise.all([first, second]);
            expect(r1.processed).toContain('hljs');
            expect(r2.processed).toContain('hljs');
            // CSS should have been fetched and written exactly once, despite
            // two concurrent `process` calls.
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            // Subsequent calls should be no-ops (CSS already handled).
            await handler.process('let c;', { lang: 'js' });
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
        });

        test('starry-night self-hosted CSS with non-default theme name', async () => {
            const fancyFetch = vi
                .spyOn(await import('../../../src/utils/cdn.js'), 'fancyFetch')
                .mockResolvedValue('.pl-c { color: green; }');
            const handler = await CodeHandler.create('starry-night', {
                theme: { type: 'self-hosted', name: 'high-contrast' },
            });
            await handler.process('let a;', { lang: 'js' });
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            // The resource name embeds the non-default theme name.
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('high-contrast-both.css'),
                expect.stringContaining('color:'),
            );
            fancyFetch.mockRestore();
        });

        test('highlight.js self-hosted CSS with min: false', async () => {
            const handler = await CodeHandler.create('highlight.js', {
                theme: { type: 'self-hosted', min: false, name: 'github-dark' },
            });
            await handler.process('let a;', { lang: 'js' });
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            // With `min: false`, the resource name has no `.min` segment.
            const [path] = writeFileEnsureDir.mock.calls[0] as [string, string];
            expect(path).toContain('github-dark.css');
            expect(path).not.toContain('.min.css');
        });

        test('highlight.js cdn theme sets headLines', async () => {
            const handler = await CodeHandler.create('highlight.js', {
                theme: { type: 'cdn', name: 'github-dark' },
            });
            await handler.process('let a;', { lang: 'js' });
            expect(handler.headLines).toHaveLength(1);
            expect(handler.headLines[0]).toMatch(
                /^<link rel="stylesheet" href="https?:\/\/.*github-dark.*\.css">$/u,
            );
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
        });
    });

    describe('scriptLines', () => {
        test('is an empty array by default', async () => {
            const handler = await CodeHandler.create('highlight.js');
            expect(handler.scriptLines).toEqual([]);
        });
    });

    describe('transformers', () => {
        test('falsy pre/post transformers are skipped', async () => {
            // `transformers.pre` and `transformers.post` are both nullish, so
            // the corresponding `applyTransformations` calls are skipped.
            const handler = await CodeHandler.create('none', {
                transformers: {
                    pre: null,
                    post: null,
                },
            });
            const output = await handler.process('var a = 1;', {
                inline: false,
            });
            // No transformation applied: the code is returned verbatim by the
            // `none` backend.
            expect(output.processed).toBe('var a = 1;');
        });
    });

    describe('cdn theme with empty cdn list', () => {
        test('highlight.js: no headLines are set when cdn list is empty', async () => {
            const handler = await CodeHandler.create('highlight.js', {
                theme: { type: 'cdn', cdn: [] as unknown as SupportedCdn },
            });
            await handler.process('let a;', { lang: 'js' });
            // With no CDNs configured there is no stylesheet link to emit.
            expect(handler.headLines).toEqual([]);
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
        });
    });

    describe('inlineMeta disabled', () => {
        test.each(['highlight.js', 'starry-night', 'shiki'] as const)(
            '%s: inline processing works when inlineMeta is null',
            async (backend) => {
                // `inlineMeta: null` disables ad-hoc inline meta parsing, so
                // `inlineParsed` is undefined and the `if (inlineParsed)` arm
                // is skipped.
                const handler = await CodeHandler.create(backend, {
                    inlineMeta: null,
                    ...(backend === 'shiki'
                        ? { shiki: { theme: 'github-light' } }
                        : { theme: { type: 'none' } }),
                });
                const output = await handler.process('{js} const x = 3;', {
                    inline: true,
                });
                expect(output).toBeDefined();
                // Inline output is always wrapped in a single `<code>` element.
                expect(output.processed).toMatch(/^<code[^>]*>.*<\/code>$/su);
                // Since inline meta parsing is off, the `{js}` prefix is not
                // stripped and is treated as part of the code.
                expect(output.processed).toContain('js');
            },
        );
    });

    describe('shiki theme objects without a name', () => {
        test('single theme object without a name', async () => {
            const handler = await CodeHandler.create('shiki', {
                a11y: false,
                shiki: { theme: { settings: [], bg: '#fff', fg: '#000' } },
            });
            const output = await handler.process('let a = 1;', { lang: 'js' });
            expect(output).toBeDefined();
            // A nameless theme contributes no extra class beyond `shiki`.
            expect(output.processed).toMatch(/^<pre class="shiki\s*"/u);
            expect(output.processed).toContain('<span style="color:');
        });

        test('themes map containing a theme object without a name', async () => {
            const handler = await CodeHandler.create('shiki', {
                a11y: false,
                shiki: {
                    themes: {
                        light: { settings: [], bg: '#fff', fg: '#000' },
                    },
                },
            });
            const output = await handler.process('let a = 1;', { lang: 'js' });
            expect(output).toBeDefined();
            // The nameless theme adds no class, but `shiki-themes` is present.
            expect(output.processed).toMatch(
                /^<pre class="shiki shiki-themes\s*"/u,
            );
        });
    });

    describe('shiki block a11y (default on)', () => {
        test('adds tabindex, role=figure, a language-aware aria-label, and a scoped svelte-ignore by default', async () => {
            const handler = await CodeHandler.create('shiki');
            const output = await handler.process('const x = 1;', {
                lang: 'ts',
                inline: false,
            });
            expect(output.processed).toContain('tabindex="0"');
            expect(output.processed).toContain('role="figure"');
            expect(output.processed).toContain(
                'aria-label="TypeScript code block"',
            );
            expect(output.processed).toContain(
                '<!-- svelte-ignore a11y_no_noninteractive_tabindex -->',
            );
        });
        test('uses a generic label for a plain (languageless) block', async () => {
            const handler = await CodeHandler.create('shiki');
            const output = await handler.process('plain text', {
                inline: false,
            });
            expect(output.processed).toContain('aria-label="Code block"');
        });
        test('leaves inline code untouched', async () => {
            const handler = await CodeHandler.create('shiki');
            const output = await handler.process('const x = 1;', {
                lang: 'ts',
                inline: true,
            });
            expect(output.processed).not.toContain('tabindex');
            expect(output.processed).not.toContain('svelte-ignore');
            expect(output.processed).not.toContain('role=');
        });
        test('a11y:false adds no attributes or comment', async () => {
            const handler = await CodeHandler.create('shiki', { a11y: false });
            const output = await handler.process('const x = 1;', {
                lang: 'ts',
                inline: false,
            });
            expect(output.processed).not.toContain('tabindex');
            expect(output.processed).not.toContain('role=');
            expect(output.processed).not.toContain('aria-label');
            expect(output.processed).not.toContain('svelte-ignore');
        });
        test('honors a custom role and label', async () => {
            const handler = await CodeHandler.create('shiki', {
                a11y: {
                    role: 'region',
                    label: ({ name }) => `${name ?? 'Code'} sample`,
                },
            });
            const output = await handler.process('const x = 1;', {
                lang: 'ts',
                inline: false,
            });
            expect(output.processed).toContain('role="region"');
            expect(output.processed).toContain('aria-label="TypeScript sample"');
        });
        test('resolves the aria-label language through langAlias', async () => {
            const handler = await CodeHandler.create('shiki', {
                langAlias: { mylang: 'typescript' },
            });
            const output = await handler.process('const x = 1;', {
                lang: 'mylang',
                inline: false,
            });
            expect(output.processed).toContain(
                'aria-label="TypeScript code block"',
            );
        });
    });

    describe('shiki inline code without a language', () => {
        test('no language class is added when language is undefined', async () => {
            const handler = await CodeHandler.create('shiki', {
                shiki: { theme: 'github-light' },
            });
            const output = await handler.process('const x = 3;', {
                inline: true,
            });
            expect(output).toBeDefined();
            // No `lang` was supplied, so no `language-*` class is prepended.
            expect(output.processed).not.toMatch(/class="[^"]*language-/u);
            expect(output.processed).toMatch(/^<code class="shiki[^"]*">/u);
        });
    });

    describe('shiki block code whose <code> tag was removed by a transformer', () => {
        test('language class injection is skipped when there is no <code> tag', async () => {
            // A transformer renames the inner `<code>` element to `<div>`, so
            // the regex looking for a `<code>` tag finds no match and the
            // language-class injection step is skipped entirely.
            const handler = await CodeHandler.create('shiki', {
                shiki: {
                    theme: 'github-light',
                    transformers: [
                        {
                            code(hast) {
                                hast.tagName = 'div';
                                return hast;
                            },
                        },
                    ],
                },
            });
            const output = await handler.process('const x = 3;', {
                inline: false,
                lang: 'js',
            });
            expect(output).toBeDefined();
            // The `<code>` tag is gone (renamed to `<div>`)...
            expect(output.processed).not.toContain('<code');
            expect(output.processed).toContain('<div>');
            // ...so no `language-js` class could be injected onto it.
            expect(output.processed).not.toContain('language-js');
        });
    });

    describe('none backend', () => {
        test('can be created without a configuration argument', async () => {
            // Exercises the `userConfig ?? {}` default in the `none` branch.
            const handler = await CodeHandler.create('none');
            const output = await handler.process('let a = 1;', {
                inline: false,
            });
            expect(output.processed).toBe('let a = 1;');
        });
    });

    describe('escape backend with escaping disabled', () => {
        test('escape.html and escape.braces both false: passthrough', async () => {
            const handler = await CodeHandler.create('escape', {
                a11y: false,
                escape: { html: false, braces: false },
                appendNewline: false,
            });
            const output = await handler.process('<b>{x}</b>', {
                inline: false,
            });
            // Neither HTML nor braces are escaped.
            expect(output.processed).toBe('<pre><code><b>{x}</b></code></pre>');
        });

        test('escape.html true but escape.braces false', async () => {
            const handler = await CodeHandler.create('escape', {
                escape: { html: true, braces: false },
            });
            const output = await handler.process('<b>{x}</b>', {
                inline: false,
            });
            // HTML is escaped, braces are left as-is.
            expect(output.processed).toContain('&lt;b&gt;');
            expect(output.processed).toContain('{x}');
            expect(output.processed).not.toContain('&lbrace;');
        });

        test('escape.html false but escape.braces true', async () => {
            const handler = await CodeHandler.create('escape', {
                escape: { html: false, braces: true },
            });
            const output = await handler.process('<b>{x}</b>', {
                inline: false,
            });
            // Braces are escaped, HTML is left as-is.
            expect(output.processed).toContain('<b>');
            expect(output.processed).toContain('&lbrace;x&rbrace;');
            expect(output.processed).not.toContain('&lt;b&gt;');
        });
    });

    describe('unknown-language warnings', () => {
        test('highlight.js warns for unknown language flag', async () => {
            const handler = await CodeHandler.create('highlight.js', {
                theme: { type: 'none' },
            });
            const output = await handler.process('let a = 1;', {
                lang: 'this-is-not-a-real-language',
            });
            // Unknown language => content is merely HTML-escaped, not
            // highlighted.
            expect(output.processed).not.toContain('hljs-');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                'warn',
                expect.stringContaining(
                    "Language 'this-is-not-a-real-language' not found.",
                ),
            );
        });

        test('shiki warns for unknown language flag', async () => {
            const handler = await CodeHandler.create('shiki', {
                shiki: { theme: 'github-light' },
            });
            const output = await handler.process('let a = 1;', {
                lang: 'this-is-not-a-real-language',
            });
            expect(output).toBeDefined();
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                'warn',
                expect.stringContaining(
                    'Language "this-is-not-a-real-language" not found.',
                ),
            );
            // Even with an unknown language, the language class is still added.
            expect(output.processed).toContain(
                'language-this-is-not-a-real-language',
            );
        });
    });

    describe('missing dependencies', () => {
        test('highlight.js: rethrows import error and records missing dep', async () => {
            const { missingDeps } = await import('../../../src/utils/env.js');
            missingDeps.length = 0;
            vi.doMock('highlight.js', () => {
                throw new Error('highlight.js not found');
            });
            // `CodeHandler.create` should not swallow the failure to import
            // `highlight.js`; it rethrows after recording the missing dep.
            await expect(CodeHandler.create('highlight.js')).rejects.toThrow();
            expect(missingDeps).toContain('highlight.js');
            vi.doUnmock('highlight.js');
            missingDeps.length = 0;
        });

        test('starry-night: rethrows import error and records missing deps', async () => {
            const { missingDeps } = await import('../../../src/utils/env.js');
            missingDeps.length = 0;
            vi.doMock('@wooorm/starry-night', () => {
                throw new Error('@wooorm/starry-night not found');
            });
            await expect(CodeHandler.create('starry-night')).rejects.toThrow();
            expect(missingDeps).toContain('@wooorm/starry-night');
            expect(missingDeps).toContain('hast-util-find-and-replace');
            expect(missingDeps).toContain('hast-util-to-html');
            vi.doUnmock('@wooorm/starry-night');
            missingDeps.length = 0;
        });

        test('shiki: rethrows import error and records missing dep', async () => {
            const { missingDeps } = await import('../../../src/utils/env.js');
            missingDeps.length = 0;
            vi.doMock('shiki', () => {
                throw new Error('shiki not found');
            });
            await expect(CodeHandler.create('shiki')).rejects.toThrow();
            expect(missingDeps).toContain('shiki');
            vi.doUnmock('shiki');
            missingDeps.length = 0;
        });
    });
});
