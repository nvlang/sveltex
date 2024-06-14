import { describe, it, expect, beforeAll } from 'vitest';

import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { Marked } from 'marked';

describe("MarkdownHandler<'marked'>", () => {
    let handler: MarkdownHandler<'marked'>;
    beforeAll(async () => {
        handler = await MarkdownHandler.create('marked');
    });

    describe('markdownHandler', () => {
        describe('process()', () => {
            it('processes markdown correctly', async () => {
                const output = (await handler.process('**strong** *em*', {}))
                    .processed;
                const expected = '<p><strong>strong</strong> <em>em</em></p>\n';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('configures markdown correctly', async () => {
                await handler.configure({
                    options: { gfm: true, breaks: true },
                });
                expect((await handler.process('a\nb', {})).processed).toEqual(
                    '<p>a<br>b</p>\n',
                );
                await handler.configure({ extensions: [] });
                expect((await handler.process('a\nb', {})).processed).toEqual(
                    '<p>a<br>b</p>\n',
                );
                await handler.configure({
                    options: { gfm: false, breaks: false },
                });
                expect((await handler.process('a\nb', {})).processed).toEqual(
                    '<p>a\nb</p>\n',
                );
                expect(handler.configuration).toMatchObject({
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
