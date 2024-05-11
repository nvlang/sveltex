import { suite, describe, it, expect } from 'vitest';

import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { Marked } from 'marked';

suite("MarkdownHandler<'marked'>", async () => {
    const handler = await MarkdownHandler.create('marked');

    describe("MarkdownHandler.create('marked')", () => {
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
                const expected = '<strong>strong</strong> <em>em</em>';
                expect(output).toEqual(expected);
            });

            it("automatically distinguishes between inline and 'block' markdown", async () => {
                expect(await handler.process('a\nb')).toEqual('a\nb');
                expect(await handler.process('a\n\nb')).toEqual(
                    '<p>a</p>\n<p>b</p>\n',
                );
            });

            it('has working `inline` parameter', async () => {
                expect(await handler.process('a', { inline: true })).toEqual(
                    'a',
                );
                expect(await handler.process('a', { inline: false })).toEqual(
                    '<p>a</p>\n',
                );
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures markdown correctly', async () => {
                await handler.configure({
                    options: { gfm: true, breaks: true },
                });
                expect(await handler.process('a\nb')).toEqual('a<br>b');
                await handler.configure({ extensions: [] });
                expect(await handler.process('a\nb')).toEqual('a<br>b');
                await handler.configure({
                    options: { gfm: false, breaks: false },
                });
                expect(await handler.process('a\nb')).toEqual('a\nb');
                expect(handler.configuration).toEqual({
                    extensions: [],
                    options: { gfm: false, breaks: false },
                });
            });
        });

        describe('processor', () => {
            it('is instance of Marked', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
                expect(handler.processor).toBeInstanceOf(Marked);
            });
        });
    });

    describe('backend', () => {
        it("is 'marked'", () => {
            expect(handler.backend).toBe('marked');
        });
    });
});
