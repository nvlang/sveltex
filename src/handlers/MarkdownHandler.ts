// Types
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
    MarkdownConfigureFn,
    MarkdownHandlerFactories,
    MarkdownProcessFn,
    MarkdownProcessOptions,
    MarkdownProcessorOf as MarkdownProcessor,
} from '$types';

// Internal dependencies
import { re } from '$src/processor/utils.js';
import { missingDeps } from '$src/globals/index.js';
import { Handler } from './Handler.js';

/**
 * A class that provides a unified interface to different markdown processors.
 *
 * @typeParam B - Markdown backend.
 *
 * @remarks This class should not be instantiated directly. Instead, use the
 * {@link createMarkdownHandler | `createMarkdownHandler`} function.
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
     * @readonly
     * @internal
     */
    private get distinguishesInlineAndBlock(): boolean {
        return (
            this.backend === 'markdown-it' ||
            this.backend === 'marked' ||
            this.backend === 'custom'
        );
    }
    /**
     * Passed to {@link process | `process`} and {@link configure | `configure`}
     * functions.
     *
     * - `marked`: An instance of `marked`'s `Marked` class.
     * - `micromark`: `null`.
     * - `markdown-it`: An instance of `markdown-it`'s `MarkdownIt` class.
     * - `unified`: An instance of `unified`'s `Processor` class.
     * - `custom`: Any object of type {@link Processor | `Processor`} (which can
     *   be anything, since `Processor` will equal `ProcessorOf<'custom'>`,
     *   which equals `unknown`).
     *
     */
    // public processor: MarkdownProcessor<B>;
    // private _configuration: FullMarkdownConfiguration<B>;
    // get configuration(): FullMarkdownConfiguration<B> {
    //     return this._configuration;
    // }
    // set configuration(configuration: MarkdownConfiguration<B>) {
    //     this._configuration = mergeConfigs(this._configuration, configuration);
    // }
    /**
     * A function that processes a markdown string.
     *
     * @param markdown - The markdown to process.
     * @param inline - Whether to parse the markdown as inline or block.
     * @param markdownHandler - The markdown handler to use to process the
     * markdown.
     * @returns The processed markdown, or a promise resolving to it.
     *
     * @remarks
     * Depending on the markdown processor, the `process` function may be any of
     * the following:
     * - `marked`: The `marked` instance's `parse` and `parseInline` functions.
     * - `micromark`: The `micromark` function (the `inline` parameter is
     *   irrelevant in this case).
     * - `markdown-it`: The `markdown-it` instance's `render` and `renderInline`
     *   functions.
     * - `unified`: The `unified` instance's `process` method.
     * - `custom`: A function that processes the markdown string.
     */
    // private _process: MarkdownProcessFn<B>;
    override get process() {
        if (this.distinguishesInlineAndBlock) {
            /**
             * Process a markdown string.
             *
             * @param markdown - The markdown to process.
             * @param inline - Whether to parse the markdown as inline or block.
             * Defaults to whatever
             * {@link shouldParseAsInline | `shouldParseAsInline`} returns for
             * the markdown string.
             * @returns The processed markdown, or a promise resolving to it.
             */
            return (
                markdown: string,
                options?: MarkdownProcessOptions | undefined,
            ) =>
                super.process(markdown, {
                    inline: options?.inline ?? shouldParseAsInline(markdown),
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
    // /**
    //  * @param opts - The configuration object used to configure the markdown
    //  * processor.
    //  * @param markdownHandler - The markdown handler to configure, modified
    //  * in-place.
    //  *
    //  * @remarks ⚠ Modifies `this` and the `markdownHandler` parameter in-place.
    //  */
    // private readonly _configure: MarkdownConfigureFn<B>;
    // get configure() {
    //     /**
    //      * @param config - The configuration object used to configure the
    //      * markdown processor.
    //      * @remarks ⚠ Modifies the markdown handler in-place.
    //      */
    //     return async (config: MarkdownConfiguration<B>) => {
    //         await this._configure(config, this);
    //         this.configuration = mergeConfigs(this.configuration, config);
    //     };
    // }
    // constructor({
    //     backend,
    //     processor,
    //     process,
    //     configure,
    //     configuration,
    // }: {
    //     backend: B;
    //     processor: MarkdownProcessor<B>;
    //     process: MarkdownProcessFn<B>;
    //     configure: MarkdownConfigureFn<B>;
    //     configuration: FullMarkdownConfiguration<B>;
    // }) {
    //     super({ backend, processor, process, configure, configuration });
    //     // this._distinguishesInlineAndBlock =
    //     //     backend === 'markdown-it' ||
    //     //     backend === 'marked' ||
    //     //     backend === 'custom';
    // }
}

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
export function shouldParseAsInline(excerpt: string): boolean {
    return excerpt.match(markdownBlockRegex) === null;
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
export const markdownBlockRegex = re`
    (
        \n\s*\n                     # multiple newlines
        | ^\s*\#{1,6} \s            # headings
        | ( ^.* \S .*\n )+          # setext heading
          ^\s*(-+|=+) \s* $         # setext heading underline
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
 * Object that maps the names of supported markdown processors to a factory that
 * creates a markdown handler of that type.
 */
const markdownHandlerFactories: MarkdownHandlerFactories = {
    /**
     * Creates a markdown handler that uses the `marked` markdown processor.
     */
    marked: async () => {
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
                    markdownHandler.processor.setOptions(config.options);
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
                    ? await markdownHandler.processor.parseInline(markdown)
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
    },

    /**
     * Creates a markdown handler that uses the `micromark` markdown processor.
     */
    micromark: async () => {
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
    },
    /**
     * Creates a markdown handler that uses the `markdown-it` markdown
     * processor.
     */
    'markdown-it': async () => {
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
    },
    /**
     * Creates a markdown handler that uses the `unified` markdown processor.
     */
    unified: async () => {
        try {
            type Backend = 'unified';
            type Processor = MarkdownProcessor<'unified'>;

            const unified = (await import('unified')).unified;

            const remarkParse = (await import('remark-parse')).default;
            const remarkRehype = (await import('remark-rehype')).default;
            const rehypeStringify = (await import('rehype-stringify')).default;
            const configuration: FullMarkdownConfiguration<'unified'> = {
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
                    .use(rehypeStringify, { allowDangerousHtml: true });
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
    },
    /**
     * Creates a markdown handler that uses a custom markdown processor.
     *
     * @param processor - The custom markdown processor.
     * @param process - A function that processes a markdown string.
     * @param configure - A function that configures the markdown processor.
     * @returns A promise that resolves to a markdown handler that uses the
     * custom markdown processor.
     */
    custom: (processor, process, configure, configuration) => {
        type Backend = 'custom';
        return new MarkdownHandler<Backend>({
            backend: 'custom',
            processor,
            process,
            configure,
            configuration,
        });
    },
    /**
     *
     */
    none: () => {
        return new MarkdownHandler<'none'>({
            backend: 'none',
            process: (markdown: string) => markdown,
            configure: () => {
                return;
            },
            processor: {},
            configuration: {},
        });
    },
};

/**
 * Creates a markdown handler of the specified type.
 *
 * @param backend - The type of the markdown processor to create.
 * @returns A promise that resolves to a markdown handler of the specified type.
 */
export async function createMarkdownHandler<
    B extends Exclude<MarkdownBackend, 'custom'>,
>(backend: B): Promise<MarkdownHandler<B>>;

export async function createMarkdownHandler<B extends 'custom'>(
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
export async function createMarkdownHandler<B extends MarkdownBackend>(
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
    if (backend === 'custom') {
        if (custom === undefined) {
            throw new Error(
                'Called createMarkdownHandler("custom", custom) without a second parameter.',
            );
        }
        return markdownHandlerFactories.custom(
            custom.processor ?? {},
            custom.process,
            custom.configure ??
                (() => {
                    return;
                }),
            custom.configuration ?? {},
        );
    }
    return markdownHandlerFactories[
        /* eslint-disable-next-line
        @typescript-eslint/no-unnecessary-type-assertion */
        backend as Exclude<MarkdownBackend, 'custom'>
    ]();
}
