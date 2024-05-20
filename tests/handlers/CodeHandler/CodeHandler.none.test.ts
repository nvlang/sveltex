import { describe, it, expect, beforeAll } from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { mockFs } from '$dev_deps.js';
mockFs({});

describe("CodeHandler<'none'>", () => {
    let handler: CodeHandler<'none'>;
    beforeAll(async () => {
        handler = await CodeHandler.create('none');
    });

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
                const output = (
                    await handler.process('a <b> {c}', {
                        lang: 'plaintext',
                    })
                ).processed;
                const expected = 'a <b> {c}\n';
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
                const defaultOptions = {
                    lang: 'plaintext',
                    _wrap: true,
                    inline: false,
                    wrapClassPrefix: 'test-',
                };
                expect(
                    handler.configuration.wrap({
                        ...defaultOptions,
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
                        ...defaultOptions,
                        wrapClassPrefix: 'test-',
                        lang: 'js',
                    }),
                ).toEqual(['', '']);
            });
        });
    });

    describe('backend', () => {
        it("is 'none'", () => {
            expect(handler.backend).toBe('none');
        });
    });
});
