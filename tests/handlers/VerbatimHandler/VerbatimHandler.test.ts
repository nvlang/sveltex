import {
    suite,
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    type MockInstance,
} from 'vitest';

import { sveltex } from '$src/processor/Sveltex.js';
import { VerbatimHandler } from '$handlers';

const sveltexPreprocessor = await sveltex(
    'none',
    'highlight.js',
    'none',
    'none',
);

await sveltexPreprocessor.configure({
    general: {
        verbatimEnvironments: {
            Code: {
                processInner: 'code',
                aliases: ['CodeBlock'],
            },
            noop: 'noop',
            JS: {
                processInner: 'code',
                defaultAttributes: {
                    lang: 'js',
                },
                component: 'JavaScript',
            },
            Verbatim: {
                escapeBraces: true,
                escapeHtml: true,
            },
            Verbatim2: {
                processInner: {
                    escapeBraces: true,
                    escapeHtml: true,
                },
            },
            Custom: (content: string, attributes: Record<string, unknown>) =>
                'Custom: ' + content + JSON.stringify(attributes),
        },
    },
});

suite('VerbatimHandler', () => {
    let consoleErrorMock: MockInstance;
    beforeEach(() => {
        consoleErrorMock = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
    });
    afterAll(() => {
        consoleErrorMock.mockReset();
    });

    describe('verbEnvs setter', () => {
        it('setting verbEnvs to undefined should have no effect', () => {
            const origVerbEnvs = sveltexPreprocessor.verbatimHandler.verbEnvs;
            sveltexPreprocessor.verbatimHandler.verbEnvs = undefined;
            expect(sveltexPreprocessor.verbatimHandler.verbEnvs).toBe(
                origVerbEnvs,
            );
        });
    });

    describe('constructor(sveltex: Sveltex)', () => {
        it('logs error to console if a duplicate verbatim environment name/alias detected', async () => {
            const sp = await sveltex('none', 'none', 'none', 'none');
            await sp.configure({
                general: {
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
            expect(consoleErrorMock).toHaveBeenCalledTimes(2);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(
                    'Duplicate verbatim environment name/alias "Example".',
                ),
            );
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining(
                    'Duplicate verbatim environment name/alias "Code".',
                ),
            );
        });

        it('misc', async () => {
            const sp = await sveltex('none', 'none', 'none', 'none');
            await sp.configure({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                general: { verbatimEnvironments: undefined! },
            });
            expect(() => new VerbatimHandler(sp)).not.toThrowError();
        });
    });
    describe('process(content: string)', () => {
        it('should process JS code correctly', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<Code lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
            );
            expect(result).toEqual(
                '<Code lang="js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should escape plain text correctly', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<Code>\nconst a = new Map<string, { prop: number[] }>();\n</Code>',
            );
            expect(result).toEqual(
                '<Code>\nconst a = new Map&lt;string, &lbrace; prop: number[] &rbrace;&gt;();\n</Code>',
            );
        });

        it('should deal with weird content gracefully', async () => {
            const result =
                await sveltexPreprocessor.verbatimHandler.process('something');
            expect(result).toEqual('something');
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(
                    'Unexpected verbatim environment encountered: "something".',
                ),
            );
        });

        it('should deal with unknown verbatim tags gracefully', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<unknown>something</unknown>',
                ),
            ).toEqual('<unknown>something</unknown>');
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining(
                    'Unknown verbatim environment "unknown".',
                ),
            );
        });

        it('should work with aliases', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<CodeBlock lang="js">\nconst a = new Map<string, { prop: number[] }>();\n</CodeBlock>',
            );
            expect(result).toEqual(
                '<CodeBlock lang="js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</CodeBlock>',
            );
        });

        it('should support transformation of component', async () => {
            const result = await sveltexPreprocessor.verbatimHandler.process(
                '<JS>\nconst a = new Map<string, { prop: number[] }>();\n</JS>',
            );
            expect(result).toEqual(
                '<JavaScript lang="js">\n<span class="hljs-keyword">const</span> a = <span class="hljs-keyword">new</span> <span class="hljs-title class_">Map</span>&lt;string, &lbrace; <span class="hljs-attr">prop</span>: number[] &rbrace;&gt;();\n</JavaScript>',
            );
        });

        it('should support simple escape instructions', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Verbatim>\n<>&{</Verbatim>',
                ),
            ).toEqual('<Verbatim>\n&lt;&gt;&amp;&lbrace;\n</Verbatim>');

            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Verbatim2>\n<>&{</Verbatim2>',
                ),
            ).toEqual('<Verbatim2>\n&lt;&gt;&amp;&lbrace;\n</Verbatim2>');
        });

        it('should support custom processInner functions', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Custom attr="test" attr2="test2">content</Custom>',
                ),
            ).toEqual(
                '<Custom attr="test" attr2="test2">\nCustom: content{"attr":"test","attr2":"test2"}\n</Custom>',
            );

            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<Custom>content</Custom>',
                ),
            ).toEqual('<Custom>\nCustom: content{}\n</Custom>');
        });

        it('misc', async () => {
            expect(
                await sveltexPreprocessor.verbatimHandler.process(''),
            ).toEqual('');
            expect(
                await sveltexPreprocessor.verbatimHandler.process(
                    '<noop>abc</noop>',
                ),
            ).toEqual('<noop>\nabc\n</noop>');
        });
    });
});
