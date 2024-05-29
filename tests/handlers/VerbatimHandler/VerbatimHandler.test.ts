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

import { VerbatimHandler } from '$handlers/VerbatimHandler.js';
import { sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { FullVerbEnvConfig, VerbEnvConfig } from '$types/handlers/Verbatim.js';
import { isRegExp } from 'util/types';
import { isArray, isDefined } from '$type-guards/utils.js';

const sveltexPreprocessor = await sveltex({
    markdownBackend: 'none',
    codeBackend: 'highlight.js',
    texBackend: 'none',
});

await sveltexPreprocessor.configure({
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
            type: 'escapeOnly',
            escapeInstructions: {
                escapeBraces: true,
                escapeHtml: true,
            },
        },
        Custom: {
            type: 'custom',
            customProcess: (
                content: string,
                attributes: Record<string, unknown>,
            ) => 'Custom: ' + content + JSON.stringify(attributes),
        },
        Ambiguous: { type: 'noop' },
        tex: {
            type: 'advancedTex',
            // aliases: ['Ambiguous'],
        },
    },
});

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
    beforeAll(async () => {
        const mocks = await spy(['log']);
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    fixture();

    describe('configuration getter', () => {
        it('returns copy of configuration', async () => {
            const sp = await sveltex();
            const config = {
                Code: {
                    type: 'code',
                    transformers: {
                        pre: [/a/, 'b'],
                        post: () => 'c',
                    },
                },
            };
            await sp.configure({
                verbatim: config as unknown as Record<string, VerbEnvConfig>,
            });
            const configCopy: Record<string, FullVerbEnvConfig> =
                sp.verbatimHandler.configuration;
            expect(configCopy).toMatchObject(config);
            expect(configCopy['Code']?.transformers.pre).toEqual(
                config.Code.transformers.pre,
            );
            const regexp = config.Code.transformers.pre[0];
            if (isRegExp(regexp)) {
                const pre = configCopy['Code']?.transformers.pre;
                expect(isArray(pre) && isDefined(pre)).toBe(true);
                const regexpCopy = (pre as [RegExp, string])[0];
                expect(isRegExp(regexpCopy)).toEqual(true);
                expect(regexp.source).toEqual(regexpCopy.source);
                // Different references
                expect(regexpCopy).not.toBe(regexp);
            }
            expect(configCopy['Code']?.transformers.post).toBe(
                config.Code.transformers.post,
            );
        });
    });

    describe('constructor(sveltex: Sveltex)', () => {
        fixture();
        it('logs error to console if a duplicate verbatim environment name/alias detected', async () => {
            const sp = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
            });
            await sp.configure({
                verbatim: {
                    Code: {
                        type: 'noop',
                        aliases: ['Example'],
                    },
                    Example: {
                        type: 'noop',
                        aliases: ['Code'],
                    },
                },
            });
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

        it('misc', async () => {
            const sp = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
            });
            await sp.configure({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                verbatim: { verbatimEnvironments: undefined! },
            });
            expect(() =>
                VerbatimHandler.create(sp.codeHandler, sp.advancedTexHandler),
            ).not.toThrowError();
        });
    });
    describe('process(content: string)', () => {
        fixture();
        it('should process JS code correctly', async () => {
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    'const a = new Map<string, { prop: number[] }>();',
                    {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: 'Code',
                        attributes: { lang: 'js' },
                        outerContent:
                            '<Code lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                    },
                )
            ).processed;
            expect(result).toEqual(
                '<Code><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></Code>',
            );
        });

        it('should escape plain text correctly', async () => {
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    'const a = new Map<string, { prop: number[] }>();',
                    {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: 'Code',
                        attributes: {},
                        outerContent:
                            '<Code>\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                    },
                )
            ).processed;
            expect(result).toEqual(
                '<Code><pre><code>const a = new Map&lt;string, &lbrace; prop: number[] &rbrace;&gt;();\n</code></pre></Code>',
            );
        });

        it('should correctly handle self-closing components', async () => {
            await sveltexPreprocessor.configure({
                verbatim: {
                    Code: {
                        type: 'code',
                        selfCloseOutputWith: ' />',
                    },
                },
            });
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'Code',
                        attributes: { id: 'something' },
                        outerContent: '<Code id="something"/>',
                    })
                ).processed,
            ).toEqual('<Code id="something" />');
            await sveltexPreprocessor.configure({
                verbatim: {
                    Code: {
                        type: 'code',
                        selfCloseOutputWith: '/>',
                    },
                },
            });
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        '<Code id="something" />',
                        {
                            filename: 'test.sveltex',
                            selfClosing: true,
                            tag: 'Code',
                            attributes: { id: 'something' },
                            outerContent: '<Code id="something"/>',
                        },
                    )
                ).processed,
            ).toEqual('<Code id="something"/>');
            await sveltexPreprocessor.configure({
                verbatim: {
                    Code: { type: 'code', selfCloseOutputWith: 'auto' },
                },
            });
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'Code',
                        attributes: { id: 'something' },
                        outerContent: '<Code id="something"/>',
                    })
                ).processed,
            ).toEqual('<Code id="something"/>');
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'Code',
                        attributes: { id: 'something' },
                        outerContent: '<Code id="something" />',
                    })
                ).processed,
            ).toEqual('<Code id="something" />');
        });

        it('should correctly handle self-closing components (TeX)', async () => {
            const sp = await sveltex();
            await sp.configure({ verbatim: { tex: { type: 'advancedTex' } } });
            expect(
                (
                    await sp.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'tex',
                        attributes: { ref: 'something' },
                        outerContent: '<tex ref=something />',
                    })
                ).processed,
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure>',
            );
        });

        it('should work with custom transformers', async () => {
            const sp = await sveltex({ codeBackend: 'starry-night' });
            await sp.configure({
                verbatim: {
                    Code: {
                        type: 'code',
                        transformers: {
                            pre: [/\/\/(.*)/, ''],
                            post: ['class="pl-', 'class="code-'],
                        },
                    },
                },
            });
            expect(
                (
                    await sp.verbatimHandler.process(
                        '\nconst a = 0;\nlet b: string;\n',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'Code',
                            attributes: { lang: 'ts' },
                            outerContent:
                                '<Code>\nconst a = 0; // comment 1\nlet b: string; // comment 2\n</Code>',
                        },
                    )
                ).processed,
            ).toEqual(
                '<Code><pre><code class="language-ts"><span class="code-k">const</span> <span class="code-c1">a</span> <span class="code-k">=</span> <span class="code-c1">0</span>;\n<span class="code-k">let</span> <span class="code-smi">b</span><span class="code-k">:</span> <span class="code-c1">string</span>;\n</code></pre></Code>',
            );
        });

        it('should enforce attributeForwardingAllowlist and attributeForwardingBlocklist', async () => {
            const sp = await sveltex();
            await sp.configure({
                verbatim: {
                    Code: {
                        type: 'code',
                        attributeForwardingAllowlist: ['a', 'b'],
                        attributeForwardingBlocklist: ['a', 'c'],
                    },
                },
            });
            expect(
                (
                    await sp.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'Code',
                        attributes: { a: 1, b: 2, c: 3, d: 4 },
                        outerContent: '<Code a="1" b="2" c="3" d="4" />',
                    })
                ).processed,
            ).toEqual('<Code b="2" />');
            expect(
                (
                    await sp.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: true,
                        tag: 'Code',
                        attributes: {
                            a: undefined,
                            b: undefined,
                            c: undefined,
                            d: undefined,
                        },
                        outerContent: '<Code a b c d />',
                    })
                ).processed,
            ).toEqual('<Code b />');
        });

        it('should deal with unknown verbatim tags gracefully', async () => {
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        'something',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'unknown',
                            attributes: {},
                            outerContent: '<unknown>something</unknown>',
                        },
                    )
                ).processed,
            ).toEqual('<unknown>something</unknown>');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(
                    'Unknown verbatim environment "unknown".',
                ),
            );
        });

        it('should work with aliases', async () => {
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    '\nconst a = new Map<string, { prop: number[] }>();\n',
                    {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: 'CodeBlock',
                        attributes: { lang: 'js' },
                        outerContent:
                            '<CodeBlock lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</CodeBlock>',
                    },
                )
            ).processed;
            expect(result).toEqual(
                '<CodeBlock><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></CodeBlock>',
            );
        });

        it('should support transformation of component', async () => {
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    '\nconst a = new Map<string, { prop: number[] }>();\n',
                    {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: 'JS',
                        attributes: {},
                        outerContent:
                            '<JS>\nconst a = new Map<string, { prop: number[] }>();\n</JS>',
                    },
                )
            ).processed;
            expect(result).toEqual(
                '<JavaScript lang="js"><pre><code class="language-js"><span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</code></pre></JavaScript>',
            );
        });

        it('should support simple escape instructions', async () => {
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        '\n<>&{',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'Verbatim',
                            attributes: {},
                            outerContent: '<Verbatim>\n<>&{</Verbatim>',
                        },
                    )
                ).processed,
            ).toEqual('<Verbatim>\n&lt;&gt;&amp;&lbrace;</Verbatim>');
        });

        it('should support custom type functions', async () => {
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        'content',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'Custom',
                            attributes: { attr: 'test', attr2: 'test2' },
                            outerContent:
                                '<Custom attr="test" attr2="test2">content</Custom>',
                        },
                    )
                ).processed,
            ).toEqual(
                '<Custom attr="test" attr2="test2">Custom: content{"attr":"test","attr2":"test2"}</Custom>',
            );

            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        'content',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'Custom',
                            attributes: { attr: 'test', attr2: 'test2' },
                            outerContent:
                                '<Custom attr="test" attr2="test2">content</Custom>',
                        },
                    )
                ).processed,
            ).toEqual(
                '<Custom attr="test" attr2="test2">Custom: content{"attr":"test","attr2":"test2"}</Custom>',
            );
        });

        describe('error handling', () => {
            fixture();
            it("should complain if self-closing === true and innerContent !== ''", async () => {
                expect(
                    (
                        await sveltexPreprocessor.verbatimHandler.process(
                            'something',
                            {
                                filename: 'test.sveltex',
                                selfClosing: true,
                                tag: 'test',
                                attributes: {},
                            },
                        )
                    ).processed,
                ).toEqual('something');
                expect(log).toHaveBeenCalledTimes(1);
                expect(log).toHaveBeenNthCalledWith(
                    1,
                    'error',
                    'Self-closing HTML tag "test" should not have inner content.',
                );
            });

            it('should complain if verbatim environment is unknown', async () => {
                expect(
                    (
                        await sveltexPreprocessor.verbatimHandler.process(
                            'something',
                            {
                                filename: 'test.sveltex',
                                selfClosing: false,
                                tag: 'test',
                                attributes: {},
                            },
                        )
                    ).processed,
                ).toEqual('something');
                expect(log).toHaveBeenCalledTimes(1);
                expect(log).toHaveBeenNthCalledWith(
                    1,
                    'error',
                    'Unknown verbatim environment "test".',
                );
            });
        });

        it('misc', async () => {
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process('', {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: '',
                        attributes: {},
                        outerContent: '',
                    })
                ).processed,
            ).toEqual('');
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process('abc', {
                        filename: 'test.sveltex',
                        selfClosing: false,
                        tag: 'noop',
                        attributes: {},
                        outerContent: '<noop>abc</noop>',
                    })
                ).processed,
            ).toEqual('<noop>abc</noop>');
        });
    });

    describe('configure', () => {
        it('should log helpful error if any invalid verbatim configurations are passed', async () => {
            const sp = await sveltex();
            await sp.configure({
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
                    Okay: { type: 'code' },
                },
            });
            expect(sp.verbatimHandler.verbEnvs.has('Okay')).toBe(true);
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
            const sp = await sveltex();
            await sp.configure({
                verbatim: {
                    Code: 'something' as unknown as { type: 'code' },
                    Okay: { type: 'code' },
                },
            });
            expect(sp.verbatimHandler.verbEnvs.has('Okay')).toBe(true);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Expected configuration of verbatim environment "Code" to be non-null object. Instead, got a string.',
            );
        });
    });
});
