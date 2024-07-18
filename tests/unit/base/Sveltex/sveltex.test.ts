/* eslint-disable vitest/no-commented-out-tests */

import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { MathBackend } from '$types/handlers/Math.js';

import { sveltex, Sveltex } from '$base/Sveltex.js';

import { removeEmptyLines, spy } from '$tests/unit/fixtures.js';
import { range } from '$tests/unit/utils.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SveltexConfiguration } from '$mod.js';
import { isRegExp } from '$deps.js';
import { isArray, isDefined, isString } from '$typeGuards/utils.js';

describe.concurrent('Sveltex', () => {
    beforeAll(async () => {
        await spy(['writeFile', 'log', 'existsSync', 'mkdir'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('misc', () => {
        it('should throw if backend is not recognized', async () => {
            await expect(() =>
                sveltex({
                    markdownBackend: 'unknown' as 'none',
                    codeBackend: 'unknown' as 'none',
                    mathBackend: 'unknown' as 'none',
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
                    mathBackend: 'unknown' as 'none',
                }),
            ).rejects.toThrowError();
        });
    });

    describe('configuration getter', () => {
        it('returns copy of configuration, not reference', async () => {
            const config = {
                markdown: {
                    transformers: { pre: [/a/, 'b'], post: () => 'c' },
                },
                code: {
                    transformers: { pre: [/a/, 'b'], post: () => 'c' },
                },
                math: {
                    transformers: { pre: [/a/, 'b'], post: () => 'c' },
                },
                tex: {},
                verbatim: {
                    Example: {
                        type: 'code',
                        transformers: { pre: [/a/, 'b'], post: () => 'c' },
                    },
                    Example2: {
                        type: 'tex',
                        transformers: { pre: null, post: null },
                    },
                },
            } as const;
            const sp = await sveltex(
                {},
                config as unknown as SveltexConfiguration<
                    'none',
                    'none',
                    'none'
                >,
            );
            const configCopy = sp.configuration;
            expect(configCopy).toMatchObject(config);
            expect(configCopy.verbatim['Example']?.transformers.pre).toEqual(
                config.verbatim.Example.transformers.pre,
            );
            const regexp = config.verbatim.Example.transformers.pre[0];
            if (isRegExp(regexp)) {
                const pre = configCopy.verbatim['Example']?.transformers.pre;
                expect(isArray(pre) && isDefined(pre)).toBe(true);
                const regexpCopy = (pre as [RegExp, string])[0];
                expect(isRegExp(regexpCopy)).toEqual(true);
                expect(regexp.source).toEqual(regexpCopy.source);
                // Different references
                expect(regexpCopy).not.toBe(regexp);
            }
            expect(configCopy.verbatim['Example']?.transformers.post).toBe(
                config.verbatim.Example.transformers.post,
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

const preprocessor = await sveltex(
    {
        markdownBackend: 'micromark',
        codeBackend: 'escape',
        mathBackend: 'none',
    },
    {
        verbatim: {
            Verbatim: { type: 'escape' },
        },
    },
);

function preprocessFn<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
>(preprocessor: Sveltex<M, C, T>) {
    return async (input: string, filename: string = 'test.sveltex') => {
        return (await preprocessor.markup({ content: input, filename }))?.code;
    };
}

const preprocess = preprocessFn(preprocessor);

// suite.skip.each([
//     [
//         [
//             'hello',
//             '<Verbatim>',
//             'test1',
//             'test2',
//             'test3',
//             'test4',
//             'test5',
//             'test6',
//             'test7',
//             'test8',
//             'test9',
//             '</Verbatim>',
//             'there', // 1
//             '`1`', // 2
//             '{#if condition}', // 3
//             '*a* {mustache}', // 4
//             '{:else}', // 5
//             '**b**', // 6
//             '{/if}', // 7
//             '*italic*', // 8
//             '`code`', // 9
//             'or **bold**', // 10
//         ],
//         [
//             null,
//             null,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             1,
//             15,
//             15,
//             17,
//             17,
//             19,
//             19,
//             19,
//             19,
//         ],
//     ],
// ])('source maps', async (inputLines, lineMap) => {
//     const input = inputLines.join('\n');
//     const result = (await preprocessor.markup({
//         content: input,
//         filename: 'test.sveltex',
//     })) as Processed | undefined;
//     if (result === undefined) {
//         return;
//     }
//     const output = result.code;
//     const outputLines = output.split('\n');
//     const map = result.map;
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,
//     // @typescript-eslint/no-explicit-any,
//     // @typescript-eslint/no-non-null-assertion
//     if (map === undefined) {
//         return;
//     }
//     const smc = await new SourceMapConsumer(map);
//     describe('output', () => {
//         it('should be as expected', () => {
//             expect(output).toEqual(
//                 [
//                     '<script>', // 1
//                     '</script>', // 2
//                     'hello', // 3
//                     '<Verbatim>', // 4
//                     'test1',
//                     'test2',
//                     'test3',
//                     'test4',
//                     'test5',
//                     'test6',
//                     'test7',
//                     'test8',
//                     'test9',
//                     '</Verbatim>', // 10
//                     'there', // 11
//                     '<code>1</code>', // 12
//                     '{#if condition}', // 13
//                     '<em>a</em> {mustache}', // 14
//                     '{:else}', // 15
//                     '<strong>b</strong>', // 16
//                     '{/if}', // 17
//                     '<em>italic</em>', // 18
//                     '<code>code</code>', // 19
//                     'or <strong>bold</strong>', // 20
//                 ].join('\n'),
//             );
//         });
//     });

//     describe.each(range(1, outputLines.length))(
//         'preimage of line %o of result',
//         (outputLine) => {
//             const outputLineIndex0 = outputLine - 1;
//             const origPos = smc.originalPositionFor({
//                 line: outputLine,
//                 column: 0,
//             });
//             it(`output line ${String(outputLine)} comes from input line ${String(lineMap[outputLineIndex0])}`, async () => {
//                 const input = inputLines.join('\n');
//                 await preprocessor.markup({
//                     content: input,
//                     filename: 'test.sveltex',
//                 });
//                 // const outputLines = output.split('\n');
//                 // const map = result?.map;
//                 expect(origPos.line).toEqual(lineMap[outputLineIndex0]);
//             });
//         },
//     );

//     describe('should provide empty source map if sorcery fails', () => {
//         it('should provide empty source map', async () => {
//             const sorceryLoadMock = vi
//                 .spyOn(await import('sorcery'), 'load')
//                 .mockResolvedValueOnce(null);
//             const result = (await preprocessor.markup({
//                 content: input,
//                 filename: 'test.sveltex',
//             })) as Processed;
//             expect(result.map).toEqual({
//                 file: 'test.sveltex',
//                 mappings: '',
//                 names: [],
//                 sources: [],
//                 sourcesContent: [],
//                 version: 3,
//             });
//             sorceryLoadMock.mockRestore();
//         });
//     });
// });

describe('edge cases', () => {
    let s: Sveltex<'marked', 'starry-night'>;
    beforeAll(async () => {
        s = await sveltex(
            {
                markdownBackend: 'marked',
                codeBackend: 'starry-night',
            },
            {
                verbatim: {
                    Verbatim: { type: 'escape' },
                    Verb: { type: 'escape' },
                    TeX: { type: 'tex' },
                },
                code: {
                    languages: 'common',
                },
            },
        );
    });
    async function markup(content: string, filename: string = 'test.sveltex') {
        return (await s.markup({ content, filename }))?.code;
    }

    describe('escaping edge cases', () => {
        it('Verb inside Verbatim', async () => {
            expect(
                await markup(
                    [
                        '<Verbatim>',
                        '<Verb>',
                        'test',
                        '</Verb>',
                        '</Verbatim>',
                    ].join('\n'),
                ),
            ).toContain(
                '<Verbatim>\n&lt;Verb&gt;\ntest\n&lt;/Verb&gt;\n</Verbatim>',
            );
        });

        it('Code inside Verbatim', async () => {
            expect(
                await markup(
                    ['<Verbatim>', '```', 'test', '```', '</Verbatim>'].join(
                        '\n',
                    ),
                ),
            ).toContain('<Verbatim>\n```\ntest\n```\n</Verbatim>');
        });

        it('dollar signs in mustache tags', async () => {
            expect(await markup(["text {'$$'} text"].join('\n'))).toContain(
                "text {'$$'} text",
            );
        });
    });
});

describe('Sveltex.markup()', () => {
    describe('basics', () => {
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
        ])('supports unicode %#', async (str) => {
            expect(await preprocess(str)).toContain(
                `<script>\n</script>\n<p>${str}</p>`,
            );
        });
    });

    describe('respects svelte syntax', () => {
        const tests = [
            {
                label: 'script tag',
                input: '<script>console.log("_test_")</script>\n<p>test</p>',
            },
            {
                label: 'style tag',
                input: '<style> .hello {\n/* comment */ \n color: red; }</style>',
                expected:
                    '<script>\n</script>\n\n<style> .hello {\n/* comment */ \n color: red; }</style>',
            },
            {
                label: 'svelte:head tag',
                input: '<svelte:head><title>_test_</title></svelte:head>',
                expected:
                    '<script>\n</script>\n<svelte:head><title>_test_</title></svelte:head>',
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
                label: 'svelte:element tag',
                input: '<svelte:element>foo</svelte:element>',
                expected:
                    '<script>\n</script>\n<p><svelte:element>foo</svelte:element></p>',
            },
            {
                label: 'if block',
                input: '{#if condition}\nA\n{/if}',
                expected:
                    '<script>\n</script>\n{#if condition}\n<p>A</p>\n{/if}',
            },
            {
                label: 'else block',
                input: '{#if condition}\nA\n{:else}\nB\n{/if}',
                expected:
                    '<script>\n</script>\n{#if condition}\n<p>A</p>\n{:else}\n<p>B</p>\n{/if}',
            },
            {
                label: 'else if block',
                input: '{#if condition}\n>A\n{:else if otherCondition}\n*B*\n{:else}\nC\n{/if}',
                expected:
                    '<script>\n</script>\n{#if condition}\n<blockquote>\n<p>A</p>\n</blockquote>\n{:else if otherCondition}\n<p><em>B</em></p>\n{:else}\n<p>C</p>\n{/if}',
            },
            {
                label: 'each block',
                input: '{#each items as item}\n*A* {item} B\n{/each}',
                expected:
                    '<script>\n</script>\n{#each items as item}\n<p><em>A</em> {item} B</p>\n{/each}',
            },
            {
                label: 'await block',
                input: '{#await promise}\n*loading...*\n{:then value}\n{value}\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
                expected:
                    '<script>\n</script>\n{#await promise}\n<p><em>loading...</em></p>\n{:then value}\n<p>{value}</p>\n{:catch error}\n<p style="color: red">{error.message}</p>\n{/await}',
            },
            {
                label: 'html block',
                input: '<script>\n</script>\n{@html "<p>hello, world!</p>"}',
                expected:
                    '<script>\n</script>\n<p>{@html "<p>hello, world!</p>"}</p>',
            },
            {
                label: 'tags with uppercase letters',
                input: '<MyComponent test="a" {c} test2={b} g="">foo</MyComponent>',
                expected:
                    /<MyComponent test="a" \{c\} test2=("?)\{b\}\1 g="">foo<\/MyComponent>/,
            },
        ];
        it.each(tests)('$label', async (test) => {
            const expected = test.expected ?? test.input;
            expect(removeEmptyLines(await preprocess(test.input))).toMatch(
                isString(expected) ? removeEmptyLines(expected) : expected,
            );
        });
    });

    describe("code blocks don't need more than one newline character around them", () => {
        it('should work', async () => {
            expect(
                await preprocess(
                    '\n\ntext\n```typescript\n() => {let a}\n```\ntext\n',
                ),
            ).toContain(
                '<p>text</p>\n<pre><code class="language-typescript">() =&gt; &lbrace;let a&rbrace;\n</code></pre>\n<p>text</p>',
            );
        });
    });

    // eslint-disable-next-line vitest/valid-describe-callback
    describe.concurrent('transforms inline markdown', async () => {
        const preprocessor = await sveltex({
            markdownBackend: 'marked',
            codeBackend: 'escape',
            mathBackend: 'none',
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
                expected: '<script>\n</script>\n<p><strong>strong</strong></p>',
            },
            {
                label: 'em',
                input: '_em_',
                expected: '<script>\n</script>\n<p><em>em</em></p>',
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
                    '<script>\n</script>\n<p><a href="https://example.com">link</a></p>',
            },
            {
                label: 'img',
                input: '![alt](https://example.com/image.jpg)',
                expected:
                    '<script>\n</script>\n<p><img src="https://example.com/image.jpg" alt="alt" /></p>',
            },
        ];
        it.each(tests)('$label', async (test) => {
            expect(await preprocess(test.input)).toContain(test.expected);
        });
    });

    describe.concurrent('transforms markdown blocks', () => {
        const tests = [
            {
                label: 'h1',
                input: '# Hello, world!',
                expected: '<h1>Hello, world!</h1>',
            },
            {
                label: 'h2',
                input: '## Hello, world!',
                expected: '<h2>Hello, world!</h2>',
            },
            {
                label: 'h3',
                input: '### Hello, world!',
                expected: '<h3>Hello, world!</h3>',
            },
            {
                label: 'h4',
                input: '#### Hello, world!',
                expected: '<h4>Hello, world!</h4>',
            },
            {
                label: 'h5',
                input: '##### Hello, world!',
                expected: '<h5>Hello, world!</h5>',
            },
            {
                label: 'h6',
                input: '###### Hello, world!',
                expected: '<h6>Hello, world!</h6>',
            },
            {
                label: 'blockquote',
                input: '> blockquote',
                expected: '<blockquote>\n<p>blockquote</p>\n</blockquote>',
            },
            {
                label: 'unordered list (-)',
                input: '- ul',
                expected: '<ul>\n<li>ul</li>\n</ul>',
            },
            {
                label: 'code block',
                input: '```\nsomething\n```',
                expected: '<pre><code>something\n</code></pre>',
            },
        ];
        it.each(tests)('$label', async (test) => {
            expect(await preprocess(test.input)).toContain(test.expected);
        });
    });

    describe('works with code blocks', () => {
        it('starry night should work with this', async () => {
            const preprocessor = await sveltex(
                {
                    markdownBackend: 'marked',
                    codeBackend: 'starry-night',
                    mathBackend: 'none',
                },
                { code: { languages: 'common' } },
            );
            expect(
                (
                    await preprocessor.markup({
                        filename: 'test.sveltex',
                        content: '```typescript\n() => {let a}\n```',
                    })
                )?.code,
            ).toContain(
                '<pre><code class="language-typescript">() <span class="pl-k">=&gt;</span> &lbrace;<span class="pl-k">let</span> <span class="pl-smi">a</span>&rbrace;\n</code></pre>',
            );
        });

        it.each([
            {
                label: 'code block (plain)',
                input: '```\n() => {let a}\n```',
                expected:
                    '<svelte:head>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@wooorm/starry-night@latest/style/both.css">\n</svelte:head>\n<script context="module">\n</script>\n<script>\n</script>\n<pre><code>() =&gt; &lbrace;let a&rbrace;\n</code></pre>',
            },
            {
                label: 'code block (ts)',
                input: '```typescript\n() => {let a}\n```',
                expected:
                    '<svelte:head>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@wooorm/starry-night@latest/style/both.css">\n</svelte:head>\n<script context="module">\n</script>\n<script>\n</script>\n<pre><code class="language-typescript">() <span class="pl-k">=&gt;</span> &lbrace;<span class="pl-k">let</span> <span class="pl-smi">a</span>&rbrace;\n</code></pre>',
            },
        ])('$label', async (test) => {
            const preprocessor = await sveltex(
                {
                    markdownBackend: 'marked',
                    codeBackend: 'starry-night',
                    mathBackend: 'none',
                },
                { code: { languages: 'common' } },
            );
            const preprocess = async (
                input: string,
                filename: string = 'test.sveltex',
            ) => {
                return (await preprocessor.markup({ content: input, filename }))
                    ?.code;
            };
            expect(await preprocess(test.input)).toContain(test.expected);
        });
    });

    describe.concurrent('works with mustache tags', () => {
        const tests = [
            {
                label: 'strong',
                input: '**{strong}**',
                expected:
                    '<script>\n</script>\n<p><strong>{strong}</strong></p>',
            },
            {
                label: 'em',
                input: '_{em}_',
                expected: '<script>\n</script>\n<p><em>{em}</em></p>',
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
                    '<script>\n</script>\n<p><a href="https://example.com">{link}</a></p>',
            },
            {
                label: 'img',
                input: '![{alt}](https://example.com/image.jpg)',
                expected:
                    '<script>\n</script>\n<p><img src="https://example.com/image.jpg" alt="{alt}" /></p>',
            },
        ];
        it.each(tests)('$label', async (test) => {
            expect(await preprocess(test.input)).toContain(test.expected);
        });
    });

    describe('verbatim environments', () => {
        let preprocessVerbatim: (
            input: string,
            filename?: string,
        ) => Promise<string | undefined>;
        beforeAll(async () => {
            const preprocessorVerbatim = await sveltex(
                {
                    codeBackend: 'highlight.js',
                },
                {
                    verbatim: {
                        Verbatim: {
                            type: 'escape',
                            escape: {
                                braces: true,
                                html: true,
                            },
                        },
                        Code: {
                            type: 'code',
                        },
                    },
                },
            );
            preprocessVerbatim = preprocessFn(preprocessorVerbatim);
        });

        it('should work with custom verbatim environments', async () => {
            expect(
                await preprocessVerbatim('<Verbatim>{test}</Verbatim>'),
            ).toContain('<Verbatim>&lbrace;test&rbrace;</Verbatim>');
        });

        it('should work with code verbatim environments', async () => {
            expect(
                await preprocessVerbatim('<Code>\n{test}\n</Code>'),
            ).toContain(
                '<Code><pre><code>&lbrace;test&rbrace;\n</code></pre></Code>',
            );
        });

        it('should respect inline attribute', async () => {
            expect(
                await preprocessVerbatim(
                    '<Code inline="true">\n{test}\n</Code>',
                ),
            ).toContain('<Code><code>&lbrace;test&rbrace;</code></Code>');
        });

        it('should work with TeX verbatim environments', async () => {
            const preprocessor = await sveltex(
                {},
                {
                    verbatim: {
                        Verbatim: {
                            type: 'escape',
                            escape: {
                                braces: true,
                                html: true,
                            },
                        },
                    },
                },
            );
            const preprocess = preprocessFn(preprocessor);
            expect(await preprocess('$x$')).toContain(
                '<script>\n</script>\n$x$',
            );
        });
    });

    describe('frontmatter', () => {
        it('frontmatter metadata', async () => {
            const preprocessor = await sveltex({
                markdownBackend: 'micromark',
            });
            const preprocess = preprocessFn(preprocessor);
            expect(
                await preprocess(
                    [
                        '---',
                        'foo: bar',
                        'title: Example',
                        'author: Jane Doe',
                        '---',
                        '*text*',
                    ].join('\n'),
                ),
            ).toEqual(
                '<svelte:head>\n<title>Example</title>\n<meta name="author" content="Jane Doe">\n</svelte:head>\n<script context="module">\n</script>\n<script>\n</script>\n\n<p><em>text</em></p>',
            );
        });
    });

    describe('script tags', () => {
        describe('doesn\'t add <script> or <script context="module"> tags if already present', () => {
            it.each([
                [
                    '<script>\n</script>',
                    /^\n*<script context="module">\n+<\/script>\n+<script>\n+<\/script>\n*$/,
                ],
                [
                    '<script lang="ts">\n</script>',
                    /^\n*<script context="module">\n+<\/script>\n+<script lang="ts">\n+<\/script>\n*$/,
                ],
                [
                    '<script context="module">\n</script>',
                    /^\n*<script>\n+<\/script>\n+<script context="module">\n+<\/script>\n*$/,
                ],
                [
                    '<script context="module">\n</script>\n<script>\n</script>',
                    /^\n*<script context="module">\n+<\/script>\n+<script>\n+<\/script>\n*$/,
                ],
                [
                    '<script context="module" lang="ts">\n</script>\n<script>\n</script>',
                    /^\n*<script context="module" lang="ts">\n+<\/script>\n+<script>\n+<\/script>\n*$/,
                ],
                [
                    '<script lang="ts" context="module">\n</script>\n<script>\n</script>',
                    /^\n*<script lang="ts" context="module">\n+<\/script>\n+<script>\n+<\/script>\n*$/,
                ],
            ])('%o → %o', async (input, expected) => {
                const preprocessor = await sveltex();
                const preprocess = preprocessFn(preprocessor);
                expect(await preprocess(input)).toMatch(expected);
            });
        });
    });

    describe('misc', () => {
        let preprocessMisc: (
            input: string,
            filename?: string,
        ) => Promise<string | undefined>;
        beforeAll(async () => {
            const preprocessorMisc = await sveltex(
                { codeBackend: 'escape' },
                { extensions: undefined },
            );
            preprocessMisc = preprocessFn(preprocessorMisc);
        });
        it('`{}`', async () => {
            expect(await preprocessMisc('`{}`')).toContain(
                '<code>&lbrace;&rbrace;</code>',
            );
        });
        it('sveltex(undefined, {})', async () => {
            expect(async () => await sveltex(undefined, {})).not.toThrow();
            expect(await sveltex(undefined, {})).toBeInstanceOf(Sveltex);
        });
        it("sveltex({ markdownBackend: 'custom' })", async () => {
            expect(
                async () => await sveltex({ markdownBackend: 'custom' }),
            ).not.toThrow();
            expect(await sveltex({ markdownBackend: 'custom' })).toBeInstanceOf(
                Sveltex,
            );
        });
    });
});
