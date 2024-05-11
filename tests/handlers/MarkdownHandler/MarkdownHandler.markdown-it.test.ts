import { suite, describe, it, expect } from 'vitest';
import multimdTablePlugin from 'markdown-it-multimd-table';

import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import MarkdownIt from 'markdown-it';

suite("MarkdownHandler<'markdown-it'>", async () => {
    const handler = await MarkdownHandler.create('markdown-it');

    describe("MarkdownHandler.create('markdown-it')", () => {
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
                    options: { breaks: true, xhtmlOut: true },
                });
                expect(handler.processor.options.breaks).toBeTruthy();
                expect(handler.processor.options.xhtmlOut).toBeTruthy();
                expect(handler.process('a\nb')).toEqual('a<br />\nb');
                await handler.configure({
                    options: { breaks: true, xhtmlOut: false },
                });
                expect(handler.processor.options.breaks).toBeTruthy();
                expect(handler.processor.options.xhtmlOut).toBeFalsy();
                expect(handler.process('a\nb')).toEqual('a<br>\nb');
                expect(handler.configuration).toEqual({
                    options: {
                        breaks: true,
                        xhtmlOut: false,
                    },
                });
                await handler.configure({
                    extensions: [
                        // @ts-expect-error I don't really know why, I checked
                        // the signature of multimdTablePlugin and it matches
                        // the type expected by
                        // import('markdown-it').PluginWithOptions
                        multimdTablePlugin,
                        [
                            // @ts-expect-error (see above)
                            multimdTablePlugin,
                            {
                                multiline: false,
                                rowspan: false,
                                headerless: false,
                                multibody: true,
                                autolabel: true,
                            },
                        ],
                    ],
                });
                const exampleTable =
                    '|             |          Grouping           || \n' +
                    'First Header  | Second Header | Third Header | \n' +
                    ' ------------ | :-----------: | -----------: | \n' +
                    'Content       |          *Long Cell*        || \n' +
                    'Content       |   **Cell**    |         Cell | \n' +
                    '                                               \n' +
                    'New section   |     More      |         Data | \n' +
                    "And more      | With an escaped '\\|'       || \n" +
                    '[Prototype table]                              \n';
                const expected =
                    '<table>\n' +
                    '<caption id="prototypetable" style="caption-side: bottom">Prototype table</caption>\n' +
                    '<thead>\n' +
                    '<tr>\n' +
                    '<th></th>\n' +
                    '<th style="text-align:center" colspan="2">Grouping</th>\n' +
                    '</tr>\n' +
                    '<tr>\n' +
                    '<th>First Header</th>\n' +
                    '<th style="text-align:center">Second Header</th>\n' +
                    '<th style="text-align:right">Third Header</th>\n' +
                    '</tr>\n' +
                    '</thead>\n' +
                    '<tbody>\n' +
                    '<tr>\n' +
                    '<td>Content</td>\n' +
                    '<td style="text-align:center" colspan="2"><em>Long Cell</em></td>\n' +
                    '</tr>\n' +
                    '<tr>\n' +
                    '<td>Content</td>\n' +
                    '<td style="text-align:center"><strong>Cell</strong></td>\n' +
                    '<td style="text-align:right">Cell</td>\n' +
                    '</tr>\n' +
                    '</tbody>\n' +
                    '<tbody>\n' +
                    '<tr>\n' +
                    '<td>New section</td>\n' +
                    '<td style="text-align:center">More</td>\n' +
                    '<td style="text-align:right">Data</td>\n' +
                    '</tr>\n' +
                    '<tr>\n' +
                    '<td>And more</td>\n' +
                    '<td style="text-align:center" colspan="2">With an escaped \'|\'</td>\n' +
                    '</tr>\n' +
                    '</tbody>\n' +
                    '</table>\n';
                expect(await handler.process(exampleTable)).toEqual(expected);
            });
        });

        describe('processor', () => {
            it('is instance of MarkdownIt', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
                expect(handler.processor).toBeInstanceOf(MarkdownIt);
            });
        });
    });

    describe('backend', () => {
        it("is 'markdown-it'", () => {
            expect(handler.backend).toBe('markdown-it');
        });
    });
});
