import { describe, it, expect, beforeAll } from 'vitest';

import { MarkdownHandler } from '$handlers/MarkdownHandler.js';

import { Marked, type MarkedOptions, type MarkedExtension } from 'marked';

describe("MarkdownHandler<'custom'>", () => {
    let handler: MarkdownHandler<'custom'>;
    beforeAll(async () => {
        const customProcessor = new Marked();
        interface Configuration {
            options?: MarkedOptions;
            extensions?: MarkedExtension[];
        }
        const customConfigure = (
            opts: unknown,
            markdownHandler: MarkdownHandler<'custom'>,
        ) => {
            if ((opts as Configuration).options) {
                (markdownHandler.processor as Marked).setOptions(
                    (opts as Configuration).options ?? {},
                );
            }
            if ((opts as Configuration).extensions) {
                (markdownHandler.processor as Marked).use(
                    ...((opts as Configuration).extensions ?? []),
                );
            }
        };
        const customProcess = async (
            markdown: string,
            { inline }: { inline?: boolean | undefined } | undefined = {
                inline: !MarkdownHandler.shouldParseAsInline(markdown),
            },
            markdownHandler: MarkdownHandler<'custom'>,
        ) => {
            return inline
                ? await (markdownHandler.processor as Marked).parseInline(
                      markdown,
                  )
                : await (markdownHandler.processor as Marked).parse(markdown);
        };
        handler = await MarkdownHandler.create('custom', {
            processor: customProcessor,
            process: customProcess,
            configure: customConfigure,
        });
    });

    describe("MarkdownHandler.create('custom')", () => {
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
                const output = (await handler.process('**strong** *em*'))
                    .processed;
                const expected = '<strong>strong</strong> <em>em</em>';
                expect(output).toEqual(expected);
            });

            it("automatically distinguishes between inline and 'block' markdown", async () => {
                expect((await handler.process('a\nb')).processed).toEqual(
                    'a\nb',
                );
                expect((await handler.process('a\n\nb')).processed).toEqual(
                    '<p>a</p>\n<p>b</p>\n',
                );
            });

            it('has working `inline` parameter', async () => {
                expect(
                    (await handler.process('a', { inline: true })).processed,
                ).toEqual('a');
                expect(
                    (await handler.process('a', { inline: false })).processed,
                ).toEqual('<p>a</p>\n');
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
                expect((await handler.process('a\nb')).processed).toEqual(
                    'a<br>b',
                );
                await handler.configure({
                    options: { gfm: false, breaks: false },
                });
                expect((await handler.process('a\nb')).processed).toEqual(
                    'a\nb',
                );
                expect(handler.configuration).toEqual({
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
        it("is 'custom'", () => {
            expect(handler.backend).toBe('custom');
        });
    });
});
