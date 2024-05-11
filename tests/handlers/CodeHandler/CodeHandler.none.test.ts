import {
    suite,
    describe,
    it,
    expect,
    afterAll,
    beforeEach,
    vi,
    type MockInstance,
} from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';
import { mockFs } from '$dev_deps.js';
mockFs({});

suite("CodeHandler<'none'>", async () => {
    const handler = await CodeHandler.create('none');

    describe("CodeHandler.create('none')", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe('codeHandler', () => {
        describe('process()', () => {
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it("doesn't escape anything", async () => {
                const output = await handler.process('a <b> {c}', {
                    lang: 'plaintext',
                });
                const expected = '\na <b> {c}\n';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('returns void/undefined', async () => {
                // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                expect(await handler.configure({})).toBeUndefined();
            });
        });

        describe('processor', () => {
            it('equals {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configuration getter', () => {
            it('has correct defaults', async () => {
                expect(
                    handler.configuration.wrap({
                        wrapClassPrefix: 'test-',
                        lang: 'js',
                    }),
                ).toEqual(['', '']);
                await handler.configure({
                    wrap: undefined,
                    wrapClassPrefix: undefined,
                });
                expect(
                    handler.configuration.wrap({
                        wrapClassPrefix: 'test-',
                        lang: 'js',
                    }),
                ).toEqual(['', '']);
            });
        });

        describe('backendIs()', () => {
            it('should work', () => {
                expect(handler.backendIs('custom')).toEqual(false);
                expect(handler.backendIs('none')).toEqual(true);
                expect(handler.backendIs('escapeOnly')).toEqual(false);
                expect(handler.backendIs('highlight.js')).toEqual(false);
                expect(handler.backendIs('prismjs')).toEqual(false);
                expect(handler.backendIs('starry-night')).toEqual(false);
            });
        });

        describe('consumeDelims()', () => {
            let consoleErrorMock: MockInstance;

            beforeEach(() => {
                consoleErrorMock = vi
                    .spyOn(consoles, 'error')
                    .mockImplementation(() => undefined);
            });
            afterAll(() => {
                consoleErrorMock.mockReset();
            });
            it('should work if no options are set with the delims', () => {
                const { innerCode, optionsFromDelims } =
                    handler.consumeDelims('```\nabc\n```');
                expect(innerCode).toEqual('abc');
                expect(optionsFromDelims).toEqual({
                    info: '',
                    inline: false,
                    lang: 'plaintext',
                });
            });

            it('should work if language is set with the delims', () => {
                const { innerCode, optionsFromDelims } = handler.consumeDelims(
                    '```language\nabc\n```',
                );
                expect(innerCode).toEqual('abc');
                expect(optionsFromDelims).toEqual({
                    info: '',
                    inline: false,
                    lang: 'language',
                });
            });

            it('should work if language and options are set with the delims', () => {
                const { innerCode, optionsFromDelims } = handler.consumeDelims(
                    '```some text here\nabc\n```',
                );
                expect(innerCode).toEqual('abc');
                expect(optionsFromDelims).toEqual({
                    info: 'text here',
                    inline: false,
                    lang: 'some',
                });
            });

            it.each([
                { input: '```\n\nabc\n\n```', expected: '\nabc\n' },
                { input: '`\n\nabc\n\n`', expected: '\n\nabc\n\n' },
            ])('should respect whitespace', (test) => {
                expect(handler.consumeDelims(test.input).innerCode).toEqual(
                    test.expected,
                );
            });

            it.each([
                {
                    input: '```some text here\nabc\n~~~',
                    expectedError:
                        'Error parsing code block (closing delimiters not found); expected the following to end with ≥3 backticks:\n```some text here\nabc\n~~~',
                    opts: undefined,
                },
                {
                    input: '~~~~language\nabc',
                    expectedError:
                        'Error parsing code block (closing delimiters not found); expected the following to end with ≥4 tildes:\n~~~~language\nabc',
                    opts: undefined,
                },
                {
                    input: '`some text here\nabc',
                    expectedError:
                        'Error parsing inline code snippet (closing delimiters not found); expected the following to end with ≥1 backticks:\n`some text here\nabc',
                    opts: undefined, // { inline: true, lang: 'plaintext', info: '' },
                },
                {
                    input: '~~some text here\nabc',
                    expectedError:
                        'Error parsing inline code snippet (closing delimiters not found); expected the following to end with ≥2 tildes:\n~~some text here\nabc',
                    opts: undefined, // { inline: true, lang: 'plaintext', info: '' },
                },
                {
                    input: 'text',
                    expectedError:
                        'Error parsing code snippet (no delimiters could be found/matched): text',
                    opts: undefined, // { inline: true, lang: 'plaintext', info: '' },
                },
            ])(
                'should log error if delims are mismatched',
                ({ input, expectedError, opts }) => {
                    const { innerCode, optionsFromDelims } =
                        handler.consumeDelims(input);
                    expect(innerCode).toEqual(input);
                    expect(optionsFromDelims).toEqual(opts);
                    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                    expect(consoleErrorMock).toHaveBeenNthCalledWith(
                        1,
                        expect.stringContaining(expectedError),
                    );
                },
            );
        });
    });

    describe('backend', () => {
        it("is 'none'", () => {
            expect(handler.backend).toBe('none');
        });
    });
});
