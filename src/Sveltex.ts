// Types
import type { Processed } from '$types/Sveltex.js';
import type {
    BackendChoices,
    FullSveltexConfiguration,
    SveltexConfiguration,
} from '$types/SveltexConfiguration.js';
import type { AdvancedTexBackend } from '$types/handlers/AdvancedTex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { TexBackend, TexConfiguration } from '$types/handlers/Tex.js';
import type { Location } from '$types/utils/Ast.js';
import type {
    MarkupPreprocessor,
    Preprocessor,
    PreprocessorGroup,
} from 'svelte/compiler';

// Internal dependencies
import { getDefaultSveltexConfig } from '$config';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { TexHandler } from '$handlers/TexHandler.js';
import { VerbatimHandler } from '$handlers/VerbatimHandler.js';
import { TexComponent } from '$utils/TexComponent.js';
import { parse, pushRangeIf, walk } from '$utils/ast.js';
import { log, prettifyError } from '$utils/debug.js';
import { escapeMustacheTags, escapeVerb, unescape } from '$utils/escape.js';
import { missingDeps, packageManager } from '$utils/globals.js';
import { mergeConfigs } from '$utils/merge.js';

// External dependencies
import MagicString from 'magic-string';
import sorcery from 'sorcery';
import { ensureStartsWithSlash } from '$utils/misc.js';

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
    backendChoices?: BackendChoices<M, C, T, A> | undefined,
): Promise<Sveltex<M, C, T, A>> {
    return await Sveltex.create<M, C, T, A>(
        backendChoices?.markdownBackend ?? ('none' as M),
        backendChoices?.codeBackend ?? ('none' as C),
        backendChoices?.texBackend ?? ('none' as T),
        backendChoices?.advancedTexBackend ?? ('none' as A),
    );
}

export function notCustom<B extends string>(
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

    readonly markdownBackend: M;
    readonly codeBackend: C;
    readonly texBackend: T;
    readonly advancedTexBackend: A;

    // We can safely add the definite assignment assertions here, since Sveltex
    // instances can only be created through the static `Sveltex.create` method
    // (the Sveltex constructor itself is private), which ensures that all
    // handlers are set.
    private _markdownHandler!: MarkdownHandler<M>;
    private _codeHandler!: CodeHandler<C>;
    private _texHandler!: TexHandler<T>;
    private _advancedTexHandler!: AdvancedTexHandler<A>;
    private _verbatimHandler!: VerbatimHandler<C, A>;

    // The verbatim handler and the configuration can be initialized in the
    // constructor, so we don't need any definite assignment assertions here.

    private _configuration: FullSveltexConfiguration<M, C, T, A>;

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

        const texComponents = this._advancedTexHandler.texComponents[filename];

        // If no TeX components are defined in this file, we don't need to
        // append anything to the `<script>` tag, so we return early.
        if (texComponents === undefined || texComponents.length === 0) return;

        const s = new MagicString(content);

        // This string represents the code that will be appended to the script
        // tag in the Svelte file. It imports the `onMount` function from Svelte
        // and uses it as a hook to fetch the SVG contents of the TeX components
        // and add them to the `<figure>` DOM elements that were created for
        // them.
        const lines = texComponents.map((tcii) => TexComponent.importSvg(tcii));

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

        if (this.texBackend === 'katex' || this.texBackend === 'mathjax') {
            const read = (
                this.texHandler as unknown as TexHandler<'katex' | 'mathjax'>
            ).configuration.css.read;
            if (read) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const path = this.texHandler.stylesheetPath!;
                lines.push(`import '${ensureStartsWithSlash(path)}';`);
            }
        }

        let str = lines.join('\n');

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
            map: s.generateMap({
                source: filename,
                hires: 'boundary',
                includeContent: true,
            }),
            // We don't add the TeX or SVG files as dependencies because they're
            // automatically generated from the source code within the current
            // file, which is already watched for changes.
            dependencies: [
                'sveltex.config.js',
                'sveltex.config.cjs',
                'sveltex.config.mjs',
            ],
        } as Processed;
    };

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
    }): Promise<Processed | undefined> => {
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

            // Step 2: Process the saved matches.
            const processSavedMatches = Array.from(
                savedMatchesVerb.entries(),
            ).map(async ([uuid, content]) => {
                let processedContent = '';
                if (content.startsWith('`') || content.startsWith('~')) {
                    processedContent = await codeHandler.process(content);
                } else if (content.startsWith('<')) {
                    processedContent = await verbatimHandler.process(content, {
                        filename,
                    });
                } else {
                    processedContent = await texHandler.process(content);
                }
                savedMatchesVerb.set(uuid, processedContent);
            });
            await Promise.all(processSavedMatches);

            // Step 3: Generate an AST of the (once) escaped content of the file
            //         using Svelte's parser.

            /**
             * AST (abstract syntax tree) of the (once) escaped markup,
             * generated using Svelte's parser.
             */
            const { ast: astEscapedVerb, scriptPresent: scriptPresentV4 } =
                parse(escapedVerb, filename);

            // Step 4: Walk the AST and keep track of the ranges of the mustache
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

            // Step 5: Escape the mustache tag nodes by replacing them with
            //         UUIDv4 strings.

            const {
                escapedContent: escapedVerbAndMT,
                savedMatches: savedMatchesMT,
                map: mapFromEscapingMT,
            } = escapeMustacheTags(
                escapedVerb,
                mtRanges,
                filename + '_escapedVerb',
            );

            // Step 6: Merge the savedMatches maps (for convenience later on).

            const savedMatches = new Map([
                ...savedMatchesVerb,
                ...savedMatchesMT,
            ]);

            // Step 7: Generate an AST of the (twice) escaped content of the
            //         file using Svelte's parser.

            /**
             * AST (abstract syntax tree) of the escaped markup, generated using
             * Svelte's parser.
             */
            const { ast: astEscapedVerbAndMT } = parse(
                escapedVerbAndMT,
                filename,
            );

            // Step 8: Walk the AST and keep track of the ranges of the text
            //         nodes (which will now include what were formerly mustache
            //         tag nodes). Also, check if there is a `<script>` tag in
            //         the file.

            /**
             * Ranges (starting and ending positions in the escaped source code)
             * of the text nodes (i.e., nodes of type `'Text'`).
             */
            const textRanges: Location[] = [];

            /**
             * Whether a `<script>` tag is present in the file. If not, we'll
             * add one ourselves (this is to ensure that the `script` function
             * of the preprocessor runs, which is important for
             * `AdvancedTexHandler`).
             */
            let scriptPresent: boolean;

            // We're currently only running unit tests with Svelte 4, so
            // `scriptPresentV4 === undefined` is always false, making that
            // branch of the if statement unreachable.
            /* v8 ignore next 8 (unreachable code) */
            if (scriptPresentV4 === undefined) {
                scriptPresent = false;
                walk(astEscapedVerbAndMT, (node) => {
                    pushRangeIf('Text', textRanges, escapedVerbAndMT)(node);
                    if (!scriptPresent && node.type === 'Script') {
                        scriptPresent = true;
                    }
                });
            } else {
                scriptPresent = scriptPresentV4;
                walk(
                    astEscapedVerbAndMT,
                    pushRangeIf('Text', textRanges, escapedVerbAndMT),
                );
            }

            // Step 9: For each text node, "unescape" the escaped content and
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
                const processedHtml = await markdownHandler.process(substring);
                const processedAndUnescaped = unescape(
                    processedHtml,
                    savedMatches,
                );
                return { start, end, processedAndUnescaped };
            });

            const changes = await Promise.all(tasks);

            /**
             * The changes, computed in parallel, still need to be applied
             * synchronously to avoid
             * {@link https://en.wikipedia.org/wiki/Write-write_conflict | write-write conflicts}.
             */
            changes.forEach(({ start, end, processedAndUnescaped }) => {
                s.overwrite(start, end, processedAndUnescaped);
            });

            // Add <script> tag if not present
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!scriptPresent) {
                s.prepend('<script>\n</script>\n');
            }

            /**
             * Fully preprocessed content.
             */
            const code = s.toString();

            /**
             * Source map for the unescaping and markdown preprocessing.
             */
            const mapFromUnescapingAndMarkdownProcessing = s.generateMap({
                source: filename + '_escapedVerbAndMT',
                hires: 'boundary',
                includeContent: true,
            });

            const chain = await sorcery.load(filename + '_final', {
                content: {
                    [filename + '_final']: code,
                    [filename + '_escapedVerb']: escapedVerb,
                    [filename + '_escapedVerbAndMT']: escapedVerbAndMT,
                    [filename]: content,
                },
                sourcemaps: {
                    [filename + '_final']:
                        mapFromUnescapingAndMarkdownProcessing,
                    [filename + '_escapedVerbAndMT']: mapFromEscapingMT,
                    [filename + '_escapedVerb']: mapFromEscapingVerb,
                },
            });
            const map = chain?.apply() ?? {
                version: 3,
                file: filename,
                mappings: '',
                names: [],
                sources: [],
                sourcesContent: [],
            };

            return { code, map };
        } catch (err) {
            log('error', prettifyError(err));
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
     * const sveltexPreprocessor = await sveltex({ markdownBackend: 'none', codeBackend: 'none', texBackend: 'none', advancedTexBackend: 'none' });
     * await sveltexPreprocessor.configure({ ... })
     * ```
     */
    async configure(configuration: SveltexConfiguration<M, C, T, A>) {
        const mergedConfig = mergeConfigs(this._configuration, configuration);

        await Promise.all([
            this.markdownHandler.configure(mergedConfig.markdown),
            this.codeHandler.configure(mergedConfig.code),
            this.texHandler.configure(mergedConfig.tex as TexConfiguration<T>),
            this.advancedTexHandler.configure(mergedConfig.advancedTex),
        ]);

        // Since VerbatimHandler uses CodeHandler and AdvancedTexHandler, we
        // want to make sure that those dependencies are fully configured before
        // configuring the VerbatimHandler.
        await this.verbatimHandler.configure(mergedConfig.verbatim);

        this._configuration = mergedConfig;
    }

    get configuration() {
        return this._configuration;
    }

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

    /**
     * Helper method primarily used for type narrowing.
     */
    private nonCustomBackend<
        H extends 'markdown' | 'code' | 'tex' | 'advancedTex',
    >(
        h: H,
    ): this is Sveltex<
        H extends 'markdown' ? Exclude<M, 'custom'> : M,
        H extends 'code' ? Exclude<C, 'custom'> : C,
        H extends 'tex' ? Exclude<T, 'custom'> : T,
        H extends 'advancedTex' ? Exclude<A, 'custom'> : A
    > {
        switch (h) {
            case 'markdown':
                return this.markdownBackend !== 'custom';
            case 'code':
                return this.codeBackend !== 'custom';
            case 'tex':
                return this.texBackend !== 'custom';
            case 'advancedTex':
                return this.advancedTexBackend !== 'custom';
            /* v8 ignore next 2 (unreachable code) */
            default:
                return false;
        }
    }

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
        if (
            sveltex.nonCustomBackend('markdown') &&
            notCustom(markdownBackend)
        ) {
            try {
                (sveltex._markdownHandler as MarkdownHandler<
                    Exclude<M, 'custom'>
                >) = await MarkdownHandler.create(markdownBackend);
            } catch (err) {
                errors.push(err);
            }
        }
        // Code handler
        if (sveltex.nonCustomBackend('code') && notCustom(codeBackend)) {
            try {
                (sveltex._codeHandler as CodeHandler<Exclude<C, 'custom'>>) =
                    await CodeHandler.create(codeBackend);
            } catch (err) {
                errors.push(err);
            }
        }

        // TeX handler
        if (sveltex.nonCustomBackend('tex') && notCustom(texBackend)) {
            try {
                (sveltex._texHandler as TexHandler<Exclude<T, 'custom'>>) =
                    await TexHandler.create(texBackend);
            } catch (err) {
                errors.push(err);
            }
        }

        if (
            sveltex.nonCustomBackend('advancedTex') &&
            notCustom(advancedTexBackend)
        ) {
            const advancedTexHandler =
                await AdvancedTexHandler.create(advancedTexBackend);
            (sveltex._advancedTexHandler as AdvancedTexHandler<
                Exclude<A, 'custom'>
            >) = advancedTexHandler;
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

        sveltex._verbatimHandler = VerbatimHandler.create(
            sveltex.codeHandler,
            sveltex.advancedTexHandler,
        );

        return sveltex;
    }

    private constructor(
        markdownBackend: M,
        codeBackend: C,
        texBackend: T,
        advancedTexBackend: A,
    ) {
        // Take note of the backends chosen by the user.
        this.markdownBackend = markdownBackend;
        this.codeBackend = codeBackend;
        this.texBackend = texBackend;
        this.advancedTexBackend = advancedTexBackend;

        // Initialize configuration with defaults corresponding to the chosen
        // backends.
        this._configuration = getDefaultSveltexConfig(
            this.markdownBackend,
            this.codeBackend,
            this.texBackend,
            this.advancedTexBackend,
        );
    }
}
