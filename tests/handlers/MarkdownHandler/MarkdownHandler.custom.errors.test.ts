import { suite, describe, it, expect } from 'vitest';

import { MarkdownHandler } from '$handlers';

import { Marked, type MarkedOptions, type MarkedExtension } from 'marked';

suite("MarkdownHandler<'custom'>", () => {
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
            ? await (markdownHandler.processor as Marked).parseInline(markdown)
            : await (markdownHandler.processor as Marked).parse(markdown);
    };
    describe('MarkdownHandler.create()', () => {
        it('returns instance of MarkdownHandler', async () => {
            const handler = await MarkdownHandler.create('custom', {
                processor: customProcessor,
                process: customProcess,
                configure: customConfigure,
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MarkdownHandler);
        });

        describe("TexHandler.create('custom')", () => {
            it('throws error if second parameter is missing', async () => {
                await expect(() =>
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    MarkdownHandler.create('custom', undefined!),
                ).rejects.toThrowError(
                    'Called MarkdownHandler.create("custom", custom) without a second parameter.',
                );
            });
        });
    });
});
