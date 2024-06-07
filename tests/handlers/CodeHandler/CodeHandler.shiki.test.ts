import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    afterAll,
    beforeAll,
} from 'vitest';

import {
    transformerNotationDiff,
    transformerMetaHighlight,
} from '@shikijs/transformers';

import { CodeHandler } from '$handlers/CodeHandler.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe.concurrent("CodeHandler<'shiki'>", () => {
    fixture();

    let handler: CodeHandler<'shiki'>;

    beforeAll(async () => {
        handler = await CodeHandler.create('shiki', {
            shiki: { theme: 'github-dark-default' },
            // langAlias,
        });
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('tolerates different theme types', () => {
        it.each([
            { theme: 'red' },
            { themes: { light: 'red' } },
            { theme: { name: 'custom' } },
            { themes: { light: { name: 'custom' } } },
        ])('%o', async (config) => {
            const handler = await CodeHandler.create('shiki', {
                shiki: config,
            });
            const output = (await handler.process('let a = 1;', { lang: 'js' }))
                .processed;
            expect(output).toContain('<span style="');
        });
    });

    describe('works with transformers', () => {
        it('some transformer that adds class attr to <code>', async () => {
            const handler = await CodeHandler.create('shiki', {
                shiki: {
                    theme: 'github-dark-default',
                    transformers: [
                        {
                            code: (hast) => {
                                hast.properties['className'] = ['test-class'];
                                return hast;
                            },
                        },
                    ],
                },
            });
            const output = (await handler.process('let a = 1;', { lang: 'js' }))
                .processed;
            expect(output).toEqual(
                '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js test-class"><span class="line"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> a </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 1</span><span style="color:#E6EDF3">;</span></span>\n</code></pre>',
            );
        });
        it('transformerMetaHighlight', async () => {
            const handler = await CodeHandler.create('shiki', {
                shiki: {
                    theme: 'github-dark-default',
                    transformers: [
                        transformerNotationDiff(),
                        transformerMetaHighlight(),
                    ],
                },
            });
            const output = (
                await handler.process(
                    'let a = 1;\nlet b = 2; // [!code --]\nlet c = 3; // [!code ++]\nlet d = 4;',
                    {
                        lang: 'js',
                        metaString: '{1,3-4}',
                    },
                )
            ).processed;
            expect(output).toEqual(
                '<pre class="shiki github-dark-default has-diff" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js"><span class="line highlighted"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> a </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 1</span><span style="color:#E6EDF3">;</span></span>\n<span class="line diff remove"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> b </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 2</span><span style="color:#E6EDF3">; </span></span>\n<span class="line highlighted diff add"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> c </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 3</span><span style="color:#E6EDF3">; </span></span>\n<span class="line highlighted"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> d </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 4</span><span style="color:#E6EDF3">;</span></span>\n</code></pre>',
            );
        });
        it('transformerNotationDiff', async () => {
            const handler = await CodeHandler.create('shiki', {
                shiki: {
                    theme: 'github-dark-default',
                    transformers: [
                        transformerNotationDiff(),
                        transformerMetaHighlight(),
                    ],
                },
            });
            const output = (
                await handler.process(
                    'let a = 1;\nlet b = 2;\nlet c = 3;\nlet d = 4;',
                    {
                        lang: 'js',
                        metaString: '{1,3-4}',
                    },
                )
            ).processed;
            expect(output).toEqual(
                '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js"><span class="line highlighted"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> a </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 1</span><span style="color:#E6EDF3">;</span></span>\n<span class="line"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> b </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 2</span><span style="color:#E6EDF3">;</span></span>\n<span class="line highlighted"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> c </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 3</span><span style="color:#E6EDF3">;</span></span>\n<span class="line highlighted"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> d </span><span style="color:#FF7B72">=</span><span style="color:#79C0FF"> 4</span><span style="color:#E6EDF3">;</span></span>\n</code></pre>',
            );
        });
    });

    describe.concurrent("CodeHandler.create('shiki')", () => {
        fixture();
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe.concurrent('codeHandler', () => {
        fixture();
        describe.concurrent('process()', () => {
            fixture();
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('processes simple JS code correctly', async () => {
                const output = (
                    await handler.process('let a', {
                        ...handler.configuration,
                        lang: 'js',
                    })
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js"><span class="line"><span style="color:#FF7B72">let</span><span style="color:#E6EDF3"> a</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('defaults to no language', async () => {
                const output = (await handler.process('let a')).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span>let a</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('meta strings', async () => {
                const output = (await handler.process('let a')).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span>let a</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('processes plaintext correctly', async () => {
                const output = (
                    await handler.process('let a', {
                        ...handler.configuration,
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-plaintext"><span class="line"><span>let a</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = (
                    await handler.process('a <b> {c}', {
                        ...handler.configuration,
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-plaintext"><span class="line"><span>a &#x3C;b> &lbrace;c&rbrace;</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('escapes `{`, `}`, `<`, and `>` in JS code correctly', async () => {
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: 'js' },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js"><span class="line"><span style="color:#FF7B72">const</span><span style="color:#79C0FF"> a</span><span style="color:#FF7B72"> =</span><span style="color:#FF7B72"> new</span><span style="color:#D2A8FF"> Map</span><span style="color:#E6EDF3">&#x3C;</span><span style="color:#79C0FF">string</span><span style="color:#E6EDF3">, &lbrace;</span><span style="color:#FFA657">prop</span><span style="color:#FF7B72">:</span><span style="color:#79C0FF"> number</span><span style="color:#E6EDF3">&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('addLanguageClass: true, no language', async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: true,
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: undefined },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span>const a = new Map&#x3C;string, &lbrace;prop: number&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('addLanguageClass: true, language', async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: true,
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: 'js' },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="language-js"><span class="line"><span style="color:#FF7B72">const</span><span style="color:#79C0FF"> a</span><span style="color:#FF7B72"> =</span><span style="color:#FF7B72"> new</span><span style="color:#D2A8FF"> Map</span><span style="color:#E6EDF3">&#x3C;</span><span style="color:#79C0FF">string</span><span style="color:#E6EDF3">, &lbrace;</span><span style="color:#FFA657">prop</span><span style="color:#FF7B72">:</span><span style="color:#79C0FF"> number</span><span style="color:#E6EDF3">&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('addLanguageClass: false, no language', async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: false,
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: undefined },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span>const a = new Map&#x3C;string, &lbrace;prop: number&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it('addLanguageClass: false, language', async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: false,
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: 'js' },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span style="color:#FF7B72">const</span><span style="color:#79C0FF"> a</span><span style="color:#FF7B72"> =</span><span style="color:#FF7B72"> new</span><span style="color:#D2A8FF"> Map</span><span style="color:#E6EDF3">&#x3C;</span><span style="color:#79C0FF">string</span><span style="color:#E6EDF3">, &lbrace;</span><span style="color:#FFA657">prop</span><span style="color:#FF7B72">:</span><span style="color:#79C0FF"> number</span><span style="color:#E6EDF3">&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it("addLanguageClass: 'example-', language", async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: 'example-',
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: 'js' },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code class="example-js"><span class="line"><span style="color:#FF7B72">const</span><span style="color:#79C0FF"> a</span><span style="color:#FF7B72"> =</span><span style="color:#FF7B72"> new</span><span style="color:#D2A8FF"> Map</span><span style="color:#E6EDF3">&#x3C;</span><span style="color:#79C0FF">string</span><span style="color:#E6EDF3">, &lbrace;</span><span style="color:#FFA657">prop</span><span style="color:#FF7B72">:</span><span style="color:#79C0FF"> number</span><span style="color:#E6EDF3">&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });

            it("addLanguageClass: 'example-', no language", async () => {
                const handler = await CodeHandler.create('shiki', {
                    shiki: { theme: 'github-dark-default' },
                    addLanguageClass: 'example-',
                });
                const output = (
                    await handler.process(
                        'const a = new Map<string, {prop: number}>();',
                        { ...handler.configuration, lang: undefined },
                    )
                ).processed;
                const expected =
                    '<pre class="shiki github-dark-default" style="background-color:#0d1117;color:#e6edf3" tabindex="0"><code><span class="line"><span>const a = new Map&#x3C;string, &lbrace;prop: number&rbrace;>();</span></span>\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe.sequential('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });
        });
    });

    describe.concurrent('backend', () => {
        fixture();
        it("is 'shiki'", () => {
            expect(handler.backend).toBe('shiki');
        });
    });
});
