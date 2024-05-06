import { suite, describe, it, expect } from 'vitest';

import { MarkdownHandler } from '$handlers';

suite("MarkdownHandler<'unified'>", async () => {
    const handler = await MarkdownHandler.create('unified');

    describe("MarkdownHandler.create('unified')", () => {
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

            it('processes markdown correctly', async () => {
                const output = await handler.process('**strong** *em*');
                const expected = '<p><strong>strong</strong> <em>em</em></p>';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures markdown correctly', async () => {
                // TODO: Add tests for configuration
                await handler.configure({
                    remarkPlugins: undefined,
                    rehypePlugins: undefined,
                });
                expect(await handler.process('**strong** *em*')).toEqual(
                    '<p><strong>strong</strong> <em>em</em></p>',
                );
                await handler.configure({});
                expect(await handler.process('**strong** *em*')).toEqual(
                    '<p><strong>strong</strong> <em>em</em></p>',
                );
            });
        });

        describe('processor', () => {
            it('is function', () => {
                expect(handler.processor).toBeTypeOf('function');
            });
        });

        describe('configuration', () => {
            it('is a property of handler', () => {
                expect('configuration' in handler).toBeTruthy();
            });
        });
    });

    describe('backend', () => {
        it("is 'unified'", () => {
            expect(handler.backend).toBe('unified');
        });
    });
});
