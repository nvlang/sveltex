/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, vi, beforeEach } from 'vitest';

import { createCodeHandler, CodeHandler } from '$handlers';
import { defaultCodeConfiguration } from '$src/config/defaults.js';

suite.concurrent("CodeHandler<'starry-night'>", async () => {
    const handler = await createCodeHandler('starry-night');
    await handler.configure({ languages: 'common' });

    describe.concurrent("createCodeHandler('starry-night')", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe.concurrent('codeHandler', () => {
        describe.concurrent('process()', () => {
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('processes simple JS code correctly', async () => {
                const output = await handler.process('let a', { lang: 'js' });
                const expected = '<span class="pl-k">let</span> a';
                expect(output).toEqual(expected);
            });

            it('processes plaintext correctly', async () => {
                const output = await handler.process('let a', {
                    lang: undefined,
                });
                const expected = 'let a';
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
                    '<span class="pl-k">const</span> <span class="pl-c1">a</span> <span class="pl-k">=</span> <span class="pl-k">new</span> <span class="pl-en">Map</span><span class="pl-k">&lt;</span>string, &lbrace;prop<span class="pl-k">:</span> number&rbrace;<span class="pl-k">&gt;</span>();';
                expect(output).toEqual(expected);
            });
        });

        describe.sequential('configure()', () => {
            const consoleWarnMock = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);
            const consoleErrorMock = vi
                .spyOn(console, 'error')
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
                ).toEqual('\\example');
                await handler.configure({
                    languages: ['text.tex.latex'],
                });
                expect(
                    await handler.process('\\example', { lang: 'tex' }),
                ).toEqual('<span class="pl-c1">\\example</span>');
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual('a ::= b');

                await handler.configure({ languages: 'all' });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>',
                );
                // can't unload languages though...
                await handler.configure({ languages: [] });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>',
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
                const handler = await createCodeHandler('starry-night');
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual('a ::= b');
                expect(consoleWarnMock).toHaveBeenCalledTimes(1);
                expect(consoleWarnMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Language "ebnf" not found.'),
                );
                await handler.configure({ languages: ['source.ebnf'] });
                expect(
                    await handler.process('a ::= b', { lang: 'ebnf' }),
                ).toEqual(
                    '<span class="pl-en">a</span> <span class="pl-k">::=</span> <span class="pl-v">b</span>',
                );
            });

            it('can add new custom languages', async () => {
                const handler = await createCodeHandler('starry-night');
                expect(
                    await handler.process('something a', {
                        lang: 'custom-language',
                    }),
                ).toEqual('something a');
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
                ).toEqual('<span class="pl-k">something</span> a');
            });
        });

        describe.concurrent('processor', () => {
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe.concurrent('configuration', () => {
            it('is default', async () => {
                const handler = await createCodeHandler('starry-night');
                expect('configuration' in handler).toBe(true);
                expect(handler.configuration).toEqual(defaultCodeConfiguration);
            });
        });
    });

    describe.concurrent('backend', () => {
        it("is 'starry-night'", () => {
            expect(handler.backend).toBe('starry-night');
        });
    });
});
