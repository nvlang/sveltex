/* eslint-disable vitest/no-commented-out-tests */
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { getDefaultCodeConfig } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);
vi.spyOn(consoles, 'warn').mockImplementation(() => undefined);

describe("CodeHandler<'prismjs'>", () => {
    let handler: CodeHandler<'prismjs'>;
    beforeAll(async () => {
        handler = await CodeHandler.create('prismjs');
    });

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
                const output = (await handler.process('let a', { lang: 'js' }))
                    .processed;
                const expected =
                    '<pre><code class="language-js"><span class="token keyword">let</span> a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('processes code of unknown language correctly', async () => {
                expect(
                    (
                        await handler.process('let a = b', {
                            lang: 'unknown-language',
                        })
                    ).processed,
                ).toEqual(
                    `<pre><code class="language-unknown-language">let a = b\n</code></pre>`,
                );
            });

            it('defaults to no language', async () => {
                const output = (await handler.process('let a')).processed;
                const expected = '<pre><code>let a\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = (
                    await handler.process('a <b> {c}', {
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre><code class="language-plaintext">a &lt;b> &lbrace;c&rbrace;\n</code></pre>';
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
                    '<pre><code class="language-js"><span class="token keyword">const</span> a <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">Map</span><span class="token operator">&lt;</span>string<span class="token punctuation">,</span> <span class="token punctuation">&lbrace;</span><span class="token literal-property property">prop</span><span class="token operator">:</span> number<span class="token punctuation">&rbrace;</span><span class="token operator">></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n</code></pre>';
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
            //         (await handler.process('\\documentclass{article}\n$math$', {
            //             lang: 'latex',
            //         })).processed,
            //     ).toEqual('\\example');
            // });

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
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configuration', () => {
            it('is default', () => {
                expect('configuration' in handler).toBe(true);
                const defaultCC = getDefaultCodeConfig('prismjs');
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
