/* eslint-disable vitest/no-commented-out-tests */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect, suite } from 'vitest';
import { Sveltex, sveltex } from '$processor';
import { expectWith, noopTest, range } from '$tests';
import { createMarkdownHandler } from '$src/handlers/MarkdownHandler.js';
import {
    createAdvancedTexHandler,
    createCodeHandler,
    createTexHandler,
} from '$handlers';
import {
    AdvancedTexBackend,
    CodeBackend,
    MarkdownBackend,
    TexBackend,
} from '$src';

suite.concurrent('Sveltex', () => {
    describe('handler setters', () => {
        it('should work if corresponding backend is custom', async () => {
            const preprocessor = await sveltex(
                'custom',
                'custom',
                'custom',
                'custom',
            );
            preprocessor.markdownHandler = await createMarkdownHandler(
                'custom',
                {
                    process: () => 'custom output markdown',
                },
            );
            preprocessor.codeHandler = await createCodeHandler('custom', {
                process: () => 'custom output code',
            });
            preprocessor.texHandler = await createTexHandler('custom', {
                process: () => 'custom output tex',
            });
            preprocessor.advancedTexHandler = await createAdvancedTexHandler(
                'custom',
                {
                    process: () => 'custom output advanced tex',
                },
            );
            expect(await preprocessor.markdownHandler.process('')).toEqual(
                'custom output markdown',
            );
            expect(await preprocessor.codeHandler.process('')).toEqual(
                'custom output code',
            );
            expect(await preprocessor.texHandler.process('')).toEqual(
                'custom output tex',
            );
            expect(await preprocessor.advancedTexHandler.process('')).toEqual(
                'custom output advanced tex',
            );
        });
        it('should throw error if corresponding backend is not custom', async () => {
            const preprocessor = await sveltex('none', 'none', 'none', 'none');
            await expect(
                async () =>
                    (preprocessor.markdownHandler =
                        await createMarkdownHandler('none')),
            ).rejects.toThrowError(
                'markdownHandler setter can only be invoked if markdown backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.codeHandler =
                        await createCodeHandler('none')),
            ).rejects.toThrowError(
                'codeHandler setter can only be invoked if code backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.texHandler = await createTexHandler('none')),
            ).rejects.toThrowError(
                'texHandler setter can only be invoked if TeX backend is "custom" (got "none" instead).',
            );
            await expect(
                async () =>
                    (preprocessor.advancedTexHandler =
                        await createAdvancedTexHandler('none')),
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

const preprocessor = await sveltex('marked', 'escapeOnly', 'none', 'none');

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

        it('supports unicode', () => {
            expect('').toBe('');
            [
                'abcdefghijklmnopqrstuvwxyz',
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                '0123456789',
                'üñǐçøďė and emojis: 👍',
                String.fromCodePoint(...range(126, 1000)),
            ]
                .map(noopTest)
                .map(expectWith(preprocess));
        });
    });

    describe.concurrent('respects svelte syntax', () => {
        const tests = [
            {
                label: 'script tag',
                input: '<script>console.log("_test_")</script>',
            },
            {
                label: 'style tag',
                input: '<style> .hello { \n\n /* comment */ \n color: red; }</style>',
            },
            {
                label: 'svelte:head tag',
                input: '<svelte:head><title>_test_</title></svelte:head>',
                expected:
                    '<svelte:head><title><em>test</em></title></svelte:head>',
            },
            {
                label: 'svelte:options tag',
                input: '<svelte:options\n\n customElement="test-1" />',
            },
            {
                label: 'svelte:window tag',
                input: '<svelte:window\n\n on:resize={handleResize} />',
            },
            {
                label: 'svelte:body tag',
                input: '<svelte:body \n\n on:click={handleClick} />',
            },
            {
                label: 'svelte:component tag',
                input: '<svelte:component \n\n this={Component} />',
            },
            {
                label: 'if block',
                input: '{#if condition}\nA\n{/if}',
            },
            {
                label: 'else block',
                input: '{#if condition}\nA\n{:else}\nB\n{/if}',
            },
            {
                label: 'else if block',
                input: '{#if condition}\n>A\n{:else if otherCondition}\n*B*\n{:else}\nC\n{/if}',
                expected:
                    '{#if condition}<blockquote>\n<p>A</p>\n</blockquote>\n{:else if otherCondition}\n<em>B</em>\n{:else}\nC\n{/if}',
            },
            {
                label: 'each block',
                input: '{#each items as item}\n*A* {item} B\n{/each}',
                expected: '{#each items as item}\n<em>A</em> {item} B\n{/each}',
            },
            {
                label: 'await block',
                input: '{#await promise}\n*loading...*\n{:then value}\n{value}\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
                expected:
                    '{#await promise}\n<em>loading...</em>\n{:then value}\n{value}\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
            },
            {
                label: 'html block',
                input: '{@html "<p>hello, world!</p>"}',
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
        const preprocessor = await sveltex(
            'marked',
            'escapeOnly',
            'none',
            'none',
        );
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
                expected: '<strong>strong</strong>',
            },
            {
                label: 'em',
                input: '_em_',
                expected: '<em>em</em>',
            },
            // {
            //     label: 'code',
            //     input: '`code`',
            //     expected: '<code>code</code>',
            // },
            {
                label: 'a',
                input: '[link](https://example.com)',
                expected: '<a href="https://example.com">link</a>',
            },
            {
                label: 'img',
                input: '![alt](https://example.com/image.jpg)',
                expected: '<img src="https://example.com/image.jpg" alt="alt">',
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
                expected: '<h1>Hello, world!</h1>\n',
            },
            {
                label: 'h2',
                input: '## Hello, world!',
                expected: '<h2>Hello, world!</h2>\n',
            },
            {
                label: 'h3',
                input: '### Hello, world!',
                expected: '<h3>Hello, world!</h3>\n',
            },
            {
                label: 'h4',
                input: '#### Hello, world!',
                expected: '<h4>Hello, world!</h4>\n',
            },
            {
                label: 'h5',
                input: '##### Hello, world!',
                expected: '<h5>Hello, world!</h5>\n',
            },
            {
                label: 'h6',
                input: '###### Hello, world!',
                expected: '<h6>Hello, world!</h6>\n',
            },
            {
                label: 'blockquote',
                input: '> blockquote',
                expected: '<blockquote>\n<p>blockquote</p>\n</blockquote>\n',
            },
            {
                label: 'unordered list (-)',
                input: '- ul',
                expected: '<ul>\n<li>ul</li>\n</ul>\n',
            },
            {
                label: 'code block',
                input: '```\nsomething\n```',
                expected:
                    '<pre><code class="language-plaintext">\nsomething\n</code></pre>',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
        // console.log(escapeWhitespace(await marked.parseInline('**strong**\n\n_em_\n\n')));
        // expect((await preprocess('# Hello, world!\n'))?.trim()).toEqual('<h1>Hello, world!</h1>');
    });

    // eslint-disable-next-line vitest/valid-describe-callback
    describe('works with code blocks', () => {
        it('starry night should work with this', async () => {
            const preprocessor = await sveltex(
                'marked',
                'starry-night',
                'none',
                'none',
            );
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
                    '<pre><code class="language-plaintext">\n() =&gt; &lbrace;let a&rbrace;\n</code></pre>',
            },
            {
                label: 'code block (ts)',
                input: '```typescript\n() => {let a}\n```',
                expected:
                    '<pre><code class="language-typescript">\n() <span class="pl-k">=&gt;</span> &lbrace;<span class="pl-k">let</span> <span class="pl-smi">a</span>&rbrace;\n</code></pre>',
            },
        ])('$test.label', async (test) => {
            const preprocessor = await sveltex(
                'marked',
                'starry-night',
                'none',
                'none',
            );
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
                expected: '<strong>{strong}</strong>',
            },
            {
                label: 'em',
                input: '_{em}_',
                expected: '<em>{em}</em>',
            },
            // {
            //     label: 'mustache tags in code are escaped',
            //     input: '`{code}`',
            //     expected: '<code>&code}</code>',
            // },
            {
                label: 'a',
                input: '[{link}](https://example.com)',
                expected: '<a href="https://example.com">{link}</a>',
            },
            {
                label: 'img',
                input: '![{alt}](https://example.com/image.jpg)',
                expected:
                    '<img src="https://example.com/image.jpg" alt="{alt}">',
            },
        ];
        it.each(tests)('$test.label', async (test) => {
            expect(await preprocess(test.input)).toEqual(test.expected);
        });
    });

    const preprocessorVerbatim = await sveltex('none', 'none', 'none', 'none');
    await preprocessorVerbatim.configure({
        general: {
            verbatimEnvironments: {
                Verbatim: { escapeBraces: true, escapeHtml: true },
            },
        },
    });
    const preprocessVerbatim = preprocessFn(preprocessorVerbatim);

    describe('verbatim environments', () => {
        it('should work with custom verbatim environments', async () => {
            expect(
                await preprocessVerbatim('<Verbatim>{test}</Verbatim>'),
            ).toEqual('<Verbatim>\n&lbrace;test&rbrace;\n</Verbatim>');
        });

        it('should work with TeX verbatim environments', async () => {
            const preprocessor = await sveltex('none', 'none', 'none', 'none');
            await preprocessor.configure({
                general: {
                    verbatimEnvironments: {
                        Verbatim: { escapeBraces: true, escapeHtml: true },
                    },
                },
            });
            const preprocess = preprocessFn(preprocessor);
            expect(await preprocess('$x$')).toEqual('x');
        });
    });

    const preprocessorMisc = await sveltex(
        'none',
        'escapeOnly',
        'none',
        'none',
    );
    await preprocessorMisc.configure({
        general: {
            extensions: undefined,
        },
    });
    const preprocessMisc = preprocessFn(preprocessorMisc);

    describe('misc', () => {
        it('should work', async () => {
            expect(await preprocessMisc('`{}`')).toEqual(
                '<code class="language-plaintext">&lbrace;&rbrace;</code>',
            );
        });
    });
});
