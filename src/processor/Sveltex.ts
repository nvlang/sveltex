// Types
import type {
    BaseNode,
    FullSveltexConfig,
    SveltexConfig,
    Location,
    AdvancedTexBackend,
    CodeBackend,
    MarkdownBackend,
    TexBackend,
} from '$types';
import type {
    MarkupPreprocessor,
    Preprocessor,
    PreprocessorGroup,
    Processed,
} from 'svelte/compiler';

// Internal dependencies
import { escapeVerb, escapeMustacheTags, unescape } from '$processor/escape.js';
import { defaultAdvancedTexConfiguration, defaultSveltexConfig } from '$config';
import { missingDeps, packageManager } from '$globals';
import { log, getLocation, parse, walk, TexComponent } from '$utils';
import {
    AdvancedTexHandler,
    CodeHandler,
    createCodeHandler,
    TexHandler,
    createTexHandler,
    MarkdownHandler,
    createMarkdownHandler,
    VerbatimHandler,
    createAdvancedTexHandler,
} from '$handlers';

// External dependencies
import { merge } from 'ts-deepmerge';
import MagicString from 'magic-string';
import remapping, { type SourceMap } from '@ampproject/remapping';

/**
 * Returns a promise that resolves to a new instance of `Sveltex`.
 *
 * **Important**: You must `await` the result of this function before using the
 * `Sveltex` instance.
 */
export async function sveltex<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(
    /**
     * Backend to use to parse Markdown. Affects extensibility.
     *
     * - [`'marked'`](https://npmjs.com/package/marked)
     *
     * ```sh
     *       npm add -D marked
     * ```
     *
     * - [`'markdown-it'`](https://npmjs.com/package/markdown-it)
     *
     * ```sh
     *       npm add -D markdown-it
     * ```
     *
     * - [`'micromark'`](https://npmjs.com/package/micromark)
     *
     * ```sh
     *       npm add -D micromark
     * ```
     *
     * - [`'unified'`](https://npmjs.com/package/unified) (with
     *   [`remark-parse`](https://npmjs.com/package/remark-parse),
     *   [`remark-rehype`](https://npmjs.com/package/remark-rehype), and
     *   [`rehype-stringify`](https://npmjs.com/package/rehype-stringify))
     *
     * ```sh
     *       npm add -D unified remark-parse remark-rehype rehype-stringify
     * ```
     *
     *
     * @defaultValue `'none'`
     */
    markdownBackend: M,

    /* eslint-disable tsdoc/syntax */
    /**
     * Backend to use for processing code blocks and inline code snippets.
     *
     * The following backends escape special HTML characters and curly brackets
     * in code blocks:
     * - [`'highlight.js'`](https://github.com/highlightjs/highlight.js): Syntax
     *   highlighting with Highlight.js. Install:
     *
     * ```sh
     *       npm add -D highlight.js
     * ```
     *
     * - [`'starry-night'`](https://github.com/wooorm/starry-night): Syntax
     *   highlighting with Starry Night. Install:
     *
     * ```sh
     *       npm add -D "@wooorm/starry-night"
     * ```
     *
     * - [`'prismjs'`](https://github.com/PrismJS/prism): Syntax highlighting
     *   with Prism. Install:
     *
     * ```sh
     *       npm add -D prismjs
     * ```
     *
     * > ⚠ **Warning**: Prism is currently not well supported by SvelTeX, due to
     * > the fact that, at the time of writing, it doesn't yet use ES modules.
     * > As a result of this (and probably my lack of familiarity with Prism),
     * > Prism cannot load any languages or plugins within SvelTeX, and,
     * > accordingly, is not recommended for use with SvelTeX at the time of
     * > writing.
     *
     * - `'escapeOnly'`: Escape special HTML characters and curly brackets in
     *   code blocks, but don't apply syntax highlighting. By default, code
     *   blocks will be surrounded by `<pre><code>` tags, and inline code
     *   snippets will be surrounded by `<code>` tags.
     *
     * The following backends do not escape special HTML characters nor curly
     * brackets in code blocks:
     * - `'none'`: Leave code blocks as they are.
     *
     * Lastly, the following backend allows for custom code handling:
     * - `'custom'`: Use the custom `CodeHandler`.
     *
     * @defaultValue `'none'`
     */
    /* eslint-enable tsdoc/syntax */
    codeBackend: C,

    /* eslint-disable tsdoc/syntax */
    /**
     * Engine to use to render "basic" TeX blocks (e.g., `$x^2$`).
     *
     * @defaultValue `'none'`.
     *
     * @remarks
     * - `'katex'`:
     *   - Make sure you have `katex` installed as a devDependency (or regular
     *     dependency).
     *   - Make sure you include the [KaTeX CSS
     *     file](https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css)
     *     in your HTML file.
     *   - See also: https://katex.org/docs/browser.html
     *   - **NB**: If you're only using KaTeX within SvelTeX, you don't actually
     *     have to load any scripts for KaTeX, since the rendering will take
     *     place during preprocessing. This is also why it suffices to have
     *     KaTeX as a devDependency (as opposed to a regular dependency).
     * - `'mathjax-node'` (uses MathJax v2 at the time of writing):
     *   - Make sure you have `mathjax-node` installed as a devDependency (or
     *     regular dependency).
     *   - Make sure you include the MathJax CSS file in your HTML file.
     * - `'mathjax-full'` (latest MathJax):
     *   - Make sure you have `mathjax-full` installed as a devDependency (or
     *     regular dependency).
     *   - Make sure you include the MathJax CSS file in your HTML file.
     *
     */
    /* eslint-enable tsdoc/syntax */
    texBackend: T,

    /**
     * Distribution to use to render "advanced" TeX blocks (e.g.,
     * `<TeX>\tikz{...}</TeX>` or `<TikZ>...</TikZ>`).
     *
     * - `'none'`: No distribution will be used.
     * - `'local'`: A local TeX distribution will be used.
     * - `'custom'`: A custom handler will be used.
     *
     * @remarks If `'local'` is selected, a local TeX distribution must be
     * installed. You can download a distribution from the [LaTeX
     * Project](https://www.latex-project.org/get/).
     *
     * @defaultValue `'none'`.
     */
    advancedTexBackend: A,
): Promise<Sveltex<M, C, T, A>> {
    return await Sveltex.create<M, C, T, A>(
        markdownBackend,
        codeBackend,
        texBackend,
        advancedTexBackend,
    );
}

export function isNonCustomBackend<B>(
    backend: B,
): backend is Exclude<B, 'custom'> {
    return backend !== 'custom';
}

export class Sveltex<
    M extends MarkdownBackend = 'none',
    C extends CodeBackend = 'none',
    T extends TexBackend = 'none',
    A extends AdvancedTexBackend = 'none',
> implements PreprocessorGroup
{
    /**
     * The name of the preprocessor group.
     */
    readonly name = 'sveltex';

    /**
     *
     */
    readonly script: Preprocessor = ({
        content,
        attributes,
        filename,
    }: {
        content: string;
        attributes: Record<string, string | boolean>;
        markup: string;
        filename?: string;
    }) => {
        // If the filename is not set or does not end with an extension
        // configured for SvelTeX, return early.
        if (
            !filename ||
            !this.configuration.general.extensions.some((ext) =>
                filename.endsWith(ext),
            )
        ) {
            return;
        }

        const texComponents = this.texComponentsMap.get(filename);

        // If no TeX components are defined in this file, we don't need to
        // append anything to the `<script>` tag, so we return early.
        if (texComponents === undefined || texComponents.length === 0) return;

        const s = new MagicString(content);

        // This string represents the code that will be appended to the script
        // tag in the Svelte file. It imports the `onMount` function from Svelte
        // and uses it as a hook to fetch the SVG contents of the TeX components
        // and add them to the `<figure>` DOM elements that were created for
        // them.
        let str = [
            `import { onMount as __sveltex_onMount } from 'svelte';`,
            `__sveltex_onMount(async () => {`,
            `    try {`,
            ...texComponents.map(fetchAndSetSvg),
            `    } catch (err) {`,
            `        console.error('[sveltex error]', err);`,
            `    }`,
            `});`,
        ].join('\n');

        // For info on the language aliases being used here, see
        // https://github.com/sveltejs/svelte-preprocess/blob/c2107e529da9438ea5b8060aa471119940896e40/src/modules/language.ts#L29-L39
        //
        // WARNING: I'm not sure whether I should be doing `.toLowerCase()`
        // here, since I can't seem to find any point in the svelte-preprocess
        // source code where they do anything like it, meaning that they may
        // treat the `lang` attribute as case-sensitive. If that's the case,
        // then us treating it as case-insensitive could theoretically lead to a
        // situation where the user sets `lang="CoffeeScript"` and
        // svelte-preprocess expects regular JS in the `<script>` tag, but we
        // append CoffeeScript code, which would (presumably) throw an error.
        const lang = attributes['lang']?.toString().toLowerCase() ?? 'js';
        if (['coffee', 'coffeescript'].includes(lang)) {
            // If the user is using CoffeeScript, we need to wrap the code in
            // backticks to append it to the content of the script tag as
            // "embedded JavaScript".
            str = '\n```\n' + str + '\n```\n';
        } else {
            // If the user isn't using CoffeeScript, then they are presumably
            // using JS, TS, or Babel, any of which should be perfectly fine
            // with us appending our `str` code as-is. We wrap it with newlines
            // for nicer formatting, though.
            str = '\n' + str + '\n';
        }

        s.append(str);

        return {
            code: s.toString(),
            map: s.generateMap({ source: filename }),
            // We don't add the TeX or SVG files as dependencies because they're
            // automatically generated from the source code within the current file,
            // which is already watched for changes.
            dependencies: [
                'sveltex.config.js',
                'sveltex.config.cjs',
                'sveltex.config.mjs',
            ],
        } as Processed;
    };

    /**
     * - key: filename
     * - value: array of TeX components whose SVG content needs to be imported
     *   in the file's script tag and added to the DOM.
     */
    readonly texComponentsMap: Map<string, TexComponent[]> = new Map<
        string,
        TexComponent[]
    >();

    /**
     * @param content - The whole Svelte file content.
     * @param filename - The filename of the Svelte file. (Isn't this actually a
     * file*path*, though?)
     * @returns The preprocessed content.
     *
     * @remarks
     * The preprocessors are run in the following order (see [Svelte
     * docs](https://svelte.dev/docs/svelte-compiler#preprocess)):
     *
     * 1. `markup`
     * 2. `script`
     * 3. `style`
     */
    readonly markup: MarkupPreprocessor = async ({
        content,
        filename,
    }: {
        content: string;
        filename?: string;
    }) => {
        // If the filename is not set or does not end with an extension
        // configured for SvelTeX, return early.
        if (
            !filename ||
            !this.configuration.general.extensions.some((ext) =>
                filename.endsWith(ext),
            )
        ) {
            return;
        }

        const markdownHandler = this.markdownHandler;
        const codeHandler = this.codeHandler;
        const texHandler = this.texHandler;
        const verbatimHandler = this.verbatimHandler;

        try {
            // Step 1: Escape potentially tricky code (fenced code blocks,
            //         inline code, and content inside "verbatim" environments).
            const {
                escapedContent: escapedVerb,
                savedMatches: savedMatchesVerb,
                map: mapFromEscapingVerb,
            } = escapeVerb(this, content, filename);

            // console.log('1. content:', content);
            // console.log('1. escapedVerb:', escapedVerb);
            // console.log('1. savedMatchesVerb:', savedMatchesVerb);

            // Step 1.5: Process the saved matches.

            const processSavedMatches = Array.from(
                savedMatchesVerb.entries(),
            ).map(async ([uuid, content]) => {
                if (content.startsWith('`') || content.startsWith('~')) {
                    const processedContent = await codeHandler.process(content);
                    savedMatchesVerb.set(uuid, processedContent);
                } else if (content.startsWith('<')) {
                    const processedContent = await verbatimHandler.process(
                        content,
                        { filename },
                    );
                    savedMatchesVerb.set(uuid, processedContent);
                } else {
                    const processedContent = await texHandler.process(content);
                    savedMatchesVerb.set(uuid, processedContent);
                }
            });
            await Promise.all(processSavedMatches);

            // console.log('1.5. savedMatchesVerb:', savedMatchesVerb);

            // Step 2: Generate an AST of the (once) escaped content of the file
            //         using Svelte's parser.

            /**
             * AST (abstract syntax tree) of the (once) escaped markup,
             * generated using Svelte's parser.
             */
            const astEscapedVerb = parse(escapedVerb, filename);

            // console.log('2. astEscapedVerb:', astEscapedVerb);

            // Step 3: Walk the AST and keep track of the ranges of the mustache
            //         tag nodes.

            /**
             * Ranges (starting and ending positions in the (once) escaped
             * source code) of the mustache tags (i.e., nodes of type
             * `'MustacheTag'`). These are strings of the form `{...}`, which
             * are used to embed JavaScript expressions in the markup, and, as
             * far as the markup preprocessor is concerned, should be treated as
             * plain text (since that is what the contents of the expression
             * will ultimately return).
             */
            const mtRanges: Location[] = [];

            walk(
                astEscapedVerb,
                pushRangeIf('MustacheTag', mtRanges, escapedVerb),
            );

            // console.log('3. mtRanges:', mtRanges);

            // Step 4: Escape the mustache tag nodes by replacing them with
            //         UUIDv4 strings.

            const {
                escapedContent: escapedVerbAndMT,
                savedMatches: savedMatchesMT,
                map: mapFromEscapingMT,
            } = escapeMustacheTags(escapedVerb, mtRanges, filename);

            // console.log('4. escapedVerbAndMT:', escapedVerbAndMT);
            // console.log('4. savedMatchesMT:', savedMatchesMT);

            // Step 5: Merge the savedMatches maps (for convenience later on).

            const savedMatches = new Map([
                ...savedMatchesVerb,
                ...savedMatchesMT,
            ]);

            // console.log('5. savedMatches:', savedMatches);

            // Step 6: Generate an AST of the (twice) escaped content of the
            //         file using Svelte's parser.

            /**
             * AST (abstract syntax tree) of the escaped markup, generated using
             * Svelte's parser.
             */
            const astEscapedVerbAndMT = parse(escapedVerbAndMT, filename);

            // console.log('6. astEscapedVerbAndMT:', astEscapedVerbAndMT);

            // Step 7: Walk the AST and keep track of the ranges of the text
            //         nodes (which will now include what were formerly mustache
            //         tag nodes).

            /**
             * Ranges (starting and ending positions in the escaped source code)
             * of the text nodes (i.e., nodes of type `'Text'`).
             */
            const textRanges: Location[] = [];

            walk(
                astEscapedVerbAndMT,
                pushRangeIf('Text', textRanges, escapedVerbAndMT),
            );

            // console.log('7. textRanges:', textRanges);

            // Step 8: For each text node, "unescape" the escaped content and
            //         run the markdown preprocessor on the text content and
            //         sanitize the output. Use `magic-string` to help keep
            //         track of everything and generate a source map.

            const s = new MagicString(escapedVerbAndMT);

            /**
             * Since nodes of type `'Text'` do not have children, the ranges in
             * `textRanges` are guaranteed to be pairwise disjoint, meaning that
             * we don't have to worry about the order in which we process them.
             * We take advantage of this by processing them in parallel using
             * `Promise.all`.
             */
            const tasks = textRanges.map(async ({ start, end }) => {
                const substring = escapedVerbAndMT.slice(start, end);
                const unescapedContent = unescape(substring, savedMatches);
                const processedHtml =
                    await markdownHandler.process(unescapedContent);
                return { start, end, processedHtml };
            });

            const changes = await Promise.all(tasks);

            // console.log('8. changes:', changes);

            /**
             * The changes, computed in parallel, still need to be applied
             * synchronously to avoid
             * {@link https://en.wikipedia.org/wiki/Write-write_conflict | write-write conflicts}.
             */
            changes.forEach(({ start, end, processedHtml }) => {
                s.overwrite(start, end, processedHtml);
            });

            // TODO: improve this, it's rather bad (e.g., what if someone has
            // '<script> in a code block? or in a verbatim environment?)
            // add <script> tag if not present
            // /<script [^>]* > .*? <\/script>/su.test(s.toString()) ||
            //     s.prepend('<script>\n</script>\n');

            /**
             * Fully preprocessed
             */
            const code = s.toString();

            // console.log('8. code:', code);

            /**
             * Source map for the unescaping and markdown preprocessing.
             */
            const mapFromUnescapingAndMarkdownProcessing = s.generateMap({
                source: filename,
            });

            /**
             * Source map generated by combining the source maps from escaping
             * and unescaping with the source map generated by `magic-string`.
             */
            // @ts-expect-error Why is `remapping` not being recognized as a
            // function? (It seems it has something to do with tsconfig's
            // moduleResolution property — it works when set to "Bundler" or
            // "Node10", but complains when set to "Node16" or "NodeNext".)
            const map = remapping(
                [
                    mapFromEscapingVerb,
                    mapFromEscapingMT,
                    mapFromUnescapingAndMarkdownProcessing,
                ],
                () => null,
            ) as SourceMap;

            // console.log('8. map:', map);

            return { code, map };
        } catch (error) {
            log('error')(error);
            return;
        }
    };

    /**
     * ⚠ **Warning: `await` this method.**
     *
     * Configure the SvelTeX preprocessor.
     *
     * @example
     * Example usage:
     * ```ts
     * const sveltexPreprocessor = await sveltex('none', 'none', 'none', 'none');
     * await sveltexPreprocessor.configure({ ... })
     * ```
     */
    configure = async (configuration: SveltexConfig<M, C, T, A>) => {
        let mergedConfig = merge.withOptions(
            { mergeArrays: true },
            this.configuration,
            configuration,
        ) as FullSveltexConfig<M, C, T, A>;

        // `undefined` values in the configuration object should be replaced by
        // the default values.
        mergedConfig = merge.withOptions(
            { allowUndefinedOverrides: false },
            defaultSveltexConfig,
            mergedConfig,
        ) as FullSveltexConfig<M, C, T, A>;

        // console.log('this.configuration:', this.configuration);
        // console.log('configuration:', configuration);
        // console.log('mergedConfig:', mergedConfig);

        await Promise.all([
            this.markdownHandler.configure(mergedConfig.markdown),
            this.codeHandler.configure(mergedConfig.code),
            this.texHandler.configure(mergedConfig.tex),
            this.advancedTexHandler.configure(mergedConfig.advancedTex),
        ]);

        this.verbatimHandler.verbEnvs =
            mergedConfig.general.verbatimEnvironments;

        this._configuration = mergedConfig;

        return this;
    };

    private _configuration: FullSveltexConfig<M, C, T, A> =
        defaultSveltexConfig as FullSveltexConfig<M, C, T, A>;

    get configuration() {
        return this._configuration;
    }

    // We can safely add the definite assignment assertions here, since Sveltex
    // instances can only be created through the static `Sveltex.create` method
    // (the Sveltex constructor itself is private), which ensures that all
    // handlers are set.
    private _markdownHandler!: MarkdownHandler<M>;
    private _codeHandler!: CodeHandler<C>;
    private _texHandler!: TexHandler<T>;
    private _advancedTexHandler!: AdvancedTexHandler<A>;

    /**
     * ##### GETTER
     *
     * Getter for the {@link _markdownHandler | `_markdownHandler`} property,
     * which points to the markdown handler used by the Sveltex instance.
     */
    get markdownHandler() {
        return this._markdownHandler;
    }

    /**
     * ##### SETTER
     *
     * ⚠ **Pre-condition**: `this.markdownBackend === 'custom'`
     *
     * Setter for the {@link _markdownHandler | `_markdownHandler`} property.
     *
     * @throws Error if the markdown backend is not `'custom'`.
     */
    set markdownHandler(handler: MarkdownHandler<M>) {
        if (this.markdownBackend === 'custom') {
            this._markdownHandler = handler;
        } else {
            throw new Error(
                `markdownHandler setter can only be invoked if markdown backend is "custom" (got "${this.markdownBackend}" instead).`,
            );
        }
    }

    /**
     * ##### GETTER
     *
     * Getter for the {@link _codeHandler | `_codeHandler`} property, which
     * points to the code handler used by the Sveltex instance.
     */
    get codeHandler() {
        return this._codeHandler;
    }

    /**
     * ##### SETTER
     *
     * ⚠ **Pre-condition**: `this.codeBackend === 'custom'`
     *
     * Setter for the {@link _codeHandler | `_codeHandler`} property.
     *
     * @throws Error if the code backend is not `'custom'`.
     */
    set codeHandler(handler: CodeHandler<C>) {
        if (this.codeBackend === 'custom') {
            this._codeHandler = handler;
        } else {
            throw new Error(
                `codeHandler setter can only be invoked if code backend is "custom" (got "${this.codeBackend}" instead).`,
            );
        }
    }

    /**
     * ##### GETTER
     *
     * Getter for the {@link _texHandler | `_texHandler`} property, which points
     * to the TeX handler used by the Sveltex instance.
     */
    get texHandler() {
        return this._texHandler;
    }

    /**
     * ##### SETTER
     *
     * ⚠ **Pre-condition**: `this.texBackend === 'custom'`
     *
     * Setter for the {@link _texHandler | `_texHandler`} property.
     *
     * @throws Error if the TeX backend is not `'custom'`.
     */
    set texHandler(handler: TexHandler<T>) {
        if (this.texBackend === 'custom') {
            this._texHandler = handler;
        } else {
            throw new Error(
                `texHandler setter can only be invoked if TeX backend is "custom" (got "${this.texBackend}" instead).`,
            );
        }
    }

    /**
     * ##### GETTER
     *
     * Getter for the {@link _advancedTexHandler | `_advancedTexHandler`} property,
     * which points to the advanced TeX handler used by the Sveltex instance.
     */
    get advancedTexHandler() {
        return this._advancedTexHandler;
    }

    /**
     * ##### SETTER
     *
     * ⚠ **Pre-condition**: `this.advancedTexBackend === 'custom'`
     *
     * Setter for the {@link _advancedTexHandler | `_advancedTexHandler`}
     * property.
     *
     * @throws Error if the advanced TeX backend is not `'custom'`.
     */
    set advancedTexHandler(handler: AdvancedTexHandler<A>) {
        if (this.advancedTexBackend === 'custom') {
            this._advancedTexHandler = handler;
        } else {
            throw new Error(
                `advancedTexHandler setter can only be invoked if advanced TeX backend is "custom" (got "${this.advancedTexBackend}" instead).`,
            );
        }
    }

    private _verbatimHandler: VerbatimHandler<M, C, T, A>;

    /**
     * Getter for the {@link _verbatimHandler | `_verbatimHandler`} property,
     * which points to the verbatim handler used by the Sveltex instance.
     *
     * The verbatim handler is used to process content inside tags that are
     * designated as "verbatim" environments in the Sveltex instance's
     * {@link _configuration | configuration}.
     */
    get verbatimHandler() {
        return this._verbatimHandler;
    }

    advancedTexBackendIs<Q extends AdvancedTexBackend>(
        backend: Q,
    ): this is Sveltex<M, C, T, Q> {
        return this.advancedTexBackend === (backend as unknown);
    }

    public static async create<
        M extends MarkdownBackend,
        C extends CodeBackend,
        T extends TexBackend,
        A extends AdvancedTexBackend,
    >(
        markdownBackend: M,
        codeBackend: C,
        texBackend: T,
        advancedTexBackend: A,
    ): Promise<Sveltex<M, C, T, A>> {
        const sveltex = new Sveltex<M, C, T, A>(
            markdownBackend,
            codeBackend,
            texBackend,
            advancedTexBackend,
        );

        const errors = [];

        // Markdown handler
        if (isNonCustomBackend(markdownBackend)) {
            try {
                // TODO: Figure out why the type assertion was needed here;
                // seems rather weird.
                (sveltex._markdownHandler as unknown) =
                    await createMarkdownHandler(markdownBackend);
            } catch (err) {
                errors.push(err);
            }
        }
        // Code handler
        if (isNonCustomBackend(codeBackend)) {
            try {
                // TODO: Figure out why the type assertion was needed here;
                // seems rather weird.
                (sveltex._codeHandler as unknown) =
                    await createCodeHandler(codeBackend);
            } catch (err) {
                errors.push(err);
            }
        }

        // TeX handler
        if (isNonCustomBackend(texBackend)) {
            try {
                // TODO: Figure out why the type assertion was needed here;
                // seems rather weird.
                (sveltex._texHandler as unknown) =
                    await createTexHandler(texBackend);
            } catch (err) {
                errors.push(err);
            }
        }

        if (isNonCustomBackend(advancedTexBackend)) {
            // TODO: Figure out why the type assertion was needed here;
            // seems rather weird.
            (sveltex._advancedTexHandler as unknown) =
                await createAdvancedTexHandler(advancedTexBackend);
            sveltex._advancedTexHandler.texComponentsMap =
                sveltex.texComponentsMap;
        }

        if (errors.length > 0) {
            const install =
                '\n\nPlease install the necessary dependencies by running:\n\n' +
                `${packageManager} add -D ${missingDeps.join(' ')}`;

            throw Error(`Failed to create Sveltex preprocessor.` + install, {
                cause:
                    'The following dependencies could not be found: ' +
                    missingDeps.join() +
                    '.\n\nCaught errors:\n' +
                    errors.join('\n\n'),
            });
        }

        sveltex._verbatimHandler = new VerbatimHandler(sveltex);

        return sveltex;
    }

    readonly markdownBackend: M;
    readonly codeBackend: C;
    readonly texBackend: T;
    readonly advancedTexBackend: A;

    private constructor(
        markdownBackend: M,
        codeBackend: C,
        texBackend: T,
        advancedTexBackend: A,
    ) {
        this.markdownBackend = markdownBackend;
        this.codeBackend = codeBackend;
        this.texBackend = texBackend;
        this.advancedTexBackend = advancedTexBackend;

        if (this.advancedTexBackendIs('local')) {
            (this.configuration.advancedTex as unknown) =
                defaultAdvancedTexConfiguration.local;
        }

        this._verbatimHandler = new VerbatimHandler(this);
    }
}

// type SveltexConstructor<
//     M extends MarkdownBackend,
//     C extends CodeBackend,
//     T extends TexBackend,
//     A extends AdvancedTexBackend,
// > = new (backendConfig: BackendChoices<M, C, T, A>) => Sveltex<M, C, T, A>;

/**
 *
 */
export function pushRangeIf(type: string, ranges: Location[], content: string) {
    /**
     * Pushes the start and end positions of `node` to
     * {@link textRanges | `textRanges`} iff `node.type === type`.
     *
     * @param node - The node to process.
     */
    return (node: BaseNode) => {
        if (node.type === type) {
            ranges.push(getLocation(node, content));
        }
    };
}

export function fetchAndSetSvg(tc: TexComponent): string {
    return `document.getElementById('${tc.attributes.id}')?.insertAdjacentHTML('beforeend', await (await fetch('${tc.svgFilepathFromStatic}')).text());`;
}

// export function fetchSvg(tc: TexComponent): string {
//     return `${jsifyRef(tc.ref)} = (await import(${tc.svgFilepath})).default;`;
// }

export function importSvg(tc: TexComponent): string {
    return `import ${tc.svgComponentName} from '${tc.svgFilepath}';`;
}

/**
 *
 */
export function alphanumeric(str: string): string {
    return str.replace(/[^\w]/gu, '');
}

/**
 * Converts a string to a valid JavaScript identifier.
 */
// export function jsifyRef(ref: string): string {
//     return '_' + ref.replace(/[^\w]/g, '_');
// }
