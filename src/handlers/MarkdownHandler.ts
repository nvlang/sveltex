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
import { Handler } from '$handlers/Handler.js';
import { re } from '$utils/misc.js';

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
    /**
     * Whether the markdown processor distinguishes between inline and block
     * parsing.
     * - `true`: `'markdown-it'`, `'marked'`, and `'custom'`
     * - `false`: `'micromark'` and `'unified'`.
     *
     * @internal
     */
    private get distinguishesInlineAndBlock(): boolean {
        return (
            this.backend === 'markdown-it' ||
            this.backend === 'marked' ||
            this.backend === 'custom'
        );
    }

    override get process() {
        if (this.distinguishesInlineAndBlock) {
            /**
             * Process a markdown string.
             *
             * @param markdown - The markdown to process.
             * @param inline - Whether to parse the markdown as inline or block.
             * Defaults to whatever
             * {@link MarkdownHandler.shouldParseAsInline | `MarkdownHandler.shouldParseAsInline`} returns for
             * the markdown string.
             * @returns The processed markdown, or a promise resolving to it.
             */
            return (
                markdown: string,
                options?: MarkdownProcessOptions | undefined,
            ) =>
                super.process(markdown, {
                    inline:
                        options?.inline ??
                        MarkdownHandler.shouldParseAsInline(markdown),
                });
        } else {
            /**
             * Process a markdown string.
             *
             * @param markdown - The markdown to process.
             * @returns The processed markdown, or a promise resolving to it.
             */
            return (markdown: string) =>
                super.process(markdown, { inline: false });
        }
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
                    configuration: custom.configuration ?? {},
                });

            case 'marked':
                try {
                    type Backend = 'marked';
                    type Processor = MarkdownProcessor<Backend>;
                    type Configuration = MarkdownConfiguration<Backend>;
                    const marked = await import('marked');
                    const processor: Processor = new marked.Marked();
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
                        options: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        return options?.inline !== false
                            ? await markdownHandler.processor.parseInline(
                                  markdown,
                              )
                            : await markdownHandler.processor.parse(markdown);
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'marked',
                        processor,
                        process,
                        configure,
                        configuration: { extensions: [], options: {} },
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
                    const configure = () => {
                        //
                    };
                    const process: MarkdownProcessFn<Backend> = (
                        markdown: string,
                        _inline: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        return micromark.micromark(
                            markdown,
                            markdownHandler.configuration,
                        );
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'micromark',
                        processor,
                        process,
                        configure,
                        configuration: {},
                    });
                } catch (error) {
                    missingDeps.push('micromark');
                    throw error;
                }

            case 'markdown-it':
                try {
                    type Backend = 'markdown-it';
                    type Processor = MarkdownProcessor<'markdown-it'>;
                    type Configuration = MarkdownConfiguration<'markdown-it'>;
                    const MarkdownIt = (await import('markdown-it')).default;
                    const processor: Processor = new MarkdownIt();
                    const configure: MarkdownConfigureFn<'markdown-it'> = (
                        config: Configuration,
                        markdownHandler: MarkdownHandler<Backend>,
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
                        options: MarkdownProcessOptions | undefined,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        return options?.inline !== false
                            ? markdownHandler.processor.renderInline(markdown)
                            : markdownHandler.processor.render(markdown);
                    };
                    return new MarkdownHandler<Backend>({
                        backend: 'markdown-it',
                        processor,
                        process,
                        configure,
                        configuration: {},
                    });
                } catch (error) {
                    missingDeps.push('markdown-it');
                    throw error;
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
                        {
                            remarkPlugins: [],
                            rehypePlugins: [],
                        };
                    const processor: Processor = unified()
                        .use(remarkParse)
                        .use(remarkRehype, { allowDangerousHtml: true })
                        .use(rehypeStringify, { allowDangerousHtml: true });
                    const configure: MarkdownConfigureFn<'unified'> = (
                        _config: MarkdownConfiguration<'unified'>,
                        markdownHandler: MarkdownHandler<Backend>,
                    ) => {
                        markdownHandler.processor = unified()
                            .use(remarkParse)
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
                        return (
                            await markdownHandler.processor.process(markdown)
                        ).toString();
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
                    configuration: {},
                });

            default:
                throw new Error(`Unsupported markdown backend "${backend}".`);
        }
    }

    /**
     * Regex that matches strings that should be parsed as blocks (as opposed to
     * inline).
     *
     * @remarks The decision whether to parse an excerpt as a string is important;
     * for example, the string `'example'`, if parsed as a block, would become
     * `'<p>example</p>'`. If parsed inline, it would remain `'example`.
     * @remarks We don't support indented code blocks (they would greatly complicate
     * the parsing).
     * @see https://github.github.com/gfm/
     */
    static readonly markdownBlockRegex = re`
        (
            \n\s*\n                     # multiple newlines
            | ^\s*\#{1,6} \s            # headings
            | ( ^.* \S .*\n )+          # setext heading
            ^\s*(-+|=+) \s* $           # setext heading underline
            | ^( [*+-] | \d+\. ) \s     # lists
            | ^\s* ( \`{3,} | ~{3,} )   # fenced code blocks
            | ^\s*                      # thematic breaks
                (
                    (-[\ ]*){3,}
                    | (\*[\ ]*){3,}
                    | (_[\ ]*){3,}
                )$
            | ^\s*>                     # blockquotes
            | (?<=^|[^\\]) ((\\\\)*)    # tables
                \| .* \n .* - .*
                (?<=^|[^\\]) ((\\\\)*)
                \| .* \n
        )
        ${'mu'}`;

    /**
     * Tries to determine whether a markdown excerpt should be parsed as inline
     * markdown.
     *
     * @param excerpt - The markdown excerpt to check.
     * @returns `true` if the excerpt should be parsed as inline markdown, `false`
     * if it should be parsed as a block.
     * @remarks The decision whether to parse an excerpt as a string is important;
     * for example, the string `'example'`, if parsed as a block, would become
     * `'<p>example</p>'`. If parsed inline, it would remain `'example`.
     * @remarks We don't support indented code blocks (they would greatly complicate
     * the parsing).
     */
    static shouldParseAsInline(excerpt: string): boolean {
        return excerpt.match(MarkdownHandler.markdownBlockRegex) === null;
    }
}
