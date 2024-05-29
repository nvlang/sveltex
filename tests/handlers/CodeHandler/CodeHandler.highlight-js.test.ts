/* eslint-disable vitest/no-commented-out-tests */
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { spy } from '$tests/fixtures.js';
import { consoles } from '$utils/debug.js';
import { v4 as uuid } from 'uuid';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe("CodeHandler<'highlight.js'>", () => {
    fixture();
    const consoleErrorMock = vi
        .spyOn(consoles, 'error')
        .mockImplementation(() => undefined);
    vi.spyOn(consoles, 'warn').mockImplementation(() => undefined);
    beforeAll(async () => {
        const mocks = await spy(
            ['writeFileEnsureDir', 'writeFile', 'existsSync', 'log'],
            true,
        );
        writeFileEnsureDir = mocks.writeFileEnsureDir;
        existsSync = mocks.existsSync;
        log = mocks.log;
        handler = await CodeHandler.create('highlight.js', {});
    });
    let handler: CodeHandler<'highlight.js'>;
    let writeFileEnsureDir: MockInstance;
    let existsSync: MockInstance;
    let log: MockInstance;

    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe("CodeHandler.create('highlight.js',{})", () => {
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
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/highlight\.js@.*(\.min)?\.css/,
                ),
                expect.stringContaining('pre code'),
            );
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(1);
        });

        it("logs a message if CSS couldn't be written", async () => {
            const id = uuid();
            writeFileEnsureDir.mockImplementationOnce(() => {
                throw new Error(id);
            });
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(id),
            );
        });

        it("shouldn't write CSS if configuration.theme.type is none", async () => {
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'none' } });
            (await handler.process('', {})).processed;
            expect(consoleErrorMock).toHaveBeenCalledTimes(0);
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(existsSync).not.toHaveBeenCalled();
        });

        it("shouldn't write CSS if configuration is not valid", async () => {
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({
                theme: 123 as unknown as { type: 'none' },
            });
            (await handler.process('', {})).processed;
            expect(log).toHaveBeenCalledTimes(1);
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(existsSync).not.toHaveBeenCalled();
        });

        it("should work even if version can't be fetched", async () => {
            const getVersionMock = vi
                .spyOn(await import('$utils/env.js'), 'getVersion')
                .mockResolvedValueOnce(undefined);
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
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
                .spyOn(await import('$utils/cdn.js'), 'fancyFetch')
                .mockResolvedValueOnce(undefined);
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
            expect(writeFileEnsureDir).toHaveBeenCalledTimes(0);
            fetchCssMock.mockRestore();
        });

        it('should return early if CSS file is already present', async () => {
            const fetchCssMock = vi
                .spyOn(await import('$utils/cdn.js'), 'fancyFetch')
                .mockResolvedValueOnce(undefined);
            existsSync.mockReturnValueOnce(true);
            const handler = await CodeHandler.create('highlight.js', {});
            await handler.configure({ theme: { type: 'self-hosted' } });
            (await handler.process('', {})).processed;
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
                const output = (
                    await handler.process('let a', {
                        lang: 'js',
                    })
                ).processed;
                const expected =
                    '<pre><code class="language-js"><span class="hljs-keyword">let</span> a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
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
                    '<pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace;<span class="hljs-attr">prop</span>: number&rbrace;&gt;();\n</code></pre>';
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
                await handler.configure({
                    'highlight.js': { classPrefix: 'test_' },
                });
                expect(
                    (
                        await handler.process('let a', {
                            lang: 'js',
                        })
                    ).processed,
                ).toEqual(
                    '<pre><code class="language-js"><span class="test_keyword">let</span> a\n</code></pre>',
                );
                await handler.configure({
                    'highlight.js': { classPrefix: 'hljs-' },
                });
                expect(
                    (
                        await handler.process('let a', {
                            lang: 'js',
                        })
                    ).processed,
                ).toEqual(
                    '<pre><code class="language-js"><span class="hljs-keyword">let</span> a\n</code></pre>',
                );
            });

            // it('can add new languages',  () => {
            //     handler.configure({ languages: [] });
            //     expect((await handler.process('let a', { lang: 'js' })).processed).toEqual(
            //         'let a',
            //     );
            //     handler.configure({ languages: ['js'] });
            //     expect((await handler.process('let a', { lang: 'js' })).processed).toEqual(
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
    });

    describe('backend', () => {
        fixture();
        it("is 'highlight.js'", () => {
            expect(handler.backend).toBe('highlight.js');
        });
    });

    describe('misc', () => {
        fixture();
        it('is serializable', async () => {
            const handler = await CodeHandler.create('highlight.js', {});
            const serialized = JSON.stringify(handler);
            expect(serialized).toBeTypeOf('string');
            expect(serialized).not.toBeNull();
            expect(log).not.toHaveBeenCalled();
        });
    });
});
