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
} from '../types/handlers/Markdown.js';
import type { UnescapeOptions } from '../types/utils/Escape.js';

// Internal dependencies
import { missingDeps } from '../utils/env.js';
import { Handler, deepClone } from './Handler.js';
import {
    adjustHtmlSpacing,
    micromarkDisableIndentedCodeAndAutolinks,
    remarkDisableIndentedCodeBlocksAndAutolinks,
} from '../utils/markdown.js';
import { getDefaultMarkdownConfig } from '../base/defaults.js';
import { log } from '../utils/debug.js';
import { mergeConfigs } from '../utils/merge.js';
import { copyTransformations } from '../utils/misc.js';
import { isObject, isString } from '../typeGuards/utils.js';

// External dependencies
import { is, nodeAssert, sanitizeHtml, typeAssert, XRegExp } from '../deps.js';
import {
    canBeOnlyThingInParagraph,
    componentCanBeInParagraph,
    componentCanContainParagraph,
    specials,
    tagsThatCannotBeInParagraphs,
    tagsThatCannotContainParagraphs,
} from '../data/markdown.js';
import { generateId } from '../utils/escape.js';
import { diagnoseMarkdownConfiguration } from '../utils/diagnosers/markdownConfiguration.js';

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
    public override get configuration(): FullMarkdownConfiguration<B> {
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

    private configIsValid: boolean | undefined = undefined;

    public override get process(): (
        content: string,
        options: MarkdownProcessOptions,
    ) => Promise<{
        processed: string;
        unescapeOptions: UnescapeOptions;
    }> {
        return async (content: string, options: MarkdownProcessOptions) => {
            this.configIsValid ??=
                diagnoseMarkdownConfiguration(this.backend, this._configuration)
                    .errors === 0;

            if (!this.configIsValid) {
                log(
                    'error',
                    'Invalid markdown configuration. Skipping markdown processing.',
                );
                return {
                    processed: content,
                    unescapeOptions: { removeParagraphTag: true },
                };
            }

            let unescapeTags: (str: string) => string = (str) => str;

            if (!this._configuration.strict) {
                const adjusted = adjustHtmlSpacingAndEscape(
                    content,
                    this._configuration.prefersInline,
                    this._configuration.components,
                );
                content = adjusted.content;
                unescapeTags = adjusted.cleanup;
            }

            const res = await this._process(content, options, this);

            // Markdown processors all output strings, so this is unreachable.
            /* v8 ignore next 3 (unreachable code) */
            if (isObject(res)) {
                return { ...res, processed: unescapeTags(res.processed) };
            }

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
    public static async create<B extends MarkdownBackend>(
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
                    allowDangerousHtml: true,
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
                .use(remarkRehype, {
                    ...configuration.remarkRehypeOptions,
                    allowDangerousHtml: true,
                })
                .use(configuration.rehypePlugins)
                .use(rehypeStringify, {
                    ...configuration.rehypeStringifyOptions,
                    allowDangerousHtml: true,
                });
            const process: MarkdownProcessFn<Backend> = async (
                markdown: string,
                opts: MarkdownProcessOptions,
            ) => {
                const res = await processor.process(markdown);
                res.messages.forEach((msg) => {
                    log(
                        // I have no idea how to make unified emit a fatal
                        // error, and it's not all that relevant for us.
                        /* v8 ignore next 1 */
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
export function adjustHtmlSpacingAndEscape(
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
    const id = generateId();

    // Escape the aforementioned tags, so that all tags are treated equally. For
    // example: `<p>...</p>` becomes `<p${id}>...</p${id}>`.
    content = XRegExp.replace(content, regexSpecials, (match, tag) => {
        nodeAssert(isString(tag));
        const res = match.replace(tag, tag + id);
        return res;
    });

    content = adjustHtmlSpacing(content, prefersInline, components, id);

    const escaped: Record<string, string> = {};

    const balancedBracesL = '(?:[^{}]|\\{';
    const balancedBracesR = '\\})*?';
    const maxDepth = 12;

    // Escape mustache tags in attributes. It's unlikely that any will be found,
    // since mustache tags have, in principle, been escaped at an earlier stage,
    // but still, just to be sure.
    content = XRegExp.replace(
        content,
        XRegExp.build(
            '< {{tag}} \\s (?: [^>{}]*? {{mustacheTag}} [^>{}]*? )+ /? >',
            {
                tag: '(?:[a-zA-Z][-.:0-9_a-zA-Z]*)',
                mustacheTag:
                    '\\{' +
                    balancedBracesL.repeat(maxDepth) +
                    balancedBracesR.repeat(maxDepth) +
                    '\\}',
            },
            'gimsux',
        ),
        (match) => {
            return XRegExp.replace(
                match.toString(),
                /(?:(["'])\{.*\}\1)|(?:\{.*\})/gsu,
                (m) => {
                    const id_ = generateId();
                    escaped[id_] = m.toString();
                    return id_;
                },
            );
        },
    );

    const componentsThatCannotBeInParagraphs = components
        .filter((c) => !componentCanBeInParagraph(c))
        .map((c) => c.name);

    const componentsThatCannotContainParagraphs = components
        .filter((c) => !componentCanContainParagraph(c))
        .map((c) => c.name);

    // Function with which the MarkdownHandler will be able to unescape the tags
    // we escaped earlier, after it is done processing the document.
    const cleanup = (str: string) => {
        // Remove <p> tags surrounding non-phrasing HTML elements, or
        // surrounding Svelte components which are not allowed to be in
        // paragraphs, or at least not the only thing in a paragraph.
        str = XRegExp.replace(
            str,
            XRegExp.build(
                `<p>
                \\s*
                (
                    < \\s*
                    (
                        {{tagThatCannotBeInParagraphs}}
                      | {{componentThatCannotBeInParagraphs}}
                      | [A-Z][-.:0-9_a-zA-Z]*
                    )
                    (?:
                        \\s
                        [^>]*?
                      | \\s*
                    )
                    (?:
                        />
                      | >
                        .*?

                        </
                        \\s*
                        (?:\\2)
                        \\s*
                        >
                    )
                )
                \\s*
                </p>
                `,
                {
                    tagThatCannotBeInParagraphs: `(?:${tagsThatCannotBeInParagraphs.join('|')})`,
                    componentThatCannotBeInParagraphs: `(?:${componentsThatCannotBeInParagraphs.join('|')})`,
                },
                'gsux',
            ),
            (match, inner, tag) => {
                nodeAssert(isString(inner) && isString(tag));
                if (canBeOnlyThingInParagraph(tag, components)) {
                    return match.toString();
                }
                return inner;
            },
        );

        str = str.replaceAll(id, '');

        str = removeBadParagraphs(str, {
            componentsThatCannotBeInParagraphs,
            componentsThatCannotContainParagraphs,
        });

        // Unescape mustache tags in attributes.
        Object.entries(escaped).forEach(([id_, mt]) => {
            str = str.replace(
                // The escaped attribute might've been wrapped in quotes, so we
                // need to remove those if present, restoring instead the
                // original quotes, if there were any, or otherwise the original
                // lack of quotes.
                new RegExp(`(["'])${id_}\\1|${id_}`, 'gsu'),
                mt,
            );
        });

        return str;
    };

    return { content, cleanup };
}

export function removeBadParagraphs(
    content: string,
    opts: {
        componentsThatCannotBeInParagraphs: string[];
        componentsThatCannotContainParagraphs: string[];
    },
): string {
    const escaped: Record<string, string> = {};

    // escape self-closing tags, since they'd be converted into empty regular
    // tags by sanitizeHtml (unless they're any of HTML's standard void
    // elements)
    content = XRegExp.replace(
        content,
        /<\s*[a-zA-Z][-.:0-9_a-zA-Z]*(?:\s+[^>]*?)?\s*\/>/gu,
        (match) => {
            nodeAssert(isString(match));
            const id = generateId();
            escaped[id] = match;
            return id;
        },
    );

    const empty = generateId();
    escaped[empty] = '';

    // escape ...="" and ...='' attributes, since they'd be removed by
    // sanitizeHtml
    content = XRegExp.replace(
        content,
        /<\s*[a-zA-Z][-.:0-9_a-zA-Z]*(?:\s+[^>]*?(?:""|'')[^>]*?)\s*>/gu,
        (match) => {
            nodeAssert(isString(match));
            return match.replace(/(["'])\1/gu, '$1' + empty + '$1');
        },
    );

    const innerL = '(?:[^<]' + '|' + '<(?!/?p[>\\s])' + '|' + '<p>';
    const innerR = '</p>)*?';
    const maxDepth = 4;

    // Regex to match elements that can't contain paragraphs
    const cannotContainParagraphs = XRegExp.build(
        `<
        \\s*
        ({{tag}})
        (?:\\s+[^>]*?)?
        \\s*
        >
        ({{inner}})
        </
        \\s*
        \\1
        \\s*
        >`,
        {
            tag: `(?:${[
                ...tagsThatCannotContainParagraphs,
                ...opts.componentsThatCannotContainParagraphs,
            ].join('|')})`,
            inner: innerL.repeat(maxDepth) + innerR.repeat(maxDepth),
        },
        'gmsux',
    );

    // Remove paragraph tags from within elements that can't contain paragraphs.
    content = XRegExp.replace(content, cannotContainParagraphs, (match) => {
        return match.toString().replace(/(?<!^)<p>|<\/p>(?!$)/gsu, '');
    });

    // Remove paragraphs that contain elements that can't be in paragraphs
    const cannotBeInParagraphs = new RegExp(
        `</?\\s*(${[
            ...tagsThatCannotBeInParagraphs,
            ...opts.componentsThatCannotBeInParagraphs,
        ].join('|')})(?:\\s+[^>]*?)?\\s*/?>`,
        'u',
    );

    content = XRegExp.replace(content, /<p>(.*?)<\/p>/gsu, (match, inner) => {
        nodeAssert(isString(match) && isString(inner));
        if (cannotBeInParagraphs.test(inner)) return inner;
        return match;
    });

    content = sanitizeHtml(content, {
        allowedAttributes: false,
        allowedTags: false,
        allowVulnerableTags: true,
        parseStyleAttributes: false,
        nonBooleanAttributes: [],
        parser: {
            decodeEntities: false,
            lowerCaseAttributeNames: false,
            lowerCaseTags: false,
            xmlMode: false,
        },
    });

    // Remove empty paragraphs
    content = content.replaceAll(/<p>\s*<\/p>/gsu, '');

    // unescape empty attributes and self-closing tags
    Object.entries(escaped).forEach(([id, tag]) => {
        content = content.replaceAll(id, tag);
    });

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
            \\s+
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
