/* eslint-disable vitest/no-commented-out-tests */
import {
    suite,
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest';

import { CodeHandler } from '$handlers';
import { getDefaultCodeConfiguration } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';
import { isFunction } from '$type-guards/utils.js';
import { spy } from '$tests/fixtures.js';
import { v4 as uuid } from 'uuid';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

suite("CodeHandler<'highlight.js'>", async () => {
    fixture();
    const consoleErrorMock = vi
        .spyOn(consoles, 'error')
        .mockImplementation(() => undefined);
    vi.spyOn(consoles, 'warn').mockImplementation(() => undefined);
    const { writeFileEnsureDir, existsSync, log } = await spy(
        ['writeFileEnsureDir', 'writeFile', 'existsSync', 'log'],
        true,
    );
    afterAll(() => {
        vi.restoreAllMocks();
    });
    const handler = await CodeHandler.create('highlight.js');
    describe("CodeHandler.create('highlight.js')", () => {
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
            const handler = await CodeHandler.create('highlight.js');
            await handler.process('', {});
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/highlight\.js@.*(\.min)?\.css/,
                ),
                expect.stringContaining('pre code'),
            );
            await handler.process('', {});
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
        });

        it("logs a message if CSS couldn't be written", async () => {
            const id = uuid();
            writeFileEnsureDir.mockImplementationOnce(() => {
                throw new Error(id);
            });
            const handler = await CodeHandler.create('highlight.js');
            await handler.process('', {});
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(id),
            );
        });

        it("shouldn't write CSS if configuration.theme.write is false", async () => {
            const handler = await CodeHandler.create('highlight.js');
            await handler.configure({ theme: { write: false } });
            await handler.process('', {});
            expect(consoleErrorMock).toHaveBeenCalledTimes(0);
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(existsSync).not.toHaveBeenCalled();
        });

        it("shouldn't write CSS if configuration is not valid", async () => {
            const handler = await CodeHandler.create('highlight.js');
            await handler.configure({
                theme: 123 as unknown as object,
            });
            await handler.process('', {});
            expect(log).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(existsSync).not.toHaveBeenCalled();
        });

        it("should work even if version can't be fetched", async () => {
            const getVersionMock = vi
                .spyOn(await import('$utils/cdn.js'), 'getVersion')
                .mockResolvedValueOnce(undefined);
            const handler = await CodeHandler.create('highlight.js');
            await handler.process('', {});
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/highlight\.js@latest.default(\.min)?\.css/,
                ),
                expect.stringContaining('pre code'),
            );
            getVersionMock.mockRestore();
        });

        it("should return early if CSS can't be fetched", async () => {
            const fetchCssMock = vi
                .spyOn(await import('$utils/cdn.js'), 'fetchCss')
                .mockResolvedValueOnce(undefined);
            const handler = await CodeHandler.create('highlight.js');
            await handler.process('', {});
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(0);
            fetchCssMock.mockRestore();
        });
    });

    describe('codeHandler', () => {
        fixture();
        describe('process()', () => {
            fixture();
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('processes simple JS code correctly', async () => {
                const output = await handler.process('let a', { lang: 'js' });
                const expected =
                    '<pre><code class="language-js">\n<span class="hljs-keyword">let</span> a\n</code></pre>';
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
                    '<pre><code class="language-js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace;<span class="hljs-attr">prop</span>: number&rbrace;&gt;();\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            fixture();
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                await handler.configure({ classPrefix: 'test_' });
                expect(await handler.process('let a', { lang: 'js' })).toEqual(
                    '<pre><code class="language-js">\n<span class="test_keyword">let</span> a\n</code></pre>',
                );
                await handler.configure({ classPrefix: 'hljs-' });
                expect(await handler.process('let a', { lang: 'js' })).toEqual(
                    '<pre><code class="language-js">\n<span class="hljs-keyword">let</span> a\n</code></pre>',
                );
            });

            // it('can add new languages',  () => {
            //     handler.configure({ languages: [] });
            //     expect(await handler.process('let a', { lang: 'js' })).toEqual(
            //         'let a',
            //     );
            //     handler.configure({ languages: ['js'] });
            //     expect(await handler.process('let a', { lang: 'js' })).toEqual(
            //         '<span class="hljs-keyword">let</span> a',
            //     );
            // });
        });

        describe('processor', () => {
            fixture();
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configuration', () => {
            fixture();
            it('is default', async () => {
                const handler = await CodeHandler.create('highlight.js');
                expect('configuration' in handler).toBe(true);
                const defaultCC = getDefaultCodeConfiguration('highlight.js');
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

    describe('backend', () => {
        fixture();
        it("is 'highlight.js'", () => {
            expect(handler.backend).toBe('highlight.js');
        });
    });
});
