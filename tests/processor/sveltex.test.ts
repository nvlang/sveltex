/* eslint-disable vitest/no-commented-out-tests */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
    AdvancedTexHandler,
    CodeHandler,
    MarkdownHandler,
    TexHandler,
} from '$handlers';
import { type Sveltex, sveltex } from '$sveltex-preprocess';
import { Processed } from '$types/Sveltex.js';
import {
    AdvancedTexBackend,
    CodeBackend,
    MarkdownBackend,
    TexBackend,
} from '$sveltex-preprocess';
import { range } from '$tests';
import { SourceMapConsumer } from 'source-map';
import { describe, expect, it, suite, vi } from 'vitest';

suite.concurrent('Sveltex', () => {
    describe('misc', () => {
        it('should throw if backend is not recognized', async () => {
            await expect(() =>
                sveltex({
                    markdownBackend: 'unknown' as 'none',
                    codeBackend: 'unknown' as 'none',
                    texBackend: 'unknown' as 'none',
                    advancedTexBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
            await expect(() =>
                sveltex({
                    markdownBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
            await expect(() =>
                sveltex({
                    codeBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
            await expect(() =>
                sveltex({
                    texBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
            await expect(() =>
                sveltex({
                    advancedTexBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
        });
    });

    describe('handler setters', () => {
        it('should work if corresponding backend is custom', async () => {
            const preprocessor = await sveltex({
                markdownBackend: 'custom',
                codeBackend: 'custom',
                texBackend: 'custom',
                advancedTexBackend: 'custom',
            });
            preprocessor.markdownHandler = await MarkdownHandler.create(
                'custom',
                {
                    process: () => 'custom output markdown',
                },
            );
            preprocessor.codeHandler = await CodeHandler.create('custom', {
                process: () => 'custom output code',
            });
            preprocessor.texHandler = await TexHandler.create('custom', {
                process: () => 'custom output tex',
            });
            preprocessor.advancedTexHandler = await AdvancedTexHandler.create(
                'custom',
                {
                    process: () => 'custom output advanced tex',
                },
            );
            expect(await preprocessor.markdownHandler.process('')).toEqual(
                'custom output markdown',
            );
            expect(await preprocessor.codeHandler.process('')).toEqual(
                '<pre><code>\ncustom output code\n</code></pre>',
            );
            expect(await preprocessor.texHandler.process('')).toEqual(
                'custom output tex',
            );
            expect(
                await preprocessor.advancedTexHandler.process('', {
                    attributes: { ref: 'ref' },
                    selfClosing: false,
                    tag: 'name',
                    filename: 'test.sveltex',
                }),
            ).toEqual('custom output advanced tex');
        });
        it('should throw error if corresponding backend is not custom', async () => {
            const preprocessor = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
                advancedTexBackend: 'none',
            });
            await expect(
                async () =>
                    (preprocessor.markdownHandler =
                        await MarkdownHandler.create('none')),
            ).rejects.toThrowError(
                'markdownHandler setter can only be invoked if markdown backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.codeHandler =
                        await CodeHandler.create('none')),
            ).rejects.toThrowError(
                'codeHandler setter can only be invoked if code backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.texHandler = await TexHandler.create('none')),
            ).rejects.toThrowError(
                'texHandler setter can only be invoked if TeX backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.advancedTexHandler =
                        await AdvancedTexHandler.create('none')),
            ).rejects.toThrowError(
                'advancedTexHandler setter can only be invoked if advanced TeX backend is "custom" (got "none" instead).',
            );
        });
    });

    // describe('Sveltex.create()', () => {
    //     vi.doMock('unified', () => {
    //         throw new Error('unified not found');
    //     });
    //     vi.doMock('@wooorm/starry-night', () => {
    //         throw new Error('starry-night not found');
    //     });
    //     vi.doMock('mathjax-full/js/mathjax.js', () => {
    //         throw new Error('mathjax-full not found');
    //     });
    //     it('should complain any dependencies are missing', async () => {
    //         await expect(
    //             async () =>
    //                 await sveltex(
    //                     'unified',
    //                     'starry-night',
    //                     'mathjax-full',
    //                     'local',
    //                 ),
    //         ).rejects.toThrowError(
    //             'Failed to create Sveltex preprocessor.\n\nPlease install the necessary dependencies by running:\n\npnpm add -D unified remark-parse remark-rehype rehype-stringify @wooorm/starry-night hast-util-find-and-replace hast-util-to-html mathjax-full',
    //         );
    //         expect(missingDeps).toEqual([
    //             'unified',
    //             'remark-parse',
    //             'remark-rehype',
    //             'rehype-stringify',
    //             '@wooorm/starry-night',
    //             'hast-util-find-and-replace',
    //             'hast-util-to-html',
    //             'mathjax-full',
    //         ]);
    //     });
    //     vi.unmock('unified');
    //     vi.unmock('@wooorm/starry-night');
    //     vi.unmock('mathjax-full/js/mathjax.js');
    //     vi.restoreAllMocks();
    // });
});

const preprocessor = await sveltex({
    markdownBackend: 'marked',
    codeBackend: 'escapeOnly',
    texBackend: 'none',
    advancedTexBackend: 'none',
});

function preprocessFn<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(preprocessor: Sveltex<M, C, T, A>) {
    return async (input: string, filename: string = 'test.sveltex') => {
        return (await preprocessor.markup({ content: input, filename }))?.code;
    };
}

const preprocess = preprocessFn(preprocessor);
preprocessor.configure({
    verbatim: {
        verbatimEnvironments: {
            Verbatim: {},
        },
    },
});

suite.each([
    [
        [
            'hello',
            '<Verbatim>',
            'test1',
            'test2',
            'test3',
            'test4',
            'test5',
            'test6',
            'test7',
            'test8',
            'test9',
            '</Verbatim>',
            'there', // 1
            '`1`', // 2
            '{#if condition}', // 3
            '*a* {mustache}', // 4
            '{:else}', // 5
            '**b**', // 6
            '{/if}', // 7
            '*italic*', // 8
            '`code`', // 9
            'or **bold**', // 10
        ],
        [
            null,
            null,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            15,
            15,
            17,
            17,
            19,
            19,
            19,
            19,
        ],
    ],
])('source maps', async (inputLines, lineMap) => {
    const input = inputLines.join('\n');
    const result = (await preprocessor.markup({
        content: input,
        filename: 'test.sveltex',
    })) as Processed | undefined;
    if (result === undefined) {
        return;
    }
    const output = result.code;
    const outputLines = output.split('\n');
    const map = result.map;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,
    // @typescript-eslint/no-explicit-any,
    // @typescript-eslint/no-non-null-assertion
    if (map === undefined) {
        return;
    }
    const smc = await new SourceMapConsumer(map);
    describe('output', () => {
        it('should be as expected', () => {
            expect(output).toEqual(
                [
                    '<script>', // 1
                    '</script>', // 2
                    'hello', // 3
                    '<Verbatim>', // 4
                    'test1',
                    'test2',
                    'test3',
                    'test4',
                    'test5',
                    'test6',
                    'test7',
                    'test8',
                    'test9',
                    '</Verbatim>', // 10
                    'there', // 11
                    '<code class="language-plaintext">1</code>', // 12
                    '{#if condition}', // 13
                    '<em>a</em> {mustache}', // 14
                    '{:else}', // 15
                    '<strong>b</strong>', // 16
                    '{/if}', // 17
                    '<em>italic</em>', // 18
                    '<code class="language-plaintext">code</code>', // 19
                    'or <strong>bold</strong>', // 20
                ].join('\n'),
            );
        });
    });

    describe.each(range(1, outputLines.length))(
        'preimage of line %o of result',
        (outputLine) => {
            const outputLineIndex0 = outputLine - 1;
            const origPos = smc.originalPositionFor({
                line: outputLine,
                column: 0,
            });
            it(`output line ${String(outputLine)} comes from input line ${String(lineMap[outputLineIndex0])}`, async () => {
                const input = inputLines.join('\n');
                await preprocessor.markup({
                    content: input,
                    filename: 'test.sveltex',
                });
                // const outputLines = output.split('\n');
                // const map = result?.map;
                expect(origPos.line).toEqual(lineMap[outputLineIndex0]);
            });
        },
    );

    describe('should provide empty source map if sorcery fails', () => {
        it('should provide empty source map', async () => {
            const sorceryLoadMock = vi
                .spyOn(await import('sorcery'), 'load')
                .mockResolvedValueOnce(null);
            const result = (await preprocessor.markup({
                content: input,
                filename: 'test.sveltex',
            })) as Processed;
            expect(result.map).toEqual({
                file: 'test.sveltex',
                mappings: '',
                names: [],
                sources: [],
                sourcesContent: [],
                version: 3,
            });
            sorceryLoadMock.mockRestore();
        });
    });
});

suite('edge cases', async () => {
    const s = await sveltex({
        markdownBackend: 'marked',
        codeBackend: 'starry-night',
        texBackend: 'none',
        advancedTexBackend: 'none',
    });
    await s.configure({
        advancedTex: {
            components: {
                TeX: {},
            },
        },
        verbatim: {
            verbatimEnvironments: {
                Verbatim: {},
            },
        },
        code: {
            languages: 'common',
        },
    });
    async function markup(content: string, filename: string = 'test.sveltex') {
        return (await s.markup({ content, filename }))?.code;
    }

    describe('escaping edge cases', () => {
        it('Verbatim inside Code', async () => {
            expect(
                await markup(
                    [
                        '```html',
                        '<Verbatim>',
                        'test',
                        '</Verbatim>',
                        '```',
                    ].join('\n'),
                ),
            ).toEqual(
                '<script>\n</script>\n<pre><code class="language-html">\n&lt;<span class="pl-ent">Verbatim</span>&gt;\ntest\n&lt;/<span class="pl-ent">Verbatim</span>&gt;\n</code></pre>',
            );
        });

        it('Code inside Verbatim', async () => {
            expect(
                await markup(
                    ['<Verbatim>', '```', 'test', '```', '</Verbatim>'].join(
                        '\n',
                    ),
                ),
            ).toEqual(
                '<script>\n</script>\n<Verbatim>\n```\ntest\n```\n</Verbatim>',
            );
        });
    });
});

suite.concurrent('sveltex()', async () => {
    describe.concurrent('basics', () => {
        it('is defined', () => {
            expect(preprocessor).toBeDefined();
            expect(preprocessor.markup).toBeDefined();
        });

        it('ignores non-SvelTeX files', async () => {
            expect(
                await preprocessor.markup({ content: '*test*' }),
            ).toBeUndefined();
            expect(await preprocess('*test*', 'test.svelte')).toBeUndefined();
            expect(await preprocess('*test*', 'test.mdx')).toBeUndefined();
            expect(await preprocess('*test*', 'test.md')).toBeUndefined();
        });

        it.each([
            'abcdefghijklmnopqrstuvwxyz',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '0123456789',
            'üñǐçøďė and emojis: 👍',
            String.fromCodePoint(...range(126, 1000)),
        ])('supports unicode', async (str) => {
            expect(await preprocess(str)).toEqual(
                '<script>\n</script>\n' + str,
            );
        });
    });

    describe.sequential('respects svelte syntax', () => {
        const tests = [
            {
                label: 'script tag',
                input: '<script>console.log("_test_")</script>test',
            },
            {
                label: 'style tag',
                input: '<style> .hello {\n/* comment */ \n color: red; }</style>',
                expected:
                    '<script>\n</script>\n<style> .hello {\n/* comment */ \n color: red; }</style>',
            },
            {
                label: 'svelte:head tag',
                input: '<svelte:head><title>_test_</title></svelte:head>',
                expected:
                    '<script>\n</script>\n<svelte:head><title><em>test</em></title></svelte:head>',
            },
            {
                label: 'svelte:options tag',
                input: '<svelte:options customElement="test-1" />',
                expected:
                    '<script>\n</script>\n<svelte:options customElement="test-1" />',
            },
            {
                label: 'svelte:window tag',
                input: '<svelte:window on:resize={handleResize} />',
                expected:
                    '<script>\n</script>\n<svelte:window on:resize={handleResize} />',
            },
            {
                label: 'svelte:body tag',
                input: '<svelte:body on:click={handleClick} />',
                expected:
                    '<script>\n</script>\n<svelte:body on:click={handleClick} />',
            },
            {
                label: 'svelte:component tag',
                input: '<svelte:component this={Component} />',
                expected:
                    '<script>\n</script>\n<svelte:component this={Component} />',
            },
            {
                label: 'if block',
                input: '{#if condition}\nA\n{/if}',
                expected: '<script>\n</script>\n{#if condition}\nA\n{/if}',
            },
            {
                label: 'else block',
                input: '{#if condition}\nA\n{:else}\nB\n{/if}',
                expected:
                    '<script>\n</script>\n{#if condition}\nA\n{:else}\nB\n{/if}',
            },
            {
                label: 'else if block',
                input: '{#if condition}\n>A\n{:else if otherCondition}\n*B*\n{:else}\nC\n{/if}',
                expected:
                    '<script>\n</script>\n{#if condition}<blockquote>\n<p>A</p>\n</blockquote>\n{:else if otherCondition}\n<em>B</em>\n{:else}\nC\n{/if}',
            },
            {
                label: 'each block',
                input: '{#each items as item}\n*A* {item} B\n{/each}',
                expected:
                    '<script>\n</script>\n{#each items as item}\n<em>A</em> {item} B\n{/each}',
            },
            {
                label: 'await block',
                input: '{#await promise}\n*loading...*\n{:then value}\n{value}\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
                expected:
                    '<script>\n</script>\n{#await promise}\n<em>loading...</em>\n{:then value}\n{value}\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
            },
            {
                label: 'html block',
                input: '<script>\n</script>\n{@html "<p>hello, world!</p>"}',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(
                test.expected ?? test.input,
            );
        });
    });

    // eslint-disable-next-line vitest/valid-describe-callback
    describe.concurrent('transforms inline markdown', async () => {
        const preprocessor = await sveltex({
            markdownBackend: 'marked',
            codeBackend: 'escapeOnly',
            texBackend: 'none',
            advancedTexBackend: 'none',
        });
        const preprocess = async (
            input: string,
            filename: string = 'test.sveltex',
        ) => {
            return (await preprocessor.markup({ content: input, filename }))
                ?.code;
        };

        const tests = [
            {
                label: 'strong',
                input: '**strong**',
                expected: '<script>\n</script>\n<strong>strong</strong>',
            },
            {
                label: 'em',
                input: '_em_',
                expected: '<script>\n</script>\n<em>em</em>',
            },
            // {
            //     label: 'code',
            //     input: '`code`',
            //     expected: '<code>code</code>',
            // },
            {
                label: 'a',
                input: '[link](https://example.com)',
                expected:
                    '<script>\n</script>\n<a href="https://example.com">link</a>',
            },
            {
                label: 'img',
                input: '![alt](https://example.com/image.jpg)',
                expected:
                    '<script>\n</script>\n<img src="https://example.com/image.jpg" alt="alt">',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
    });

    describe.concurrent('transforms markdown blocks', () => {
        const tests = [
            {
                label: 'h1',
                input: '# Hello, world!',
                expected: '<script>\n</script>\n<h1>Hello, world!</h1>\n',
            },
            {
                label: 'h2',
                input: '## Hello, world!',
                expected: '<script>\n</script>\n<h2>Hello, world!</h2>\n',
            },
            {
                label: 'h3',
                input: '### Hello, world!',
                expected: '<script>\n</script>\n<h3>Hello, world!</h3>\n',
            },
            {
                label: 'h4',
                input: '#### Hello, world!',
                expected: '<script>\n</script>\n<h4>Hello, world!</h4>\n',
            },
            {
                label: 'h5',
                input: '##### Hello, world!',
                expected: '<script>\n</script>\n<h5>Hello, world!</h5>\n',
            },
            {
                label: 'h6',
                input: '###### Hello, world!',
                expected: '<script>\n</script>\n<h6>Hello, world!</h6>\n',
            },
            {
                label: 'blockquote',
                input: '> blockquote',
                expected:
                    '<script>\n</script>\n<blockquote>\n<p>blockquote</p>\n</blockquote>\n',
            },
            {
                label: 'unordered list (-)',
                input: '- ul',
                expected: '<script>\n</script>\n<ul>\n<li>ul</li>\n</ul>\n',
            },
            {
                label: 'code block',
                input: '```\nsomething\n```',
                expected:
                    '<script>\n</script>\n<pre><code class="language-plaintext">\nsomething\n</code></pre>',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
    });

    // eslint-disable-next-line vitest/valid-describe-callback
    describe('works with code blocks', () => {
        it('starry night should work with this', async () => {
            const preprocessor = await sveltex({
                markdownBackend: 'marked',
                codeBackend: 'starry-night',
                texBackend: 'none',
                advancedTexBackend: 'none',
            });
            await preprocessor.configure({ code: { languages: 'common' } });
            expect(
                await preprocessor.codeHandler.process(
                    '```typescript\n() => {let a}\n```',
                ),
            ).toEqual(
                '<pre><code class="language-typescript">\n() <span class="pl-k">=&gt;</span> &lbrace;<span class="pl-k">let</span> <span class="pl-smi">a</span>&rbrace;\n</code></pre>',
            );
        });

        it.each([
            {
                label: 'code block (plain)',
                input: '```\n() => {let a}\n```',
                expected:
                    '<script>\n</script>\n<pre><code class="language-plaintext">\n() =&gt; &lbrace;let a&rbrace;\n</code></pre>',
            },
            {
                label: 'code block (ts)',
                input: '```typescript\n() => {let a}\n```',
                expected:
                    '<script>\n</script>\n<pre><code class="language-typescript">\n() <span class="pl-k">=&gt;</span> &lbrace;<span class="pl-k">let</span> <span class="pl-smi">a</span>&rbrace;\n</code></pre>',
            },
        ])('$test.label', async (test) => {
            const preprocessor = await sveltex({
                markdownBackend: 'marked',
                codeBackend: 'starry-night',
                texBackend: 'none',
                advancedTexBackend: 'none',
            });
            await preprocessor.configure({ code: { languages: 'common' } });
            const preprocess = async (
                input: string,
                filename: string = 'test.sveltex',
            ) => {
                return (await preprocessor.markup({ content: input, filename }))
                    ?.code;
            };
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
    });

    describe.concurrent('works with mustache tags', () => {
        const tests = [
            {
                label: 'strong',
                input: '**{strong}**',
                expected: '<script>\n</script>\n<strong>{strong}</strong>',
            },
            {
                label: 'em',
                input: '_{em}_',
                expected: '<script>\n</script>\n<em>{em}</em>',
            },
            // {
            //     label: 'mustache tags in code are escaped',
            //     input: '`{code}`',
            //     expected: '<code>&code}</code>',
            // },
            {
                label: 'a',
                input: '[{link}](https://example.com)',
                expected:
                    '<script>\n</script>\n<a href="https://example.com">{link}</a>',
            },
            {
                label: 'img',
                input: '![{alt}](https://example.com/image.jpg)',
                expected:
                    '<script>\n</script>\n<img src="https://example.com/image.jpg" alt="{alt}">',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
    });

    const preprocessorVerbatim = await sveltex({
        markdownBackend: 'none',
        codeBackend: 'none',
        texBackend: 'none',
        advancedTexBackend: 'none',
    });
    await preprocessorVerbatim.configure({
        verbatim: {
            verbatimEnvironments: {
                Verbatim: {
                    processInner: { escapeBraces: true, escapeHtml: true },
                },
            },
        },
    });
    const preprocessVerbatim = preprocessFn(preprocessorVerbatim);

    describe('verbatim environments', () => {
        it('should work with custom verbatim environments', async () => {
            expect(
                await preprocessVerbatim('<Verbatim>{test}</Verbatim>'),
            ).toEqual(
                '<script>\n</script>\n<Verbatim>&lbrace;test&rbrace;</Verbatim>',
            );
        });

        it('should work with TeX verbatim environments', async () => {
            const preprocessor = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
                advancedTexBackend: 'none',
            });
            await preprocessor.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Verbatim: {
                            processInner: {
                                escapeBraces: true,
                                escapeHtml: true,
                            },
                        },
                    },
                },
            });
            const preprocess = preprocessFn(preprocessor);
            expect(await preprocess('$x$')).toEqual('<script>\n</script>\nx');
        });
    });

    const preprocessorMisc = await sveltex({
        markdownBackend: 'none',
        codeBackend: 'escapeOnly',
        texBackend: 'none',
        advancedTexBackend: 'none',
    });
    await preprocessorMisc.configure({
        general: {
            extensions: undefined,
        },
    });
    const preprocessMisc = preprocessFn(preprocessorMisc);

    describe('misc', () => {
        it('should work', async () => {
            expect(await preprocessMisc('`{}`')).toEqual(
                '<script>\n</script>\n<code class="language-plaintext">&lbrace;&rbrace;</code>',
            );
        });
    });
});