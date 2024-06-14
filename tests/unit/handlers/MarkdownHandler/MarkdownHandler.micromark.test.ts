import { describe, it, expect, beforeAll } from 'vitest';

import { MarkdownHandler } from '$handlers/MarkdownHandler.js';

describe("MarkdownHandler<'micromark'>", () => {
    let handler: MarkdownHandler<'micromark'>;
    beforeAll(async () => {
        handler = await MarkdownHandler.create('micromark');
    });

    describe("MarkdownHandler.create('micromark')", () => {
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
                const output = (await handler.process('**strong** *em*', {}))
                    .processed;
                const expected = '<p><strong>strong</strong> <em>em</em></p>';
                expect(output).toEqual(expected);
            });

            it('abides by prefersInline()', async () => {
                await handler.configure({
                    prefersInline: () => false,
                });
                expect(
                    (await handler.process('<div>\n*a*\n</div>', {})).processed,
                ).toEqual('<div>\n<p><em>a</em></p>\n</div>');
                await handler.configure({
                    prefersInline: () => true,
                });
                expect(
                    (await handler.process('<div>\n*a*\n</div>', {})).processed,
                ).toEqual('<div><em>a</em></div>');
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures markdown correctly', async () => {
                await handler.configure({
                    options: { allowDangerousProtocol: true },
                });
                expect(
                    handler.configuration.options.allowDangerousProtocol,
                ).toBe(true);
                expect(
                    (
                        await handler.process(
                            '[example](unsafe://example.com)',
                            {},
                        )
                    ).processed,
                ).toEqual('<p><a href="unsafe://example.com">example</a></p>');
                await handler.configure({
                    options: { allowDangerousProtocol: false },
                });
                expect(
                    handler.configuration.options.allowDangerousProtocol,
                ).toBe(false);
                expect(
                    (
                        await handler.process(
                            '[example](unsafe://example.com)',
                            {},
                        )
                    ).processed,
                ).toEqual('<p><a href="">example</a></p>');
            });
            it('extensions: null is acceptable', async () => {
                await handler.configure({ options: { extensions: null } });
                expect(handler.configuration.options.extensions).toEqual(null);
                expect(
                    (await handler.process('*italic*', {})).processed,
                ).toEqual('<p><em>italic</em></p>');
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
