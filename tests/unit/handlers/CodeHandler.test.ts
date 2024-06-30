import {
    describe,
    test,
    expect,
    vi,
    beforeAll,
    type MockInstance,
    afterAll,
    afterEach,
} from 'vitest';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';
import type { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
import { codeBackends } from '$utils/diagnosers/backendChoices.js';
import { getDefaultCodeConfig } from '$base/defaults.js';
import { nodeAssert, uuid } from '$deps.js';
import { isFunction, isString } from '$typeGuards/utils.js';
import { mergeConfigs } from '$utils/merge.js';
import { bundledLanguages, bundledThemes } from 'shiki';

import {
    fuzzyTest,
    fc,
    shikiTransformerMetaHighlight,
    shikiTransformerNotationDiff,
} from '$dev_deps.js';
import { escapeStringForRegExp } from '$utils/escape.js';
import { sveltex } from '$base/Sveltex.js';
import type { SupportedCdn } from '$types/handlers/Css.js';
import { supportedCdns } from '$typeGuards/code.js';
import { spy } from '$tests/unit/fixtures.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

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
                        post: [() => '', ['a', 'b'], [/a/, 'b']],
                        pre: [/a/, 'b'],
                    },
                } as CodeConfiguration<CodeBackend>,
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
            expect(JSON.stringify(handler)).not.toMatch(/circular|circle/i);
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

describe.concurrent.each(codeBackends)('CodeHandler<%o>', (backend) => {
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
                        /^<pre[^>]*?><code[^>]*?>.*<\/code[^>]*?><\/pre[^>]*?>/s,
                    );
                });
            }
        });
        if (backend !== 'none') {
            describe('features', () => {
                if (backend === 'starry-night' || backend === 'highlight.js') {
                    describe.sequential('generates CSS on first run', () => {
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
                            const handler = await CodeHandler.create(backend, {
                                theme: { type: 'self-hosted', cdn },
                            });
                            await handler.process('', {});
                            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
                            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                                1,
                                expect.stringMatching(
                                    new RegExp(`sveltex/${backend}@.*\\.css`),
                                ),
                                expect.stringContaining('color:'),
                            );
                            await handler.process('', {});
                            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
                        });

                        test("shouldn't write CSS if configuration.theme.type is none", async () => {
                            const handler = await CodeHandler.create(backend, {
                                theme: { type: 'none' },
                            });
                            await handler.process('', {});
                            expect(log).not.toHaveBeenCalled();
                            expect(writeFileEnsureDir).not.toHaveBeenCalled();
                            expect(existsSync).not.toHaveBeenCalled();
                        });

                        test("shouldn't write CSS if configuration is not valid", async () => {
                            const handler = await CodeHandler.create(backend, {
                                theme: 123 as unknown as { type: 'none' },
                            });
                            await handler.process('', {});
                            expect(log).toHaveBeenCalledTimes(1);
                            expect(writeFileEnsureDir).not.toHaveBeenCalled();
                            expect(existsSync).not.toHaveBeenCalled();
                        });

                        test("should work even if version can't be fetched", async () => {
                            const getVersionMock = vi
                                .spyOn(
                                    await import('$utils/env.js'),
                                    'getVersion',
                                )
                                .mockResolvedValueOnce(undefined);
                            const handler = await CodeHandler.create(backend, {
                                theme: { type: 'self-hosted' },
                            });
                            await handler.process('', {});
                            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
                            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                                1,
                                expect.stringMatching(
                                    new RegExp(
                                        `static/sveltex/${backend}@latest.*\\.css`,
                                    ),
                                ),
                                expect.stringContaining('color:'),
                            );
                            getVersionMock.mockRestore();
                        });

                        test("should return early if CSS can't be fetched", async () => {
                            const fetchCssMock = vi
                                .spyOn(
                                    await import('$utils/cdn.js'),
                                    'fancyFetch',
                                )
                                .mockResolvedValueOnce(undefined);
                            const handler = await CodeHandler.create(backend, {
                                theme: { type: 'self-hosted' },
                            });
                            await handler.process('', {});
                            expect(writeFileEnsureDir).toHaveBeenCalledTimes(0);
                            fetchCssMock.mockRestore();
                        });

                        test('should return early if CSS file is already present', async () => {
                            const fetchCssMock = vi
                                .spyOn(
                                    await import('$utils/cdn.js'),
                                    'fancyFetch',
                                )
                                .mockResolvedValueOnce(undefined);
                            existsSync.mockReturnValueOnce(true);
                            const handler = await CodeHandler.create(backend, {
                                theme: { type: 'self-hosted' },
                            });
                            await handler.process('', {});
                            expect(writeFileEnsureDir).toHaveBeenCalledTimes(0);
                            fetchCssMock.mockRestore();
                        });
                    });
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
                            ).toMatch(new RegExp(escaped.join('|')));
                            if (backend !== 'escape') {
                                expect(
                                    (
                                        await handler.process(`a ${char} b`, {
                                            lang: 'js',
                                        })
                                    ).processed,
                                ).toMatch(new RegExp(escaped.join('|')));
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
                                    /class=".*(js|javascript)("| .*")/,
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
                                fc.fullUnicodeString({ minLength: 1 }),
                                fc.boolean(),
                            ],
                            { errorWithCause: true, verbose: 2 },
                        )(
                            'fuzzy: (theme, lang, inline, code)',
                            async (theme, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
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
                                    new RegExp(`^${pre}shiki ${theme}`),
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
                                    fc.stringMatching(/^[\w-]+$/),
                                    fc.constantFrom(
                                        ...Object.keys(bundledThemes),
                                    ),
                                    { maxKeys: 5, minKeys: 1 },
                                ),
                                fc.constantFrom(
                                    ...Object.keys(bundledLanguages),
                                ),
                                fc.fullUnicodeString({ minLength: 1 }),
                                fc.boolean(),
                            ],
                            { errorWithCause: true, verbose: 2 },
                        )(
                            'fuzzy: (themes, lang, inline, code)',
                            async (light, otherThemes, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
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
                                        '<span style="color:',
                                    );
                                } else {
                                    expect(output.processed).toContain(
                                        '<span class=',
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
                            post: [/$/m, '\n // comment'],
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
                { code: configuration },
            );
            for (const [input, expected] of samples) {
                const output = (
                    await processor.markup({
                        filename: uuid() + '.sveltex',
                        content: input,
                    })
                )?.code;
                expect(output).toContain(expected);
            }
        });
    });
});
