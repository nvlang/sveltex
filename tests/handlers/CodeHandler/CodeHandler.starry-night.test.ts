import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    afterAll,
    beforeAll,
    type MockInstance,
} from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';
import { spy } from '$tests/fixtures.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe.concurrent("CodeHandler<'starry-night'>", () => {
    fixture();

    let handler: CodeHandler<'starry-night'>;
    let writeFileEnsureDir: MockInstance;

    beforeAll(async () => {
        handler = await CodeHandler.create('starry-night', {
            languages: 'common',
        });
        const mocks = await spy(['writeFileEnsureDir', 'existsSync'], true);
        writeFileEnsureDir = mocks.writeFileEnsureDir;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

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
            const handler = await CodeHandler.create('starry-night', {
                theme: { type: 'self-hosted' },
            });
            (await handler.process('')).processed;
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(/src\/sveltex\/starry-night@.*\.css/),
                expect.stringContaining(':root'),
            );
            (await handler.process('')).processed;
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
                const output = (await handler.process('let a', { lang: 'js' }))
                    .processed;
                const expected =
                    '<pre><code class="language-js"><span class="pl-k">let</span> a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('defaults to no language', async () => {
                const output = (await handler.process('let a')).processed;
                const expected =
                    '<pre><code class="language-text">let a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('processes plaintext correctly', async () => {
                const output = (
                    await handler.process('let a', {
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre><code class="language-plaintext">let a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const handler = await CodeHandler.create('starry-night', {
                    languages: 'all',
                });
                const output = (
                    await handler.process('a <b> {c}', {
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre><code class="language-plaintext">a &lt;b&gt; &lbrace;c&rbrace;\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in JS code correctly', async () => {
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { lang: 'js' },
                    )
                ).processed;
                const expected =
                    '<pre><code class="language-js"><span class="pl-k">const</span> <span class="pl-c1">a</span> <span class="pl-k">=</span> <span class="pl-k">new</span> <span class="pl-en">Map</span><span class="pl-k">&lt;</span>string, &lbrace;prop<span class="pl-k">:</span> number&rbrace;<span class="pl-k">&gt;</span>();\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe.sequential('configure()', () => {
            fixture();
            const consoleWarnMock = vi.spyOn(consoles, 'warn');
            // .mockImplementation(() => undefined);
            const consoleErrorMock = vi.spyOn(consoles, 'error');
            // .mockImplementation(() => undefined);

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
                    (await handler.process('\\example', { lang: 'tex' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-tex">\\example\n</code></pre>',
                );
                await handler.configure({
                    languages: ['TeX'],
                });
                expect(
                    (await handler.process('\\example', { lang: 'tex' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-tex"><span class="pl-c1">\\example</span>\n</code></pre>',
                );
                expect(
                    (await handler.process('a ::= b', { lang: 'ebnf' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-ebnf">a ::= b\n</code></pre>',
                );

                await handler.configure({ languages: 'all' });
                expect(
                    (await handler.process('a ::= b', { lang: 'ebnf' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-ebnf"><span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                );
                // can't "unload" languages though...
                await handler.configure({ languages: [] });
                expect(
                    (await handler.process('a ::= b', { lang: 'ebnf' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-ebnf"><span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
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
                const handler = await CodeHandler.create('starry-night', {});
                expect(
                    (await handler.process('a ::= b', { lang: 'ebnf' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-ebnf">a ::= b\n</code></pre>',
                );
                expect(consoleWarnMock).toHaveBeenCalledTimes(1);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Language "ebnf" not found.'),
                );
                await handler.configure({ languages: ['EBNF'] });
                expect(
                    (await handler.process('a ::= b', { lang: 'ebnf' }))
                        .processed,
                ).toEqual(
                    '<pre><code class="language-ebnf"><span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>\n</code></pre>',
                );
            });

            it('can add new custom languages', async () => {
                const handler = await CodeHandler.create('starry-night', {});
                expect(
                    (
                        await handler.process('something a', {
                            lang: 'custom-language',
                        })
                    ).processed,
                ).toEqual(
                    '<pre><code class="language-custom-language">something a\n</code></pre>',
                );
                expect(consoleWarnMock).toHaveBeenCalledTimes(1);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining(
                        'Language "custom-language" not found.',
                    ),
                );
                await handler.configure({
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
                });
                expect(
                    (
                        await handler.process('something a', {
                            lang: 'custom-language',
                        })
                    ).processed,
                ).toEqual(
                    '<pre><code class="language-custom-language"><span class="pl-k">something</span> a\n</code></pre>',
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
    });

    describe.concurrent('backend', () => {
        fixture();
        it("is 'starry-night'", () => {
            expect(handler.backend).toBe('starry-night');
        });
    });
});
