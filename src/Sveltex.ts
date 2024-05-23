// Types
import type {
    MarkupPreprocessor,
    Preprocessor,
    PreprocessorGroup,
} from '$deps.js';
import type { Processed } from '$types/Sveltex.js';
import type {
    BackendChoices,
    FullSveltexConfiguration,
    SveltexConfiguration,
} from '$types/SveltexConfiguration.js';
import type { AdvancedTexBackend } from '$types/handlers/AdvancedTex.js';
import type { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type {
    TexBackend,
    TexConfiguration,
    TexProcessOptions,
} from '$types/handlers/Tex.js';
import type { ProcessedSnippet, Snippet } from '$types/utils/Escape.js';

// Internal dependencies
import { getDefaultSveltexConfig } from '$config/defaults.js';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { TexHandler } from '$handlers/TexHandler.js';
import { VerbatimHandler } from '$handlers/VerbatimHandler.js';
import { TexComponent } from '$utils/TexComponent.js';
import { log, prettifyError } from '$utils/debug.js';
import { diagnoseBackendChoices } from '$utils/diagnosers/backendChoices.js';
import { detectPackageManager, missingDeps } from '$utils/env.js';
import {
    colonUuid,
    escape,
    unescapeColons,
    unescapeSnippets,
} from '$utils/escape.js';
import { mergeConfigs } from '$utils/merge.js';

// External dependencies
import { MagicString, is, typeAssert } from '$deps.js';
import { handleFrontmatter } from '$utils/frontmatter.js';

/**
 * Returns a promise that resolves to a new instance of `Sveltex`.
 *
 * **Important**: You must `await` the result of this function before using the
 * `Sveltex` instance.
 *
 * @param backendChoices - The backend choices to use for the Sveltex instance.
 * @param configuration - The configuration to use for the Sveltex instance. The
 * instance can also be configured later using the `configure` method.
 *
 * @throws Error if the backend choices are invalid.
 */
export async function sveltex<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(
    backendChoices?: BackendChoices<M, C, T, A> | undefined,
    configuration?: SveltexConfiguration<M, C, T, A> | undefined,
): Promise<Sveltex<M, C, T, A>> {
    if (backendChoices && diagnoseBackendChoices(backendChoices).errors !== 0) {
        throw new Error('Invalid backend choices. See console for details.');
    }
    const s = await Sveltex.create<M, C, T, A>(
        backendChoices?.markdownBackend ?? ('none' as M),
        backendChoices?.codeBackend ?? ('none' as C),
        backendChoices?.texBackend ?? ('none' as T),
        backendChoices?.advancedTexBackend ?? ('none' as A),
    );
    if (configuration) await s.configure(configuration);
    return s;
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

        const tcInfos = this._advancedTexHandler.texComponents[filename] ?? [];

        const s = new MagicString(content);

        // This array represents the code that will be appended to the <script>
        // tag in the Svelte file. It imports the `onMount` function from Svelte
        // and uses it as a hook to fetch the SVG contents of the TeX components
        // and add them to the `<figure>` DOM elements that were created for
        // them.
        const script = tcInfos.map((info) => TexComponent.importSvg(info));

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

        if (this.texPresent[filename]) {
            script.push(...this.texHandler.scriptLines);
        }
        if (this.codePresent[filename]) {
            script.push(...this.codeHandler.scriptLines);
        }
        // From frontmatter
        script.push(...(this.scriptLines[filename] ?? []));

        if (script.length === 0) return;

        let str = script.join('\n');

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

    private codePresent: Record<string, boolean> = {};
    private texPresent: Record<string, boolean> = {};

    private scriptLines: Record<string, string[]> = {};

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
            !this._configuration.general.extensions.some((ext) =>
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
            const { escapedDocument, escapedSnippets } = escape(
                content,
                [
                    ...this.verbatimHandler.verbEnvs.keys(),
                    // ...this.advancedTexHandler.tccNames,
                    // ...this.advancedTexHandler.tccAliases,
                ],
                this.configuration.general.tex,
                this._verbatimHandler.verbEnvs,
            );

            let headId: string | undefined = undefined;
            let headSnippet: ProcessedSnippet | undefined = undefined;
            let scriptPresent: boolean = false;
            const prependToProcessed: string[] = [];

            let codePresent = false;
            let texPresent = false;

            const headLines: string[] = [];

            // Step 2: Process the saved matches.
            const processedSnippets: [string, ProcessedSnippet][] = [];
            const processEscapedSnippets = escapedSnippets.map(
                async ([uuid, snippet]) => {
                    let processedSnippet: ProcessedSnippet;
                    let processed = '';
                    const { unescapeOptions } = snippet;
                    if (snippet.type === 'code') {
                        typeAssert(is<Snippet<'code'>>(snippet));
                        if (!codePresent) codePresent = true;
                        processedSnippet = await codeHandler.process(
                            snippet.processable.innerContent,
                            snippet.processable.optionsForProcessor,
                        );
                    } else if (snippet.type === 'verbatim') {
                        typeAssert(is<Snippet<'verbatim'>>(snippet));
                        processedSnippet = await verbatimHandler.process(
                            snippet.processable.innerContent,
                            {
                                filename,
                                ...snippet.processable.optionsForProcessor,
                            },
                        );
                    } else if (snippet.type === 'tex') {
                        typeAssert(is<Snippet<'tex'>>(snippet));
                        if (!texPresent) texPresent = true;
                        processedSnippet = await texHandler.process(
                            snippet.processable.innerContent,
                            snippet.processable
                                .optionsForProcessor as TexProcessOptions<T>,
                        );
                    } else if (snippet.type === 'frontmatter') {
                        typeAssert(is<Snippet<'frontmatter'>>(snippet));
                        const handledFrontmatter = handleFrontmatter(
                            snippet.processable,
                        );
                        headLines.push(...handledFrontmatter.headLines);
                        this.scriptLines[filename] =
                            handledFrontmatter.scriptLines;
                        processedSnippet = {
                            processed: '',
                            unescapeOptions,
                        };
                    } else {
                        typeAssert(
                            is<Snippet<'svelte' | 'mustacheTag'>>(snippet),
                        );
                        processed = snippet.original.outerContent;
                        if (snippet.type === 'svelte') {
                            if (
                                !headId &&
                                processed.startsWith(`<svelte${colonUuid}head`)
                            ) {
                                headId = uuid;
                            } else if (
                                !scriptPresent &&
                                processed.startsWith('<script')
                            ) {
                                scriptPresent = true;
                            }
                        }
                        processedSnippet = {
                            processed,
                            unescapeOptions,
                        };
                    }

                    processedSnippets.push([uuid, processedSnippet]);
                },
            );
            await Promise.all(processEscapedSnippets);

            // ESLint doesn't realize that the Promise.all call above may modify
            // the `texPresent`, `codePresent`, `scriptPresent`, and `headId`
            // variables, so it thinks they're always false. We need to
            // temporarily disable the `no-unnecessary-condition` rule to avoid
            // the warning.
            /* eslint-disable @typescript-eslint/no-unnecessary-condition */
            if (texPresent) {
                this.texPresent[filename] = true;
                headLines.push(...this.texHandler.headLines);
            }
            if (codePresent) {
                this.codePresent[filename] = true;
                headLines.push(...this.codeHandler.headLines);
            }
            if (headLines.length > 0) {
                if (headId) {
                    headSnippet = processedSnippets.find(
                        (ps) => ps[0] === headId,
                    )?.[1];
                }
                if (headSnippet) {
                    headSnippet.processed = headSnippet.processed.replace(
                        new RegExp(`</\\s*svelte${colonUuid}head\\s*>`),
                        headLines.join('\n') + '\n$0',
                    );
                } else {
                    prependToProcessed.push(
                        `<svelte:head>`,
                        ...headLines,
                        `</svelte:head>`,
                    );
                }
            }

            // Add <script> tag if not present
            if (!scriptPresent) {
                prependToProcessed.push('<script>', '</script>');
            }
            /* eslint-enable @typescript-eslint/no-unnecessary-condition */

            const html = (await markdownHandler.process(escapedDocument))
                .processed;

            let code = unescapeSnippets(html, processedSnippets);
            code = unescapeColons(code);
            if (prependToProcessed.length > 0) {
                code = prependToProcessed.join('\n') + '\n' + code;
            }

            return { code };
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
            this.codeHandler.configure(
                mergedConfig.code as CodeConfiguration<C>,
            ),
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
                `${detectPackageManager()} add -D ${missingDeps.join(' ')}`;

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
