/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, vi } from 'vitest';

import { createCodeHandler, CodeHandler } from '$handlers';
import { defaultCodeConfiguration } from '$src/config/defaults.js';

vi.spyOn(console, 'error').mockImplementation(() => undefined);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);

suite("CodeHandler<'highlight.js'>", async () => {
    const handler = await createCodeHandler('highlight.js');

    describe("createCodeHandler('highlight.js')", () => {
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
                const expected = '<span class="hljs-keyword">let</span> a';
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
                            '<pre><code class="language-plaintext">\n' +
                                (await handler.process(code, {
                                    lang: 'plaintext',
                                    inline: false,
                                })) +
                                '\n</code></pre>',
                        );
                        expect(await handler.process('`' + code + '`')).toEqual(
                            '<code class="language-plaintext">' +
                                (await handler.process(code, {
                                    lang: 'plaintext',
                                    inline: true,
                                })) +
                                '</code>',
                        );
                        expect(
                            await handler.process('```js\n' + code + '\n```'),
                        ).toEqual(
                            '<pre><code class="language-js">\n' +
                                (await handler.process(code, { lang: 'js' })) +
                                '\n</code></pre>',
                        );
                        expect(
                            await handler.process(
                                '```javascript\n' + code + '\n```',
                            ),
                        ).toEqual(
                            '<pre><code class="language-javascript">\n' +
                                (await handler.process(code, { lang: 'js' })) +
                                '\n</code></pre>',
                        );
                    })();
                }
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = await handler.process('a <b> {c}', {
                    lang: 'plaintext',
                });
                const expected = 'a &lt;b&gt; &lbrace;c&rbrace;';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in JS code correctly', async () => {
                const output = await handler.process(
                    'const a = new Map<string, {prop: number}>();',
                    { lang: 'js' },
                );
                const expected =
                    '<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace;<span class="hljs-attr">prop</span>: number&rbrace;&gt;();';
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
                    '<span class="test_keyword">let</span> a',
                );
                await handler.configure({ classPrefix: 'hljs-' });
                expect(await handler.process('let a', { lang: 'js' })).toEqual(
                    '<span class="hljs-keyword">let</span> a',
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
            it('is default', () => {
                expect('configuration' in handler).toBe(true);
                expect(handler.configuration).toEqual({
                    classPrefix: 'hljs-',
                    ...defaultCodeConfiguration,
                });
            });
        });
    });

    describe('backend', () => {
        it("is 'highlight.js'", () => {
            expect(handler.backend).toBe('highlight.js');
        });
    });
});
