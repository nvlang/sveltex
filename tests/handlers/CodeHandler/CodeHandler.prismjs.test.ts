/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, vi } from 'vitest';

import { CodeHandler } from '$handlers';
import { getDefaultCodeConfiguration } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);
vi.spyOn(consoles, 'warn').mockImplementation(() => undefined);

suite("CodeHandler<'prismjs'>", async () => {
    const handler = await CodeHandler.create('prismjs');

    describe("CodeHandler.create('prismjs')", () => {
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
                    '<pre><code class="language-js">\n<span class="token keyword">let</span> a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it.each(['unknown-language', undefined])(
                'processes code of unknown language correctly',
                async (lang) => {
                    expect(
                        await handler.process('let a = b', {
                            lang,
                        }),
                    ).toEqual(
                        `<pre><code${lang ? ` class="language-${lang}"` : ''}>\nlet a = b\n</code></pre>`,
                    );
                },
            );

            it.each([
                'something',
                'let a',
                '/**\n * @remarks comment\n */\nconst a = new Map<string, {prop: number[]}>();',
            ])('parses info from delimiters if present', async (code) => {
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
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = await handler.process('a <b> {c}', {
                    lang: 'plaintext',
                });
                const expected =
                    '<pre><code class="language-plaintext">\na &lt;b> &lbrace;c&rbrace;\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in JS code correctly', async () => {
                const output = await handler.process(
                    'const a = new Map<string, {prop: number}>();',
                    { lang: 'js' },
                );
                const expected =
                    '<pre><code class="language-js">\n<span class="token keyword">const</span> a <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Map</span><span class="token operator">&lt;</span>string<span class="token punctuation">,</span> <span class="token punctuation">&lbrace;</span><span class="token literal-property property">prop</span><span class="token operator">:</span> number<span class="token punctuation">&rbrace;</span><span class="token operator">></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });
            it('returns void', async () => {
                // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                expect(await handler.configure({})).toBeUndefined();
            });

            // it('configures code correctly',  () => {
            //     expect(
            //         await handler.process('\\documentclass{article}\n$math$', {
            //             lang: 'latex',
            //         }),
            //     ).toEqual('\\example');
            // });

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
            it('is default', () => {
                expect('configuration' in handler).toBe(true);
                const defaultCC = getDefaultCodeConfiguration('prismjs');
                expect(handler.configuration.wrapClassPrefix).toEqual(
                    defaultCC.wrapClassPrefix,
                );
            });
        });
    });

    describe('backend', () => {
        it("is 'prismjs'", () => {
            expect(handler.backend).toBe('prismjs');
        });
    });
});
