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
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    '\nconst a = new Map<string, { prop: number[] }>();\n',
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
                '<Code>\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should escape plain text correctly', async () => {
            const result = (
                await sveltexPreprocessor.verbatimHandler.process(
                    '\nconst a = new Map<string, { prop: number[] }>();\n',
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
                '<Code>\nconst a = new Map&lt;string, &lbrace; prop: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should correctly handle self-closing components', async () => {
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
                    verbatimEnvironments: {
                        Code: {
                            selfCloseOutputWith: '/>',
                        },
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
                    verbatimEnvironments: {
                        Code: {
                            selfCloseOutputWith: 'auto',
                        },
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
            const sp = await sveltex({ advancedTexBackend: 'local' });
            await sp.configure({
                advancedTex: {
                    components: {
                        tex: {},
                    },
                },
            });
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

        it('should deal with ambiguous verbatim tags gracefully', async () => {
            expect(
                (
                    await sveltexPreprocessor.verbatimHandler.process(
                        '<Ambiguous>something</Ambiguous>',
                        {
                            filename: 'test.sveltex',
                            selfClosing: false,
                            tag: 'Ambiguous',
                            attributes: {},
                            outerContent: '<Ambiguous>something</Ambiguous>',
                        },
                    )
                ).processed,
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
                '<CodeBlock>\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</CodeBlock>',
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
                '<JavaScript lang="js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</JavaScript>',
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

        it('should support custom processInner functions', async () => {
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
