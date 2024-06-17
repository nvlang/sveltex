// Types
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
    MarkdownProcessFn,
    MarkdownProcessOptions,
    MarkdownProcessor,
} from '$types/handlers/Markdown.js';

// Internal dependencies
import { missingDeps } from '$utils/env.js';
import { Handler, deepClone } from '$handlers/Handler.js';
import {
    micromarkDisableIndentedCodeAndAutolinks,
    remarkDisableIndentedCodeBlocksAndAutolinks,
} from '$utils/markdown.js';
import { getDefaultMarkdownConfig } from '$config/defaults.js';
import { mergeConfigs } from '$utils/merge.js';
import { copyTransformations } from '$utils/misc.js';
import { isObject, isString } from '$typeGuards/utils.js';
import XRegExp from 'xregexp';
import { is, nodeAssert, typeAssert, uuid } from '$deps.js';

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
                // rehypeRetext,
                rehypeStringify;
            try {
                unified = (await import('unified')).unified;
                remarkParse = (await import('remark-parse')).default;
                remarkRehype = (await import('remark-rehype')).default;
                // rehypeRetext = (await import('rehype-retext')).default;
                rehypeStringify = (await import('rehype-stringify')).default;
            } catch (error) {
                // If the import fails, add the missing dependencies to the list
                // of missing dependencies and rethrow the error.
                missingDeps.push(
                    'unified',
                    'remark-parse',
                    'remark-rehype',
                    // 'rehype-retext',
                    'rehype-stringify',
                    '@types/mdast',
                );
                throw error;
            }
            const configuration = mergeConfigs(
                getDefaultMarkdownConfig('unified'),
                userConfig ?? {},
            );
            // remarkParse
            const processor: MarkdownProcessor<'unified'> = unified()
                .use(remarkParse)
                .use(remarkDisableIndentedCodeBlocksAndAutolinks)
                .use(configuration.remarkPlugins)
                .use(remarkRehype, { allowDangerousHtml: true })
                .use(configuration.rehypePlugins)
                // .use(rehypeRetext, unified().use(configuration.retextPlugins))
                .use(rehypeStringify, { allowDangerousHtml: true });
            const process: MarkdownProcessFn<Backend> = async (
                markdown: string,
            ) => {
                const res = (await processor.process(markdown)).toString();
                return res;
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

    // Escape the aforementioned tags, so that all tags are treated equally. For
    // example: `<p>...</p>` becomes `<p${id}>...</p${id}>`.
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
