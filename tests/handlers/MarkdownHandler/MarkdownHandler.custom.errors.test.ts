import { suite, describe, it, expect } from 'vitest';

import {
    MarkdownHandler,
    createMarkdownHandler,
    shouldParseAsInline,
} from '$handlers';

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
        inline: boolean = !shouldParseAsInline(markdown),
        markdownHandler: MarkdownHandler<'custom'>,
    ) => {
        return inline
            ? await (markdownHandler.processor as Marked).parseInline(markdown)
            : await (markdownHandler.processor as Marked).parse(markdown);
    };
    describe('createMarkdownHandler()', () => {
        it('returns instance of MarkdownHandler', async () => {
            const handler = await createMarkdownHandler('custom', {
                processor: customProcessor,
                process: customProcess,
                configure: customConfigure,
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MarkdownHandler);
        });

        describe("createTexHandler('custom')", () => {
            it('throws error if second parameter is missing', async () => {
                await expect(() =>
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    createMarkdownHandler('custom', undefined!),
                ).rejects.toThrowError(
                    'Called createMarkdownHandler("custom", custom) without a second parameter.',
                );
            });
        });
    });
});
