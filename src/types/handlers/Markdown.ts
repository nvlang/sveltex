import type { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import type { ProcessFn, Transformers } from '$types/handlers/Handler.js';
import type { DirectiveEscapeSettings } from '$types/utils/Escape.js';
import type { Frontmatter } from '$types/utils/Frontmatter.js';
import type { RequiredNotUndefined } from '$types/utils/utility-types.js';

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
export type MarkdownProcessor<B> = B extends 'markdown-it'
    ? import('markdown-it').default
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
        ? MarkdownCommonConfiguration & {
              /**
               * Options to pass to the `markdown-it` processor.
               *
               * @see https://github.com/markdown-it/markdown-it
               *
               * @remarks The `highlight`, `html`, and `langPrefix` options are
               * not supported here, since they relate to features that are
               * dealt with by the Sveltex instance's code handler, instead of
               * its markdown handler.
               */
              options?: Omit<
                  import('markdown-it').Options,
                  'highlight' | 'langPrefix' | 'html'
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
          ? MarkdownCommonConfiguration & {
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
            ? MarkdownCommonConfiguration & {
                  options?:
                      | Omit<import('micromark').Options, 'allowDangerousHtml'>
                      | undefined;
              }
            : B extends 'unified'
              ? MarkdownCommonConfiguration & {
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

                    /**
                     * [`retext`](https://www.npmjs.com/package/retext) plugins
                     * to use with
                     * [`rehype-retext`](https://www.npmjs.com/package/rehype-retext)
                     * to check the Latin-script natural language content of the
                     * markup. Note that these plugins will not be able to
                     * transform the content in any way, but rather just check
                     * it and possibly log warnings.
                     */
                    retextPlugins?: import('unified').PluggableList | undefined;
                }
              : B extends 'custom'
                ? MarkdownCommonConfiguration & {
                      process: MarkdownProcessFn<'custom'>;
                  }
                : MarkdownCommonConfiguration & Record<string, unknown>;

interface MarkdownCommonConfiguration {
    /**
     * Transformers to apply to
     * -   the content about to be passed to the markdown processor, or to
     * -   the output produced by the markdown processor.
     *
     * @remarks
     * Note that, in either case, code blocks, math content, TeX content, and the
     * frontmatter will have been escaped to an UUIDv4 string before the
     * transformers are applied.
     */
    transformers?: Transformers<Frontmatter> | undefined;

    /**
     * By default, SvelTeX makes some adjustments to some kinds of markup that
     * would, if CommonMark were complied with strictly, yield unexpected or
     * even invalid HTML output. If you want to disable these adjustments and
     * comply more strictly with CommonMark for these cases, set this property
     * to `true`.
     *
     * @see https://sveltex.dev/dovs/implementation/markdown
     *
     * @remarks Setting this property to `true` will void the
     * {@link prefersInline | `prefersInline`} property.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    strict?: boolean | undefined;

    /**
     * @see https://sveltex.dev/dovs/implementation/markdown
     *
     * @defaultValue
     * ```ts
     * () => true
     * ```
     */
    prefersInline?: ((tag: string) => boolean) | undefined;

    /**
     * Settings related to markdown directives.
     */
    directives?: DirectiveEscapeSettings | undefined;
}

type FullMarkdownCommonConfiguration = {
    transformers: RequiredNotUndefined<Transformers<Frontmatter>>;
} & RequiredNotUndefined<MarkdownCommonConfiguration>;

export type FullMarkdownConfiguration<B extends MarkdownBackend> =
    B extends 'markdown-it'
        ? FullMarkdownCommonConfiguration & {
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
          ? FullMarkdownCommonConfiguration & {
                options: import('marked').MarkedOptions;
                extensions: import('marked').MarkedExtension[];
            }
          : B extends 'micromark'
            ? FullMarkdownCommonConfiguration & {
                  options: Omit<
                      import('micromark').Options,
                      'allowDangerousHtml'
                  >;
              }
            : B extends 'unified'
              ? FullMarkdownCommonConfiguration & {
                    remarkPlugins: import('unified').PluggableList;
                    rehypePlugins: import('unified').PluggableList;
                    retextPlugins: import('unified').PluggableList;
                }
              : B extends 'custom'
                ? FullMarkdownCommonConfiguration & {
                      process: MarkdownProcessFn<'custom'>;
                  }
                : FullMarkdownCommonConfiguration & Record<string, unknown>;

/**
 * Type of the function that processes a markdown string.
 *
 * @typeParam B - Markdown backend.
 */
export type MarkdownProcessFn<B extends MarkdownBackend> = ProcessFn<
    MarkdownProcessOptions,
    MarkdownHandler<B>
>;

export type MarkdownProcessOptions = object;

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
