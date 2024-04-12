import { suite, describe, it, expect } from 'vitest';

import { MarkdownHandler, createMarkdownHandler } from '$handlers';
import {} from 'micromark';

suite("MarkdownHandler<'micromark'>", async () => {
    const handler = await createMarkdownHandler('micromark');

    describe("createMarkdownHandler('micromark')", () => {
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
                await handler.configure({ allowDangerousProtocol: true });
                expect(handler.configuration.allowDangerousProtocol).toBe(true);
                expect(
                    await handler.process('[example](unsafe://example.com)'),
                ).toEqual('<p><a href="unsafe://example.com">example</a></p>');
                await handler.configure({ allowDangerousProtocol: false });
                expect(handler.configuration.allowDangerousProtocol).toBe(
                    false,
                );
                expect(
                    await handler.process('[example](unsafe://example.com)'),
                ).toEqual('<p><a href="">example</a></p>');
            });
        });

        describe('processor', () => {
            it('equals {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configuration', () => {
            it('is a property of handler', () => {
                expect('configuration' in handler).toBeTruthy();
            });
        });
    });

    describe('backend', () => {
        it("is 'micromark'", () => {
            expect(handler.backend).toBe('micromark');
        });
    });
});
