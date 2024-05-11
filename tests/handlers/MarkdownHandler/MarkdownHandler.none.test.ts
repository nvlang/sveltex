import { suite, describe, it, expect } from 'vitest';
import { MarkdownHandler } from '$handlers/MarkdownHandler.js';

suite("MarkdownHandler<'none'>", async () => {
    const handler = await MarkdownHandler.create('none');

    describe("MarkdownHandler.create('none')", () => {
        it('returns instance of MarkdownHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MarkdownHandler);
        });
    });

    describe('markdownHandler', () => {
        describe('process()', () => {
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('leaves markdown as-is', async () => {
                const output = await handler.process('**strong** *em*');
                const expected = '**strong** *em*';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });
        });

        describe('processor', () => {
            it('equals {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configuration', () => {
            it('equals {}', () => {
                expect(handler.configuration).toEqual({});
            });
        });
    });

    describe('backend', () => {
        it("is 'none'", () => {
            expect(handler.backend).toBe('none');
        });
    });
});
