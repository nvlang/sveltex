/* eslint-disable vitest/no-commented-out-tests */
import {
    suite,
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    afterAll,
} from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { getDefaultCodeConfiguration } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';
import { isFunction } from '$type-guards/utils.js';
import { spy } from '$tests/fixtures.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

suite.concurrent("CodeHandler<'starry-night'>", async () => {
    fixture();
    const { writeFileEnsureDir } = await spy(
        ['writeFileEnsureDir', 'existsSync'],
        true,
    );
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const handler = await CodeHandler.create('starry-night');
    await handler.configure({ languages: 'common' });

    describe.concurrent("CodeHandler.create('starry-night')", () => {
        fixture();
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe('css', () => {
        fixture();
        it('fetches and generates CSS if run for the first time', async () => {
            const handler = await CodeHandler.create('starry-night');
            await handler.configure({ theme: { type: 'self-hosted' } });
            await handler.process('');
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(/src\/sveltex\/starry-night@.*\.css/),
                expect.stringContaining(':root'),
            );
            await handler.process('');
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
        });
    });

    describe.concurrent('codeHandler', () => {
        fixture();
        describe.concurrent('process()', () => {
            fixture();
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('processes simple JS code correctly', async () => {
                const output = await handler.process('let a', { lang: 'js' });
                const expected =
                    '<pre><code class="language-js">\n<span class="pl-k">let</span> a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('processes plaintext correctly', async () => {
                const output = await handler.process('let a', {
                    lang: undefined,
                });
                const expected = '<pre><code>\nlet a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('parses info from delimiters if present', async () => {
                const codeList = [
                    'something',
                    'let a',
                    '/**\n * @remarks comment\n */\nconst a = new Map<string, {prop: number[]}>();',
                ];

                for (const code of codeList) {
                    await (async () => {
                        expect(
                            await handler.process('```\n' + code + '\n```'),
                        ).toEqual(
                            expect.stringMatching(
                                /^<pre><code class="language-plaintext">\n[\w\W]*\n<\/code><\/pre>$/,
                            ),
                        );
                        expect(await handler.process('`' + code + '`')).toEqual(
                            expect.stringMatching(
                                /^<code class="language-plaintext">[\w\W]*<\/code>$/,
                            ),
                        );
                        expect(
                            await handler.process('```js\n' + code + '\n```'),
                        ).toEqual(
                            expect.stringMatching(
                                /^<pre><code class="language-js">\n[\w\W]*\n<\/code><\/pre>$/,
                            ),
                        );
                        expect(
                            await handler.process(
                                '```javascript\n' + code + '\n```',
                            ),
                        ).toEqual(
                            expect.stringMatching(
                                /^<pre><code class="language-javascript">\n[\w\W]*\n<\/code><\/pre>$/,
                            ),
                        );
                    })();
                }
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = await handler.process('a <b> {c}', {
                    lang: 'plaintext',
                });
                const expected =
                    '<pre><code class="language-plaintext">\na &lt;b&gt; &lbrace;c&rbrace;\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in JS code correctly', async () => {
                const output = await handler.process(
                    'const a = new Map<string, {prop: number}>();',
                    { lang: 'js' },
                );
                const expected =
                    '<pre><code class="language-js">\n<span class="pl-k">const</span> <span class="pl-c1">a</span> <span class="pl-k">=</span> <span class="pl-k">new</span> <span class="pl-en">Map</span><span class="pl-k">&lt;</span>string, &lbrace;prop<span class="pl-k">:</span> number&rbrace;<span class="pl-k">&gt;</span>();\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe.sequential('configure()', () => {
            fixture();
            const consoleWarnMock = vi
                .spyOn(consoles, 'warn')
                .mockImplementation(() => undefined);
            const consoleErrorMock = vi
                .spyOn(consoles, 'error')
                .mockImplementation(() => undefined);

            beforeEach(() => {
                consoleWarnMock.mockClear();
                consoleErrorMock.mockClear();
            });

            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                expect(
                    await handler.process('\\example', { lang: 'tex' }),
                ).toEqual(
                    '<pre><code class="language-tex">\n\\example\n</code></pre>',
                );
                await handler.configure({
                    languages: ['text.tex.latex'],
                });
                expect(
                    await handler.process('\\example', { lang: 'tex' }),
                ).toEqual(
                    '<pre><code class="language-tex">\n<span class="pl-c1">\\example</span>\n</code></pre>',
                );
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<pre><code class="language-ebnf">\na ::= b\n</code></pre>',
                );

                await handler.configure({ languages: 'all' });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<pre><code class="language-ebnf">\n<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                );
                // can't unload languages though...
                await handler.configure({ languages: [] });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<pre><code class="language-ebnf">\n<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                );

                expect(consoleWarnMock).toHaveBeenCalledTimes(2);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Language "tex" not found.'),
                );
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    2,
                    expect.stringContaining('Language "ebnf" not found.'),
                );
            });

            it('can add new languages', async () => {
                const handler = await CodeHandler.create('starry-night');
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<pre><code class="language-ebnf">\na ::= b\n</code></pre>',
                );
                expect(consoleWarnMock).toHaveBeenCalledTimes(1);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Language "ebnf" not found.'),
                );
                await handler.configure({ languages: ['source.ebnf'] });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<pre><code class="language-ebnf">\n<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                );
            });

            it('can add new custom languages', async () => {
                const handler = await CodeHandler.create('starry-night');
                expect(
                    await handler.process('something a', {
                        lang: 'custom-language',
                    }),
                ).toEqual(
                    '<pre><code class="language-custom-language">\nsomething a\n</code></pre>',
                );
                expect(consoleWarnMock).toHaveBeenCalledTimes(1);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining(
                        'Language "custom-language" not found.',
                    ),
                );
                await handler.configure({
                    customLanguages: [
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
                });
                expect(
                    await handler.process('something a', {
                        lang: 'custom-language',
                    }),
                ).toEqual(
                    '<pre><code class="language-custom-language">\n<span class="pl-k">something</span> a\n</code></pre>',
                );
            });
        });

        describe.concurrent('processor', () => {
            fixture();
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe.concurrent('configuration', () => {
            fixture();
            it('is default', async () => {
                const handler = await CodeHandler.create('starry-night');
                expect('configuration' in handler).toBe(true);
                const defaultCC = getDefaultCodeConfiguration('starry-night');
                expect(
                    Object.entries(handler.configuration).filter(
                        ([, v]) => !isFunction(v),
                    ),
                ).toEqual(
                    Object.entries(defaultCC).filter(([, v]) => !isFunction(v)),
                );
                expect(
                    handler.configuration.wrap({ wrapClassPrefix: 'test-' }),
                ).toEqual(
                    defaultCC.wrap({
                        wrapClassPrefix: 'test-',
                    }),
                );
                expect(
                    handler.configuration.wrap({
                        wrapClassPrefix: 'test-',
                        inline: true,
                    }),
                ).toEqual(
                    defaultCC.wrap({
                        wrapClassPrefix: 'test-',
                        inline: true,
                    }),
                );
            });
        });
    });

    describe.concurrent('backend', () => {
        fixture();
        it("is 'starry-night'", () => {
            expect(handler.backend).toBe('starry-night');
        });
    });
});
