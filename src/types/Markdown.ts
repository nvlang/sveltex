import type { MarkdownHandler } from '$handlers';
import { ProcessFn } from '$src/types/IHandler.js';

/**
 * Supported markdown processors.
 */
export type MarkdownBackend =
    | 'marked'
    | 'markdown-it'
    | 'micromark'
    | 'unified'
    | 'custom'
    | 'none';

/**
 * Type of the processor used to parse markdown.
 *
 * @typeParam B - The type of the markdown processor.
 * @returns Depending on `B`:
 * - `markdown-it`: Type of the module's `MarkdownIt` class.
 * - `marked`: Type of the module's `Marked` class.
 * - `micromark`: `null`.
 * - `unified`: Type of the module's `Processor` class.
 * - `custom`: `unknown`.
 *
 * @remarks This is the type of the `processor` property of the markdown
 * handler.
 */
export type MarkdownProcessorOf<B> = B extends 'markdown-it'
    ? import('markdown-it')
    : B extends 'marked'
      ? import('marked').Marked
      : B extends 'micromark'
        ? object
        : B extends 'unified'
          ? import('unified').Processor<
                import('mdast').Root,
                import('mdast').Root,
                import('hast').Root,
                import('hast').Root,
                string
            >
          : B extends 'custom'
            ? object
            : B extends 'none'
              ? object
              : never;

/**
 * Type of the configuration object used to configure the markdown processor.
 *
 * @typeParam B - The type of the markdown processor.
 * @returns Depending on `B`:
 * - `'markdown-it'`: The module's `Options` type.
 * - `'marked'`: Type with an `options` property of type `MarkedOptions` and an
 *   `extensions` property of type `MarkedExtension[]`.
 * - `'micromark'`: The module's `Options` type.
 * - `'unified'`: Type with a `remarkPlugins` property of type `PluggableList` and
 *   a `rehypePlugins` property of type `PluggableList`.
 * - `'custom'`: `Record<string, unknown>`
 * - `'none'`: `Record<string, unknown>`
 *
 * @remarks This is the type of the argument passed to the markdown handler's
 * `configure` function.
 */
export type MarkdownConfiguration<B extends MarkdownBackend> =
    B extends 'markdown-it'
        ? {
              /**
               * Options to pass to the `markdown-it` processor.
               *
               * @see https://github.com/markdown-it/markdown-it
               *
               * @remarks The `highlight` and `langPrefix` options are not
               * supported here, since they relate to features that are dealt
               * with by the Sveltex instance's code handler, instead of its
               * markdown handler.
               */
              options?: Omit<
                  import('markdown-it').Options,
                  'highlight' | 'langPrefix'
              >;

              extensions?: (
                  | import('markdown-it').PluginSimple
                  | [
                        import('markdown-it').PluginWithOptions,
                        Record<string, unknown>,
                    ]
                  | [import('markdown-it').PluginWithParams, ...unknown[]]
              )[];
              // I don't understand why these `unknown` types are necessary,
              // but it seems they are.
              // | [unknown, ...unknown[]]
              // | [unknown, Record<string, unknown>]
          }
        : B extends 'marked'
          ? {
                /**
                 * Options to pass to the `marked` processor.
                 *
                 * @see https://marked.js.org/using_advanced#options
                 */
                options?: import('marked').MarkedOptions;

                /**
                 * Extensions to use with the `marked` processor.
                 *
                 * @see https://marked.js.org/using_advanced#extensions
                 */
                extensions?: import('marked').MarkedExtension[];
            }
          : B extends 'micromark'
            ? import('micromark').Options
            : B extends 'unified'
              ? {
                    /**
                     * Plugins to use with the `remark` processor.
                     *
                     * These will be used after `remark-parse` but before
                     * `remark-rehype`.
                     *
                     * @see https://unifiedjs.com/explore/keyword/remark/
                     */
                    remarkPlugins?: import('unified').PluggableList | undefined;

                    /**
                     * Plugins to use with the `rehype` processor.
                     *
                     * These will be used after `remark-rehype` but before
                     * `rehype-stringify`.
                     *
                     * @see https://unifiedjs.com/explore/keyword/rehype/
                     */
                    rehypePlugins?: import('unified').PluggableList | undefined;
                }
              : B extends 'custom'
                ? Record<string, unknown>
                : B extends 'none'
                  ? Record<string, unknown>
                  : never;

export type FullMarkdownConfiguration<B extends MarkdownBackend> =
    B extends 'markdown-it'
        ? {
              options?: Omit<
                  import('markdown-it').Options,
                  'highlight' | 'langPrefix'
              >;

              extensions?: (
                  | import('markdown-it').PluginSimple
                  | [
                        import('markdown-it').PluginWithOptions,
                        Record<string, unknown>,
                    ]
                  | [import('markdown-it').PluginWithParams, ...unknown[]]
              )[];
          }
        : B extends 'marked'
          ? {
                options: import('marked').MarkedOptions;
                extensions: import('marked').MarkedExtension[];
            }
          : B extends 'micromark'
            ? import('micromark').Options
            : B extends 'unified'
              ? {
                    remarkPlugins: import('unified').PluggableList;
                    rehypePlugins: import('unified').PluggableList;
                }
              : B extends 'custom'
                ? Record<string, unknown>
                : B extends 'none'
                  ? Record<string, unknown>
                  : never;

/**
 * Type of the function that processes a markdown string.
 *
 * @typeParam B - Markdown backend.
 */
export type MarkdownProcessFn<B extends MarkdownBackend> = ProcessFn<
    MarkdownProcessOptions,
    MarkdownHandler<B>
>;

export interface MarkdownProcessOptions {
    inline?: boolean | undefined;
}

// /**
//  * @param markdown - The markdown to process.
//  * @param inline - Whether to parse the markdown as inline or block.
//  * @param markdownHandler - The markdown handler to use to process the
//  * markdown.
//  * @returns The processed markdown, or a promise resolving to it.
//  */
// (
//     markdown: string,
//     inline: boolean,
//     markdownHandler: MarkdownHandler<B>,
// ) => string | Promise<string>;

/**
 * Type of the function that configures a markdown processor of the specified
 * type.
 *
 * @typeParam B - Markdown backend.
 */
export type MarkdownConfigureFn<B extends MarkdownBackend> = (
    opts: MarkdownConfiguration<B>,
    markdownHandler: MarkdownHandler<B>,
) => void | Promise<void>;

/**
 * Type of the factory function that creates a markdown handler.
 * @typeParam B - Markdown backend.
 * @returns A function that returns a promise that resolves to a markdown
 * handler of the specified type.
 */
export type MarkdownHandlerFactory<B extends MarkdownBackend> =
    B extends 'custom'
        ? (
              processor: MarkdownProcessorOf<B>,
              process: MarkdownProcessFn<B>,
              configure: MarkdownConfigureFn<B>,
              configuration: MarkdownConfiguration<B>,
          ) => MarkdownHandler<B> | Promise<MarkdownHandler<B>>
        : () => MarkdownHandler<B> | Promise<MarkdownHandler<B>>;

/**
 * Object that maps the names of supported markdown processors to a factory that
 * creates a markdown handler of that type.
 */
export type MarkdownHandlerFactories = {
    [B in MarkdownBackend]: MarkdownHandlerFactory<B>;
};
