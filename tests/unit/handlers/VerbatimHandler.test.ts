import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { sveltex } from '$Sveltex.js';
import { spy } from '$tests/unit/fixtures.js';

const sveltexPreprocessor = await sveltex(
    { codeBackend: 'highlight.js' },
    {
        verbatim: {
            Code: {
                type: 'code',
                aliases: ['CodeBlock'],
            },
            noop: { type: 'noop' },
            JS: {
                type: 'code',
                defaultAttributes: {
                    lang: 'js',
                },
                attributeForwardingBlocklist: [],
                component: 'JavaScript',
            },
            Verbatim: {
                type: 'escape',
                escape: {
                    braces: true,
                    html: true,
                },
            },
            Ambiguous: { type: 'noop' },
            tex: {
                type: 'tex',
                // aliases: ['Ambiguous'],
            },
        },
    },
);

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('VerbatimHandler', () => {
    let log: MockInstance;
    let existsSync: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['log', 'existsSync']);
        log = mocks.log;
        existsSync = mocks.existsSync;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    fixture();

    describe('constructor(sveltex: Sveltex)', () => {
        fixture();
        it('logs error to console if a duplicate verbatim environment name/alias detected', async () => {
            await sveltex(
                {},
                {
                    verbatim: {
                        Code: { type: 'noop', aliases: ['Example'] },
                        Example: { type: 'noop', aliases: ['Code'] },
                    },
                },
            );
            expect(log).toHaveBeenCalledTimes(2);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(
                    'Duplicate verbatim environment name/alias "Example".',
                ),
            );
            expect(log).toHaveBeenNthCalledWith(
                2,
                'error',
                expect.stringContaining(
                    'Duplicate verbatim environment name/alias "Code".',
                ),
            );
        });

        it('duplicate verbatim environment detection is case-sensitive', async () => {
            await sveltex(
                {},
                {
                    verbatim: {
                        CodeBlock: {
                            type: 'noop',
                            aliases: ['Example'],
                        },
                        example: {
                            type: 'noop',
                            aliases: ['codeBlock'],
                        },
                    },
                },
            );
            expect(log).toHaveBeenCalledTimes(0);
        });
    });
    describe('process(content: string)', () => {
        fixture();
        it('should process JS code correctly', async () => {
            const result = (
                await sveltexPreprocessor.markup({
                    filename: 'test.sveltex',
                    content:
                        '<Code lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                })
            )?.code;
            expect(result).toContain(
                '<Code><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></Code>',
            );
        });

        it('should escape plain text correctly', async () => {
            const result = (
                await sveltexPreprocessor.markup({
                    filename: 'test.sveltex',
                    content:
                        '<Code>\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                })
            )?.code;
            expect(result).toContain(
                '<Code><pre><code>const a = new Map&lt;string, &lbrace; prop: number[] &rbrace;&gt;();\n</code></pre></Code>',
            );
        });

        it('should correctly handle self-closing components', async () => {
            expect(
                (
                    await (
                        await sveltex(
                            {},
                            {
                                verbatim: {
                                    Code: {
                                        type: 'code',
                                        selfCloseOutputWith: ' />',
                                    },
                                },
                            },
                        )
                    ).markup({
                        filename: 'test.sveltex',
                        content: '<Code id="something"/>',
                    })
                )?.code,
            ).toContain('<Code id="something" />');
            expect(
                (
                    await (
                        await sveltex(
                            {},
                            {
                                verbatim: {
                                    Code: {
                                        type: 'code',
                                        selfCloseOutputWith: '/>',
                                    },
                                },
                            },
                        )
                    ).markup({
                        filename: 'test.sveltex',
                        content: '<Code id="something" />',
                    })
                )?.code,
            ).toContain('<Code id="something"/>');
            const p = await sveltex(
                {},
                {
                    verbatim: {
                        Code: {
                            type: 'code',
                            selfCloseOutputWith: 'auto',
                        },
                    },
                },
            );
            expect(
                (
                    await p.markup({
                        filename: 'test.sveltex',
                        content: '<Code id="something" />',
                    })
                )?.code,
            ).toContain('<Code id="something" />');
            expect(
                (
                    await p.markup({
                        filename: 'test.sveltex',
                        content: '<Code id="something"/>',
                    })
                )?.code,
            ).toContain('<Code id="something"/>');
        });

        it('should correctly handle self-closing components (TeX)', async () => {
            existsSync.mockReturnValue(true);
            expect(
                (
                    await (
                        await sveltex(
                            {},
                            { verbatim: { tex: { type: 'tex' } } },
                        )
                    ).markup({
                        filename: 'test.sveltex',
                        content: '<tex ref=something />',
                    })
                )?.code,
            ).toContain(
                '<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure>',
            );
            existsSync.mockReset();
        });

        it('should work with custom transformers', async () => {
            expect(
                (
                    await (
                        await sveltex(
                            { codeBackend: 'starry-night' },
                            {
                                verbatim: {
                                    Code: {
                                        type: 'code',
                                        transformers: {
                                            pre: [/\/\/(.*)/, ''],
                                            post: [
                                                'class="pl-',
                                                'class="code-',
                                            ],
                                        },
                                    },
                                },
                            },
                        )
                    ).markup({
                        filename: 'test.sveltex',
                        content:
                            '<Code lang="ts">\nconst a = 0; // comment 1\nlet b: string; // comment 2\n</Code>',
                    })
                )?.code,
            ).toContain(
                '<Code><pre><code class="language-ts"><span class="code-k">const</span> <span class="code-c1">a</span> <span class="code-k">=</span> <span class="code-c1">0</span>; \n<span class="code-k">let</span> <span class="code-smi">b</span><span class="code-k">:</span> <span class="code-c1">string</span>; \n</code></pre></Code>',
            );
        });

        it('should enforce attributeForwardingAllowlist and attributeForwardingBlocklist', async () => {
            const sp = await sveltex(
                {},
                {
                    verbatim: {
                        Code: {
                            type: 'code',
                            attributeForwardingAllowlist: ['a', 'b'],
                            attributeForwardingBlocklist: ['a', 'c'],
                        },
                    },
                },
            );
            expect(
                (
                    await sp.markup({
                        filename: 'test.sveltex',
                        content: '<Code a="1" b="2" c="3" d="4" />',
                    })
                )?.code,
            ).toContain('<Code b="2" />');
            expect(
                (
                    await sp.markup({
                        filename: 'test.sveltex',
                        content: '<Code a b c d />',
                    })
                )?.code,
            ).toContain('<Code b />');
        });

        it('should work with aliases', async () => {
            const result = (
                await sveltexPreprocessor.markup({
                    filename: 'test.sveltex',
                    content:
                        '<CodeBlock lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</CodeBlock>',
                })
            )?.code;
            expect(result).toContain(
                '<CodeBlock><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></CodeBlock>',
            );
        });

        it('should support transformation of component', async () => {
            const result = (
                await sveltexPreprocessor.markup({
                    filename: 'test.sveltex',
                    content:
                        '<JS>\nconst a = new Map<string, { prop: number[] }>();\n</JS>',
                })
            )?.code;
            expect(result).toContain(
                '<JavaScript lang="js"><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></JavaScript>',
            );
        });

        it('should support simple escape instructions', async () => {
            expect(
                (
                    await sveltexPreprocessor.markup({
                        filename: 'test.sveltex',
                        content: '<Verbatim>\n<>&{</Verbatim>',
                    })
                )?.code,
            ).toContain('<Verbatim>\n&lt;&gt;&amp;&lbrace;</Verbatim>');
        });

        it('misc', async () => {
            expect(
                (
                    await sveltexPreprocessor.markup({
                        filename: 'test.sveltex',
                        content: '<noop>abc</noop>',
                    })
                )?.code,
            ).toContain('<noop>abc</noop>');
        });
    });

    describe('configure', () => {
        it('should log helpful error if any invalid verbatim configurations are passed', async () => {
            const sp = await sveltex(
                {},
                {
                    verbatim: {
                        Code: {
                            /* eslint-disable */
                            type: 'something' as any,
                            aliases: 'something' as any,
                            attributeForwardingAllowlist: 'something' as any,
                            attributeForwardingBlocklist: 'something' as any,
                            component: 5 as any,
                            defaultAttributes: 'something' as any,
                            respectSelfClosing: 'something' as any,
                            selfCloseOutputWith: 'something' as any,
                            wrap: 'something' as any,
                            /* eslint-enable */
                        },
                        Okay: { type: 'escape' },
                    },
                },
            );
            expect(
                (
                    await sp.markup({
                        filename: 'test.sveltex',
                        content: '<Okay>{}</Okay>',
                    })
                )?.code,
            ).toContain('<Okay>&lbrace;&rbrace;</Okay>');
            expect(log).toHaveBeenCalled();
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Problems found in configuration of verbatim environment "Code":',
            );
            expect(log).toHaveBeenNthCalledWith(
                2,
                'error',
                '- Expected "aliases" to be a (possibly empty) array of strings. Instead, got a string.',
            );
            expect(log).toHaveBeenNthCalledWith(
                3,
                'error',
                '- Expected "attributeForwardingAllowlist" to be an array of strings or "all". Instead, got: \'something\'',
            );
        });
        it('should log helpful error if any invalid verbatim configurations are passed 2', async () => {
            const sp = await sveltex(
                {},
                {
                    verbatim: {
                        Code: 'something' as unknown as { type: 'code' },
                        Okay: { type: 'escape' },
                    },
                },
            );
            expect(
                (
                    await sp.markup({
                        filename: 'test.sveltex',
                        content: '<Okay>{}</Okay>',
                    })
                )?.code,
            ).toContain('<Okay>&lbrace;&rbrace;</Okay>');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Expected configuration of verbatim environment "Code" to be non-null object. Instead, got a string.',
            );
        });
    });
});
