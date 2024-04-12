import { suite, describe, it, expect, vi } from 'vitest';

import { createCodeHandler, CodeHandler } from '$handlers';

vi.spyOn(console, 'error').mockImplementation(() => undefined);

suite("CodeHandler<'escapeOnly'>", async () => {
    const handler = await createCodeHandler('escapeOnly');

    describe("createCodeHandler('escapeOnly')", () => {
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

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = await handler.process('a <b> {c}', {
                    lang: 'plaintext',
                });
                const expected = 'a &lt;b&gt; &lbrace;c&rbrace;';
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

            it('correctly configures handler', async () => {
                await handler.configure({ escapeBraces: false });
                expect(handler.configuration.escapeBraces).toEqual(false);
                await handler.configure({ escapeBraces: true });
                expect(handler.configuration.escapeBraces).toEqual(true);
            });
        });

        describe('processor', () => {
            it('equals {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configuration', () => {
            it('is a property', () => {
                expect('configuration' in handler).toBe(true);
            });

            it('is defined', () => {
                expect(handler.configuration).toBeDefined();
            });
        });
    });

    describe('backend', () => {
        it("is 'escapeOnly'", () => {
            expect(handler.backend).toBe('escapeOnly');
        });
    });
});
