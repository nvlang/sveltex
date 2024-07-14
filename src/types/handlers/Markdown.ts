// File description: Types related to the `MarkdownHandler` class.

import type { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import type { ProcessFn, Transformers } from '$types/handlers/Handler.js';
import type { DirectiveEscapeSettings } from '$types/utils/Escape.js';
import type { Frontmatter } from '$types/utils/Frontmatter.js';
import type { RequiredDefined } from '$types/utils/utility-types.js';

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
                     *
                     * @defaultValue
                     * ```ts
                     * []
                     * ```
                     */
                    remarkPlugins?: import('unified').PluggableList | undefined;

                    /**
                     * Plugins to use with the `rehype` processor.
                     *
                     * These will be used after `remark-rehype` but before
                     * `rehype-stringify`.
                     *
                     * @see https://unifiedjs.com/explore/keyword/rehype/
                     *
                     * @defaultValue
                     * ```ts
                     * []
                     * ```
                     */
                    rehypePlugins?: import('unified').PluggableList | undefined;

                    /**
                     * [`retext`](https://www.npmjs.com/package/retext) plugins
                     * to use with
                     * [`remark-retext`](https://www.npmjs.com/package/remark-retext)
                     * to check the Latin-script natural language content of the
                     * markup. Note that these plugins will not be able to
                     * transform the content in any way, but rather just check
                     * it and possibly log warnings.
                     *
                     * @see https://unifiedjs.com/explore/keyword/retext/
                     *
                     * @defaultValue
                     * ```ts
                     * []
                     * ```
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
     * @see https://sveltex.dev/docs/implementation/markdown
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
     * @see https://sveltex.dev/docs/implementation/markdown
     *
     * @defaultValue
     * ```ts
     * () => true
     * ```
     */
    prefersInline?: ((tag: string) => boolean) | undefined;

    components?: ComponentInfo[] | undefined;

    /**
     * Settings related to markdown directives.
     */
    directives?: DirectiveEscapeSettings | undefined;
}

type FullMarkdownCommonConfiguration = {
    transformers: RequiredDefined<Transformers<Frontmatter>>;
} & RequiredDefined<MarkdownCommonConfiguration>;

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

export interface MarkdownProcessOptions {
    filename: string;
}

export interface ComponentInfo {
    /**
     * The name of the component. Must start with an uppercase letter.
     *
     * @remarks
     * **Vernacular:** I often use "component" and "element" interchangeably in this context.
     * Furthermore, I also often refer to a component's "name" as its "tag".
     *
     * Meanwhile, when talking about opening or closing tags, the angle brackets
     * are usually understood to be included; e.g., `<Example>` is an opening
     * tag, whereas `Example` isn't.
     *
     * @example
     * ```ts
     * 'MyComponent'
     * ```
     */
    name: Capitalize<string>;

    /**
     * The path from which the component can be imported. Should use an alias.
     *
     * This property is useful if the component is not present in the source
     * file, but is inserted at build-time by the SvelTeX preprocessor (e.g.,
     * within a pre- or post-transformation). In this case, the component will
     * be imported by Svelte iff this property is set; otherwise, a runtime
     * error will occur.
     *
     * @defaultValue
     * ```ts
     * undefined
     * ```
     *
     * @example
     * ```ts
     * '$lib/components/MyComponent.svelte'
     * ```
     */
    importPath?: string | undefined;

    /**
     * -   `'phrasing'`: The component should be treated as "phrasing content",
     *     i.e., it can be placed inside a paragraph, but cannot contain a
     *     paragraph itself.
     * -   `'sectioning'`: The component should be treated as a "sectioning"
     *     element, i.e., it cannot be placed inside a paragraph, but can
     *     contain paragraphs.
     * -   `'none'`: The component can neither be placed inside of- nor contain
     *     a paragraph.
     * -   `'all'`: The component can be placed inside a paragraph and can
     *     contain paragraphs. This is the default value, since it makes no
     *     assumptions about the component's intended behavior. However, it is
     *     recommended to specify a more specific type if possible.
     *
     * @defaultValue
     * ```ts
     * 'all'
     * ```
     */
    type?: 'phrasing' | 'sectioning' | 'none' | 'all' | undefined;

    /**
     * For edge cases only: Whether the inner content of the component should be
     * treated as inline content or as "block" content, to be wrapped in `<p>`
     * tags.
     *
     * @remarks
     * If this property is defined, it takes precedence over the value returned
     * by the
     * {@link MarkdownCommonConfiguration.prefersInline | `MarkdownCommonConfiguration.prefersInline`}
     * function for the component's tag.
     *
     * @example
     * Content like
     *
     * ```md
     * <Example>
     *
     * test
     *
     * </Example>
     * ```
     *
     * or
     *
     * ```md
     * <Example>test</Example>
     * ```
     *
     * isn't affected by this option. However, content like
     * `<Example>\ntest\n</Example>` will be transformed before being passed to
     * the markdown processor, becoming `<Example>test</Example>` (and remaining
     * `<Example>test</Example>` after processing by the markdown processor) if
     * `prefersInline` is `true`, and `<Example>\n\ntest\n\n</Example>` (and
     * `<Example>\n<p>test</p>\n</Example>` after processing by the markdown
     * processor) if `prefersInline` is `false`.
     *
     * @defaultValue
     * ```ts
     * undefined
     * ```
     */
    prefersInline?: boolean | undefined;
}
