import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
} from 'vitest';

import { VerbatimHandler } from '$handlers';
import { sveltex } from '$sveltex-preprocess';
import { spy } from '$tests/fixtures.js';

const sveltexPreprocessor = await sveltex({
    markdownBackend: 'none',
    codeBackend: 'highlight.js',
    texBackend: 'none',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    verbatim: {
        verbatimEnvironments: {
            Code: {
                processInner: 'code',
                aliases: ['CodeBlock'],
            },
            noop: { processInner: 'noop' },
            JS: {
                processInner: 'code',
                defaultAttributes: {
                    lang: 'js',
                },
                attributeForwardingBlocklist: [],
                component: 'JavaScript',
            },
            Verbatim: {
                processInner: {
                    escapeBraces: true,
                    escapeHtml: true,
                },
            },
            Custom: {
                processInner: (
                    content: string,
                    attributes: Record<string, unknown>,
                ) => 'Custom: ' + content + JSON.stringify(attributes),
            },
            Ambiguous: {},
        },
    },
    advancedTex: {
        components: {
            tex: {},
            Ambiguous: {},
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

suite('VerbatimHandler', async () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });
    const { log } = await spy(['log']);
    fixture();

    describe('constructor(sveltex: Sveltex)', () => {
        fixture();
        it('logs error to console if a duplicate verbatim environment name/alias detected', async () => {
            const sp = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
                advancedTexBackend: 'none',
            });
            await sp.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            processInner: 'noop',
                            aliases: ['Example'],
                        },
                        Example: {
                            processInner: 'noop',
                            aliases: ['Code'],
                        },
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
                advancedTexBackend: 'none',
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
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<Code lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                { filename: 'test.sveltex' },
            );
            expect(result).toEqual(
                '<Code>\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should escape plain text correctly', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<Code>\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
                { filename: 'test.sveltex' },
            );
            expect(result).toEqual(
                '<Code>\nconst a = new Map&lt;string, &lbrace; prop: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should correctly handle self-closing components', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Code id="something" />',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Code id="something" />');
            await sveltexPreprocessor.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            selfCloseOutputWith: ' />',
                        },
                    },
                },
            });
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Code id="something"/>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Code id="something" />');
            await sveltexPreprocessor.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            selfCloseOutputWith: '/>',
                        },
                    },
                },
            });
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Code id="something" />',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Code id="something"/>');
            await sveltexPreprocessor.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            selfCloseOutputWith: 'auto',
                        },
                    },
                },
            });
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Code id="something" />',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Code id="something" />');
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Code id="something"/>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Code id="something"/>');
        });

        it('should correctly handle self-closing components (TeX)', async () => {
            const sp = await sveltex({ advancedTexBackend: 'local' });
            await sp.configure({
                advancedTex: {
                    components: {
                        tex: {},
                    },
                },
            });
            expect(
                await sp.verbatimHandler.process('<tex something />', {
                    filename: 'test.sveltex',
                }),
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure>',
            );
        });

        it('should enforce attributeForwardingAllowlist and attributeForwardingBlocklist', async () => {
            const sp = await sveltex();
            await sp.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            attributeForwardingAllowlist: ['a', 'b'],
                            attributeForwardingBlocklist: ['a', 'c'],
                        },
                    },
                },
            });
            expect(
                await sp.verbatimHandler.process(
                    '<Code a="1" b="2" c="3" d="4" />',
                    {
                        filename: 'test.sveltex',
                    },
                ),
            ).toEqual('<Code b="2" />');
            expect(
                await sp.verbatimHandler.process('<Code a b c d />', {
                    filename: 'test.sveltex',
                }),
            ).toEqual('<Code b />');
        });

        it.each([
            'x',
            '<Code>',
            '<Code/>x',
            '<Code/>x</Code>',
            '</Code>',
            '</Code/>',
            '<NotAVerbatimEnvironment />',
        ])('should deal with weird content gracefully: %o', async (content) => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                content,
                {
                    filename: 'test.sveltex',
                },
            );
            expect(result).toEqual(content);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(1, 'error', expect.any(String));
        });

        it('should deal with unknown verbatim tags gracefully', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<unknown>something</unknown>',
                    { filename: 'test.sveltex' },
                ),
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

        it('should deal with ambiguous verbatim tags gracefully', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Ambiguous>something</Ambiguous>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Ambiguous>something</Ambiguous>');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(
                    'HTML tag "Ambiguous" is ambiguous, as it refers to both a verbatim environment and an advanced TeX component.',
                ),
            );
        });

        it('should work with aliases', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<CodeBlock lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</CodeBlock>',
                { filename: 'test.sveltex' },
            );
            expect(result).toEqual(
                '<CodeBlock>\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</CodeBlock>',
            );
        });

        it('should support transformation of component', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<JS>\nconst a = new Map<string, { prop: number[] }>();\n</JS>',
                { filename: 'test.sveltex' },
            );
            expect(result).toEqual(
                '<JavaScript lang="js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</JavaScript>',
            );
        });

        it('should support simple escape instructions', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Verbatim>\n<>&{</Verbatim>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Verbatim>\n&lt;&gt;&amp;&lbrace;</Verbatim>');

            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Verbatim>\n<>&{</Verbatim>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Verbatim>\n&lt;&gt;&amp;&lbrace;</Verbatim>');
        });

        it('should support custom processInner functions', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Custom attr="test" attr2="test2">content</Custom>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual(
                '<Custom attr="test" attr2="test2">Custom: content{"attr":"test","attr2":"test2"}</Custom>',
            );

            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Custom>content</Custom>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<Custom>Custom: content{}</Custom>');
        });

        it('misc', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process('', {
                    filename: 'test.sveltex',
                }),
            ).toEqual('');
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<noop>abc</noop>',
                    { filename: 'test.sveltex' },
                ),
            ).toEqual('<noop>abc</noop>');
        });
    });

    describe('configure', () => {
        it('should log helpful error if any invalid verbatim configurations are passed', async () => {
            const sp = await sveltex();
            await sp.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: {
                            /* eslint-disable */
                            processInner: 'something' as any,
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
                        Okay: {},
                    },
                },
            });
            expect(sp.verbatimHandler.verbEnvs.has('Okay')).toBe(true);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Invalid verbatim environment configuration for "Code":\n- Expected "processInner" to be a valid description of how the inner content of the verbatim environment should be processed. Instead, got a string.\n- The "defaultAttributes" field must be a non-null object. Instead, got a string.\n- The "attributeForwardingBlocklist" field must be an array of strings. Instead, got a string.\n- The "attributeForwardingAllowlist" field must be an array of strings or the string "all". Instead, got a string.\n- The "component" field must be a string. Instead, got a number.\n- The "respectSelfClosing" field must be a boolean. Instead, got a string.\n- The "selfCloseOutputWith" field must be one of "auto", "/>", or " />". Instead, got a string.\n',
            );
        });
        it('should log helpful error if any invalid verbatim configurations are passed 2', async () => {
            const sp = await sveltex();
            await sp.configure({
                verbatim: {
                    verbatimEnvironments: {
                        Code: 'something' as unknown as object,
                        Okay: {},
                    },
                },
            });
            expect(sp.verbatimHandler.verbEnvs.has('Okay')).toBe(true);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Invalid verbatim environment configuration for "Code":\n- Expected configuration to be non-null object. Instead, got a string.\n',
            );
        });
    });
});
