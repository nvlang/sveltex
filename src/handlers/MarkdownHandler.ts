// Types
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
    MarkdownConfigureFn,
    MarkdownProcessFn,
    MarkdownProcessOptions,
    MarkdownProcessor,
} from '$types/handlers/Markdown.js';

// Internal dependencies
import { missingDeps } from '$utils/env.js';
import { Handler, deepClone } from '$handlers/Handler.js';
import {
    micromarkDisableIndentedCodeAndAutolinks,
    remarkDisableIndentedCodeBlocks,
} from '$utils/markdown.js';
import { getDefaultMarkdownConfig } from '$config/defaults.js';
import { mergeConfigs } from '$utils/merge.js';
import { copyTransformations } from '$utils/misc.js';
import { isObject, isString } from '$typeGuards/utils.js';
import XRegExp from 'xregexp';
import { nodeAssert, uuid } from '$deps.js';

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
    MarkdownProcessor<B>,
    MarkdownProcessOptions,
    MarkdownConfiguration<B>,
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

    override get process() {
        return async (content: string, options: MarkdownProcessOptions) => {
            let unescapeTags: (str: string) => string = (str) => str;
            if (!this._configuration.strict) {
                const adjusted = adjustHtmlSpacing(
                    content,
                    this._configuration.prefersInline,
                );
                content = adjusted.content;
                unescapeTags = adjusted.unescapeTags;
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
     * @returns A promise that resolves to a markdown handler of the specified type.
     */
    static async create<B extends Exclude<MarkdownBackend, 'custom'>>(
        backend: B,
    ): Promise<MarkdownHandler<B>>;

    static async create<B extends 'custom'>(
        backend: B,
        {
            processor,
            process,
            configure,
            configuration,
        }: {
            processor?: MarkdownProcessor<'custom'>;
            process: MarkdownProcessFn<'custom'>;
            configure?: MarkdownConfigureFn<'custom'>;
            configuration?: MarkdownConfiguration<'custom'>;
        },
    ): Promise<MarkdownHandler<B>>;

    /**
     * Creates a markdown handler of the specified type.
     *
     * @param backend - The type of the markdown processor to create.
     * @returns A promise that resolves to a markdown handler of the specified type.
     */
    static async create<B extends MarkdownBackend>(
        backend: B,
        custom?: B extends 'custom'
            ? {
                  processor?: MarkdownProcessor<'custom'>;
                  process: MarkdownProcessFn<'custom'>;
                  configure?: MarkdownConfigureFn<'custom'>;
                  configuration?: MarkdownConfiguration<'custom'>;
              }
            : never,
    ) {
        switch (backend) {
            case 'custom':
                if (custom === undefined) {
                    throw new Error(
                        'Called MarkdownHandler.create("custom", custom) without a second parameter.',
                    );
                }
                return new MarkdownHandler({
                    backend: 'custom',
                    processor: custom.processor ?? {},
                    process: custom.process,
                    configure: custom.configure ?? (() => undefined),
                    configuration: mergeConfigs(
                        getDefaultMarkdownConfig('custom'),
                        custom.configuration ?? {},
                    ),
                });

            case 'marked':
                try {
                    type Backend = 'marked';
                    type Processor = MarkdownProcessor<Backend>;
                    type Configuration = MarkdownConfiguration<Backend>;
                    const marked = await import('marked');

                    const processor: Processor = new marked.Marked({
                        tokenizer: {
                            // Disable autolinks
                            autolink: () => undefined,
                            // Disable indented code blocks (NB: fenced code
                            // blocks have a separate tokenizer, named
                            // "fences").
                            code: () => undefined,
                        },
                    });
                    const configure: MarkdownConfigureFn<Backend> = (
                        config: Configuration,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        if (config.options) {
                            markdownHandler.processor.setOptions(
                                config.options,
                            );
                        }
                        if (config.extensions) {
                            markdownHandler.processor.use(...config.extensions);
                        }
                    };
                    const process: MarkdownProcessFn<Backend> = async (
                        markdown: string,
                        _options: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        return await markdownHandler.processor.parse(markdown);
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'marked',
                        processor,
                        process,
                        configure,
                        configuration: getDefaultMarkdownConfig('marked'),
                    });
                } catch (error) {
                    missingDeps.push('marked');
                    throw error;
                }

            case 'micromark':
                try {
                    type Backend = 'micromark';
                    const micromark = await import('micromark');
                    const processor = {};
                    const process: MarkdownProcessFn<Backend> = (
                        markdown: string,
                        _inline: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        return micromark.micromark(markdown, {
                            ...markdownHandler._configuration.options,
                            extensions: [
                                micromarkDisableIndentedCodeAndAutolinks,
                                ...(markdownHandler._configuration.options
                                    .extensions ?? []),
                            ],
                        });
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'micromark',
                        processor,
                        process,
                        configuration: getDefaultMarkdownConfig('micromark'),
                    });
                } catch (error) {
                    missingDeps.push('micromark');
                    throw error;
                }

            case 'markdown-it': {
                let processor;
                type Backend = 'markdown-it';
                try {
                    const MarkdownIt = (await import('markdown-it')).default;
                    processor = new MarkdownIt({ html: true });
                } catch (error) {
                    missingDeps.push('markdown-it');
                    throw error;
                }
                // Disable indented code blocks and autolinks
                processor.disable(['code', 'autolink']);
                const configure: MarkdownConfigureFn<'markdown-it'> = (
                    config,
                    markdownHandler,
                ) => {
                    if (config.options) {
                        markdownHandler.processor.set(config.options);
                    }
                    if (config.extensions) {
                        config.extensions.forEach((extension) => {
                            if (Array.isArray(extension)) {
                                markdownHandler.processor.use(
                                    extension[0],
                                    ...extension.slice(1),
                                );
                            } else {
                                markdownHandler.processor.use(extension);
                            }
                        });
                    }
                };
                const process: MarkdownProcessFn<Backend> = (
                    markdown: string,
                    _options: MarkdownProcessOptions | undefined,
                    markdownHandler: MarkdownHandler<Backend>,
                ) => {
                    return markdownHandler.processor.render(markdown);
                };
                return new MarkdownHandler<Backend>({
                    backend,
                    processor,
                    process,
                    configure,
                    configuration: getDefaultMarkdownConfig('markdown-it'),
                });
            }

            case 'unified':
                try {
                    type Backend = 'unified';
                    type Processor = MarkdownProcessor<'unified'>;

                    const unified = (await import('unified')).unified;

                    const remarkParse = (await import('remark-parse')).default;
                    const remarkRehype = (await import('remark-rehype'))
                        .default;
                    const rehypeStringify = (await import('rehype-stringify'))
                        .default;
                    const configuration: FullMarkdownConfiguration<'unified'> =
                        getDefaultMarkdownConfig('unified');
                    // remarkParse
                    const processor: Processor = unified()
                        .use(remarkParse)
                        .use(remarkDisableIndentedCodeBlocks)
                        .use(remarkRehype, {
                            allowDangerousHtml: true,
                            // passThrough: ['html', 'blockquote'],
                        })
                        .use(rehypeStringify, { allowDangerousHtml: true });
                    const configure: MarkdownConfigureFn<'unified'> = (
                        _config: MarkdownConfiguration<'unified'>,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        markdownHandler.processor = unified()
                            .use(remarkParse)
                            .use(remarkDisableIndentedCodeBlocks)
                            .use(markdownHandler.configuration.remarkPlugins)
                            .use(remarkRehype, { allowDangerousHtml: true })
                            .use(markdownHandler.configuration.rehypePlugins)
                            .use(rehypeStringify, {
                                allowDangerousHtml: true,
                            });
                    };
                    const process: MarkdownProcessFn<Backend> = async (
                        markdown: string,
                        _options: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        const res = (
                            await markdownHandler.processor.process(markdown)
                        ).toString();
                        return res;
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'unified',
                        processor,
                        process,
                        configure,
                        configuration,
                    });
                } catch (error) {
                    missingDeps.push(
                        'unified',
                        'remark-parse',
                        'remark-rehype',
                        'rehype-stringify',
                        '@types/mdast',
                    );
                    throw error;
                }

            case 'none':
                return new MarkdownHandler<'none'>({
                    backend: 'none',
                    process: (markdown: string) => markdown,
                    configure: () => {
                        return;
                    },
                    processor: {},
                    configuration: getDefaultMarkdownConfig('none'),
                });

            default:
                throw new Error(`Unsupported markdown backend "${backend}".`);
        }
    }
}

/**
 *
 */
function adjustHtmlSpacing(
    content: string,
    prefersInline: (tag: string) => boolean,
) {
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

    // Escape the aforementioned tags, so that all tags are treated equally.
    // For example: `<p>...</p>` becomes `<p${id}>...</p${id}>`.
    content = XRegExp.replace(
        content,
        regexSpecials,
        (match, _opening, tag) => {
            nodeAssert(isString(tag));
            const res = match
                .replace(tag, tag + id)
                .replace(`</${tag}>`, `</${tag + id}>`);
            return res;
        },
    );

    // Now, we
    content = XRegExp.replace(
        content,
        regexAny,
        (_match, opening, tag, leading, inner, _trailing, closing) => {
            nodeAssert(
                isString(opening) &&
                    isString(tag) &&
                    isString(leading) &&
                    isString(inner) &&
                    isString(closing),
                'Expected match groups to be strings.',
            );
            const xOriginal = countNewlines(leading);
            let x = 0;
            if (xOriginal >= 2) {
                x = 2;
            } else if (xOriginal === 1) {
                x = prefersInline(tag.replace(id, '')) ? 0 : 2;
            }
            const ws = '\n'.repeat(x);
            return opening + ws + inner + ws + closing;
        },
    );

    // Function with which the MarkdownHandler will be able to unescape the tags
    // we escaped earlier, after it is done processing the document.
    const unescapeTags = (str: string) => {
        const s = str
            .replaceAll(
                new RegExp(
                    `<p><([^>]+)${id}(.*?)<\\/(?:\\1)${id}><\\/p>`,
                    'gsu',
                ),
                '<$1$2</$1>',
            )
            .replaceAll(id, '');
        return s;
    };
    return { content, unescapeTags };
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
export function countNewlines(s: string) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\n') n++;
        else if (s[i] === '\r' && s[i + 1] !== '\n') n++;
    }
    return n;
}

const shared = `
    ^                   # (start of line)
    {{space}}*          # (whitespace, ≥0, greedy)
    (?<opening>         # 1: opening tag
        <
        /?
        (               # 2: tag name
            {{tag}}
        )
        (?:
            {{space}}
            [^>]*?      # (any character other than '>', ≥0, lazy)
        )?
        >
    )
    (?<leading>         # 3: leading whitespace in inner content
        \\s*            # (whitespace, ≥0, greedy)
    )
    (?<inner>           # 4: inner content, trimmed
        .*?             # (any character (incl. newline), ≥0, lazy)
    )
    (?<trailing>        # 5: trailing whitespace in inner content
        \\s*            # (whitespace, ≥0, greedy)
    )
    (?<closing>         # 6: closing tag
        </
        \\2
        >
    )
`;

const space = '[ \\t]';
const newline = '(?:\\r\\n?|\\n)';

const regexAny = XRegExp.build(
    shared,
    { tag: '(?:[a-zA-Z][-.:0-9_a-zA-Z]*)', space, newline },
    'gimsux',
);

const regexSpecials = XRegExp.build(
    shared,
    {
        space,
        newline,
        tag:
            '(?:' +
            [
                'address',
                'article',
                'aside',
                'base',
                'basefont',
                'blockquote',
                'body',
                'caption',
                'center',
                'col',
                'colgroup',
                'dd',
                'details',
                'dialog',
                'dir',
                'div',
                'dl',
                'dt',
                'fieldset',
                'figcaption',
                'figure',
                'footer',
                'form',
                'frame',
                'frameset',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'head',
                'header',
                'hr',
                'html',
                'iframe',
                'legend',
                'li',
                'link',
                'main',
                'menu',
                'menuitem',
                'nav',
                'noframes',
                'ol',
                'optgroup',
                'option',
                'p',
                'param',
                'search',
                'section',
                'summary',
                'table',
                'tbody',
                'td',
                'tfoot',
                'th',
                'thead',
                'title',
                'tr',
                'track',
                'ul',
            ].join('|') +
            ')',
    },
    'gimsux',
);
