/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, vi } from 'vitest';

import { CodeHandler } from '$handlers';
import { getDefaultCodeConfiguration } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';
import { isFunction } from '$type-guards/utils.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);
vi.spyOn(consoles, 'warn').mockImplementation(() => undefined);

suite("CodeHandler<'highlight.js'>", async () => {
    const handler = await CodeHandler.create('highlight.js');

    describe("CodeHandler.create('highlight.js')", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe('codeHandler', () => {
        describe('process()', () => {
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
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configuration', () => {
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
        it("is 'highlight.js'", () => {
            expect(handler.backend).toBe('highlight.js');
        });
    });
});