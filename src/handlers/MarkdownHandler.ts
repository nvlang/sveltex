// File description: Handles markdown content.

// Types
import type {
    ComponentInfo,
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
    MarkdownProcessFn,
    MarkdownProcessOptions,
    MarkdownProcessor,
} from '$types/handlers/Markdown.js';
import type { UnescapeOptions } from '$types/utils/Escape.js';

// Internal dependencies
import { missingDeps } from '$utils/env.js';
import { Handler, deepClone } from '$handlers/Handler.js';
import {
    adjustHtmlSpacing,
    micromarkDisableIndentedCodeAndAutolinks,
    remarkDisableIndentedCodeBlocksAndAutolinks,
} from '$utils/markdown.js';
import { getDefaultMarkdownConfig } from '$base/defaults.js';
import { log } from '$utils/debug.js';
import { mergeConfigs } from '$utils/merge.js';
import { copyTransformations } from '$utils/misc.js';
import { isObject, isString } from '$typeGuards/utils.js';

// External dependencies
import {
    hastFromHtml,
    hastToHtml,
    is,
    nodeAssert,
    typeAssert,
    uuid,
    XRegExp,
} from '$deps.js';
import {
    componentCanBeInParagraph,
    specials,
    tagsThatCannotBeInParagraphs,
} from '$data/markdown.js';

/**
 * Markdown handler, i.e., the class to which Sveltex delegates the processing
 * of markdown content.
 *
 * @typeParam B - Markdown backend.
 *
 * @remarks This class should not be instantiated directly. Instead, use the
 * {@link MarkdownHandler.create | `MarkdownHandler.create`} function.
 */
export class MarkdownHandler<B extends MarkdownBackend> extends Handler<
    B,
    MarkdownBackend,
    MarkdownProcessOptions,
    FullMarkdownConfiguration<B>,
    MarkdownHandler<B>
> {
    override get configuration(): FullMarkdownConfiguration<B> {
        // rfdc doesn't handle RegExps well, so we have to copy them manually
        const { pre, post } = this._configuration.transformers;
        return {
            ...deepClone(this._configuration),
            prefersInline: this._configuration.prefersInline,
            transformers: {
                pre: copyTransformations(pre),
                post: copyTransformations(post),
            },
        };
    }

    override get process(): (
        content: string,
        options: MarkdownProcessOptions,
    ) => Promise<{
        processed: string;
        unescapeOptions: UnescapeOptions;
    }> {
        return async (content: string, options: MarkdownProcessOptions) => {
            let unescapeTags: (str: string) => string = (str) => str;
            console.log({ content });
            if (!this._configuration.strict) {
                const adjusted = adjustHtmlSpacingAndEscape(
                    content,
                    this._configuration.prefersInline,
                    this._configuration.components,
                );
                content = adjusted.content;
                unescapeTags = adjusted.cleanup;
            }
            console.log({ content });
            const res = await this._process(content, options, this);
            console.log({ res });
            // Markdown processors all output strings, so this is unreachable.
            /* v8 ignore next 3 (unreachable code) */
            if (isObject(res)) {
                return { ...res, processed: unescapeTags(res.processed) };
            }
            console.log({ processed: unescapeTags(res) });
            return {
                processed: unescapeTags(res),
                unescapeOptions: { removeParagraphTag: true },
            };
        };
    }

    /**
     * Creates a markdown handler of the specified type.
     *
     * @param backend - The type of the markdown processor to create.
     * @returns A promise that resolves to a markdown handler of the specified
     * type.
     */
    static async create<B extends MarkdownBackend>(
        backend: B,
        userConfig?: MarkdownConfiguration<B>,
    ): Promise<MarkdownHandler<B>> {
        if (backend === 'custom') {
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('custom'),
                userConfig ?? {},
            );
            return new MarkdownHandler({
                backend,
                process: configuration.process,
                configuration,
            }) as unknown as MarkdownHandler<B>;
        } else if (backend === 'marked') {
            // If `backend === 'marked'`, then we know that `userConfig`, if
            // defined, must be of type `MarkdownConfiguration<'marked'>`.
            typeAssert(
                is<MarkdownConfiguration<'marked'> | undefined>(userConfig),
            );

            // Import `marked`, and throw an error if it's not available.
            let marked;
            try {
                marked = await import('marked');
            } catch (error) {
                // If the import fails, add 'marked' to the list of missing
                // dependencies and rethrow the error.
                missingDeps.push('marked');
                throw error;
            }

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('marked'),
                userConfig ?? {},
            );

            // Create a MarkdownProcessor object that will be used by the
            // `process` function to process markdown content.
            const processor: MarkdownProcessor<'marked'> = new marked.Marked({
                tokenizer: {
                    // Disable autolinks
                    autolink: () => undefined,
                    // Disable indented code blocks (NB: fenced code blocks have
                    // a separate tokenizer, named "fences").
                    code: () => undefined,
                },
            });

            // Configure the processor in accordance with the merged
            // configuration.
            processor.setOptions(configuration.options);
            processor.use(...configuration.extensions);

            const process: MarkdownProcessFn<'marked'> = async (
                markdown: string,
            ) => {
                return await processor.parse(markdown);
            };

            // Return a `MarkdownHandler` object.
            return new MarkdownHandler<'marked'>({
                backend,
                process,
                configuration,
            }) as unknown as MarkdownHandler<B>;
        } else if (backend === 'micromark') {
            // If `backend === 'micromark'`, then we know that `userConfig`, if
            // defined, must be of type `MarkdownConfiguration<'micromark'>`.
            typeAssert(
                is<MarkdownConfiguration<'micromark'> | undefined>(userConfig),
            );

            // Import `micromark`, and throw an error if it's not available.
            let micromark;
            try {
                micromark = await import('micromark');
            } catch (error) {
                // If the import fails, add 'micromark' to the list of missing
                // dependencies and rethrow the error.
                missingDeps.push('micromark');
                throw error;
            }

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('micromark'),
                userConfig ?? {},
            );

            // Define the function that will be used to process markdown
            // content.
            const process: MarkdownProcessFn<'micromark'> = (
                markdown: string,
            ) => {
                return micromark.micromark(markdown, {
                    ...configuration.options,
                    extensions: [
                        micromarkDisableIndentedCodeAndAutolinks,
                        ...(configuration.options.extensions ?? []),
                    ],
                });
            };

            // Return the MarkdownHandler object.
            return new MarkdownHandler<'micromark'>({
                backend,
                process,
                configuration,
            }) as unknown as MarkdownHandler<B>;
        } else if (backend === 'markdown-it') {
            // If `backend === 'markdown-it'`, then we know that `userConfig`,
            // if defined, must be of type
            // `MarkdownConfiguration<'markdown-it'>`.
            typeAssert(is<MarkdownConfiguration<'markdown-it'>>(userConfig));

            // Import `markdown-it`, and throw an error if it's not available.
            let MarkdownIt;
            try {
                MarkdownIt = (await import('markdown-it')).default;
            } catch (error) {
                // If the import fails, add 'markdown-it' to the list of missing
                // dependencies and rethrow the error.
                missingDeps.push('markdown-it');
                throw error;
            }

            // Create a processor object that will be used by the `process`
            // function to process markdown content.
            const processor = new MarkdownIt({
                // Allow HTML in markdown
                html: true,
            });

            // Disable indented code blocks and autolinks
            processor.disable(['code', 'autolink']);

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('markdown-it'),
                userConfig,
            );

            // Configure the processor in accordance with the merged
            // configuration.
            if (configuration.options) {
                processor.set(configuration.options);
            }
            if (configuration.extensions) {
                configuration.extensions.forEach((extension) => {
                    if (Array.isArray(extension)) {
                        processor.use(extension[0], ...extension.slice(1));
                    } else {
                        processor.use(extension);
                    }
                });
            }

            // Define the function that will be used to process markdown
            // content.
            const process: MarkdownProcessFn<'markdown-it'> = (
                markdown: string,
            ) => {
                return processor.render(markdown);
            };

            // Return the MarkdownHandler object.
            return new MarkdownHandler<'markdown-it'>({
                backend,
                process,
                configuration,
            }) as unknown as MarkdownHandler<B>;
        } else if (backend === 'unified') {
            // If `backend === 'unified'`, then we know that `userConfig`, if
            // defined, must be of type `MarkdownConfiguration<'unified'>`.
            typeAssert(
                is<MarkdownConfiguration<'unified'> | undefined>(userConfig),
            );
            type Backend = 'unified';

            // Import required modules, and throw an error if any of them are
            // not available.
            let unified,
                remarkParse,
                remarkRehype,
                remarkRetext,
                rehypeStringify;
            try {
                unified = (await import('unified')).unified;
                remarkParse = (await import('remark-parse')).default;
                remarkRehype = (await import('remark-rehype')).default;
                remarkRetext = (await import('remark-retext')).default;
                rehypeStringify = (await import('rehype-stringify')).default;
            } catch (error) {
                // If the import fails, add the missing dependencies to the list
                // of missing dependencies and rethrow the error.
                missingDeps.push(
                    'unified',
                    'remark-parse',
                    'remark-retext',
                    'remark-rehype',
                    'rehype-stringify',
                );
                throw error;
            }
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('unified'),
                userConfig ?? {},
            );
            const processor: MarkdownProcessor<'unified'> = unified()
                .use(remarkParse)
                .use(remarkDisableIndentedCodeBlocksAndAutolinks)
                .use(configuration.remarkPlugins)
                // @ts-expect-error https://github.com/remarkjs/remark-retext/issues/17#issuecomment-2170802405
                .use(remarkRetext, unified().use(configuration.retextPlugins))
                .use(remarkRehype, { allowDangerousHtml: true })
                .use(configuration.rehypePlugins)
                .use(rehypeStringify, { allowDangerousHtml: true });
            const process: MarkdownProcessFn<Backend> = async (
                markdown: string,
                opts: MarkdownProcessOptions,
            ) => {
                const res = await processor.process(markdown);
                res.messages.forEach((msg) => {
                    log(
                        msg.fatal ? 'error' : 'warn',
                        opts.filename + '\t' + msg.message,
                    );
                });
                return res.toString();
            };
            return new MarkdownHandler<Backend>({
                backend,
                process,
                configuration,
            }) as unknown as MarkdownHandler<B>;
        }
        const mergedConfiguration = mergeConfigs(
            getDefaultMarkdownConfig('none'),
            userConfig ?? {},
        );
        return new MarkdownHandler<'none'>({
            backend: 'none',
            process: (markdown: string) => markdown,
            configuration: mergedConfiguration,
        }) as unknown as MarkdownHandler<B>;
    }
}

/**
 *
 */
function adjustHtmlSpacingAndEscape(
    content: string,
    prefersInline: (tag: string) => boolean,
    components: ComponentInfo[],
): { content: string; cleanup: (str: string) => string } {
    /**
     * An UUIDv4 (without dashes) to use to escape HTML block-level element
     * tags.
     *
     * @see https://www.w3schools.com/html/html_blocks.asp
     *
     * @example
     * '69cf641f45b54d31a7f511beb97f2855'
     */
    const id = uuid().replaceAll('-', '');

    content = adjustHtmlSpacing(content, prefersInline, components);

    // Escape the aforementioned tags, so that all tags are treated equally. For
    // example: `<p>...</p>` becomes `<p${id}>...</p${id}>`.
    content = XRegExp.replace(content, regexSpecials, (match, tag) => {
        nodeAssert(isString(tag));
        const res = match.replace(tag, tag + id);
        return res;
    });

    const componentsThatCannotBeInParagraphs = components
        .filter((c) => !componentCanBeInParagraph(c))
        .map((c) => c.name);

    // Function with which the MarkdownHandler will be able to unescape the tags
    // we escaped earlier, after it is done processing the document.
    const cleanup = (str: string) => {
        console.log({ contentBeforeCleanup: str });

        let s = str
            .replaceAll(
                new RegExp(
                    `<p>(<\\s*(${[
                        ...tagsThatCannotBeInParagraphs,
                        ...componentsThatCannotBeInParagraphs,
                    ].join(
                        '|',
                    )}|[A-Z][-.:\\w]*)${id}.*?<\\/\\s*(?:\\2)${id}\\s*>)<\\/p>`,
                    'gsu',
                ),
                '$1',
            )
            .replaceAll(id, '');

        const escapedComponentNames: Record<string, string> = {};

        // escape all tags that are case-sensitive, since htmlToHast will
        // lowercase them
        s = XRegExp.replace(s, regexCaseSensitiveComponents, (match, tag) => {
            nodeAssert(isString(tag));
            if (!escapedComponentNames[tag]) {
                escapedComponentNames[tag] = uuid().replaceAll('-', '');
            }
            return match.replace(tag, escapedComponentNames[tag]);
        });

        s = hastToHtml(hastFromHtml(s, { fragment: true }), {
            allowDangerousHtml: true,
            closeSelfClosing: true,
        });
        s = s.replaceAll(/<p>\s*<\/p>/gsu, '');

        // unescape the case-sensitive tags
        Object.entries(escapedComponentNames).forEach(([tag, id]) => {
            s = s.replaceAll(id, tag);
        });

        console.log({ contentAfterCleanup: s, regexCaseSensitiveComponents });
        return s;
    };
    return { content, cleanup };
}

export function removeBadParagraphs(content: string): string {
    return content;
}

/**
 * @param s - A string.
 * @returns The number of newline characters in the string.
 *
 * @remarks
 * This function is intended to be cross-platform, in that it matches `\r`,
 * `\r\n`, and `\n`. Each of these is counted as a single newline (in
 * particular, `\r\n` is considered 1 newline).
 */
export function countNewlines(s: string): number {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\n') n++;
        else if (s[i] === '\r' && s[i + 1] !== '\n') n++;
    }
    return n;
}

// const shared: string = `
//     ^                   # (start of line)
//     {{space}}*          # (whitespace, ≥0, greedy)
//     (?<opening>         # 1: opening tag
//         <
//         /?
//         (               # 2: tag name
//             {{tag}}
//         )
//         (?:
//             {{space}}
//             [^>]*?      # (any character other than '>', ≥0, lazy)
//         )?
//         >
//     )
//     (?<leading>         # 3: leading whitespace in inner content
//         \\s*            # (whitespace, ≥0, greedy)
//     )
//     (?<inner>           # 4: inner content, trimmed
//         .*?             # (any character (incl. newline), ≥0, lazy)
//     )
//     (?<trailing>        # 5: trailing whitespace in inner content
//         \\s*            # (whitespace, ≥0, greedy)
//     )
//     (?<closing>         # 6: closing tag
//         </
//         \\s*
//         \\2
//         \\s*
//         >
//     )?
// `;

const htmlTag: string = `
    (?:                 # (html tag, with delims and possibly attributes)
        <
        /?              # (optional backslash)
        \\s*            # (whitespace, ≥0, greedy)
        (               # 1: tag name
            {{tag}}
        )
        (?:
            {{space}}
            [^>]*?      # (any character other than '>', ≥0, lazy)
        )?
        \\s*            # (whitespace, ≥0, greedy)
        /?              # (optional backslash)
        >
    )
`;

const space: string = '[ \\t]';
// const newline: string = '(?:\\r\\n?|\\n)';

// const regexAny: RegExp = XRegExp.build(
//     shared,
//     { tag: '(?:[a-zA-Z][-.:0-9_a-zA-Z]*)', space, newline },
//     'gimsux',
// );

const regexSpecials: RegExp = XRegExp.build(
    htmlTag,
    {
        space,
        tag: '(?:' + specials.join('|') + ')',
    },
    'gimsux',
);

const regexCaseSensitiveComponents: RegExp = XRegExp.build(
    htmlTag,
    {
        space,
        tag:
            '(?:' +
            '(?:[A-Z][-.:0-9_a-zA-Z]*)' +
            '|' +
            '(?:[a-z][-.:0-9_a-zA-Z]*[A-Z][-.:0-9_a-zA-Z]*)' +
            ')',
    },
    'gmsux',
);
