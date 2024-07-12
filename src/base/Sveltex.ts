// File description: Definition of the `Sveltex` class, which implements
// Svelte's `PreprocessorGroup` interface.

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
import type { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type {
    MathBackend,
    MathConfiguration,
    MathProcessOptions,
} from '$types/handlers/Math.js';
import type { ProcessedSnippet, Snippet } from '$types/utils/Escape.js';

// Internal dependencies
import { getDefaultSveltexConfig } from '$base/defaults.js';
import { TexHandler } from '$handlers/TexHandler.js';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { MathHandler } from '$handlers/MathHandler.js';
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
import type { Frontmatter } from '$types/utils/Frontmatter.js';
import { applyTransformations } from '$utils/transformers.js';
import { enquote } from '$utils/diagnosers/Diagnoser.js';
import { deepClone } from '$handlers/Handler.js';
import { copyTransformations } from '$utils/misc.js';

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
    T extends MathBackend,
>(
    backendChoices?: BackendChoices<M, C, T> | undefined,
    configuration?: SveltexConfiguration<M, C, T> | undefined,
): Promise<Sveltex<M, C, T>> {
    if (backendChoices && diagnoseBackendChoices(backendChoices).errors !== 0) {
        throw new Error('Invalid backend choices. See console for details.');
    }
    const s = await Sveltex.create<M, C, T>(
        backendChoices?.markdownBackend ?? ('none' as M),
        backendChoices?.codeBackend ?? ('none' as C),
        backendChoices?.mathBackend ?? ('none' as T),
        configuration ?? ({} as SveltexConfiguration<M, C, T>),
    );
    return s;
}

/**
 * The `Sveltex` class implements Svelte's
 * {@link PreprocessorGroup | `PreprocessorGroup`} interface, and is the awaited
 * return type of the {@link sveltex | `sveltex`} method. Its most important
 * methods are `markup`, which is run on the Svelte file's entire contents, and
 * `script`, which is run on the content of the `<script>` tag in the Svelte
 * file, _after_ the `markup` method. Together, they define how the Svelte file
 * is preprocessed.
 *
 * @typeParam M - The markdown backend to use. Defaults to `'none'`.
 * @typeParam C - The code backend to use. Defaults to `'none'`.
 * @typeParam T - The math backend to use. Defaults to `'none'`.
 */
export class Sveltex<
    M extends MarkdownBackend = 'none',
    C extends CodeBackend = 'none',
    T extends MathBackend = 'none',
> implements PreprocessorGroup
{
    /**
     * The name of the preprocessor group.
     */
    readonly name = 'sveltex';

    /**
     * The markdown backend used by the Sveltex instance.
     */
    readonly markdownBackend: M;

    /**
     * The code backend used by the Sveltex instance.
     */
    readonly codeBackend: C;

    /**
     * The TeX backend used by the Sveltex instance.
     */
    readonly mathBackend: T;

    // We can safely add the definite assignment assertions here, since Sveltex
    // instances can only be created through the static `Sveltex.create` method
    // (the Sveltex constructor itself is private), which ensures that all
    // handlers are set.
    private _markdownHandler!: MarkdownHandler<M>;
    private _codeHandler!: CodeHandler<C>;
    private _mathHandler!: MathHandler<T>;
    private _texHandler!: TexHandler;
    private _verbatimHandler!: VerbatimHandler<C>;

    // The verbatim handler and the configuration can be initialized in the
    // constructor, so we don't need any definite assignment assertions here.

    private _configuration: FullSveltexConfiguration<M, C, T>;

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
            !this._configuration.extensions.some((ext) =>
                filename.endsWith(ext),
            )
        ) {
            return;
        }

        const tcInfos = this._texHandler.texComponents[filename] ?? [];

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

        if (this.mathPresent[filename]) {
            script.push(...this._mathHandler.scriptLines);
        }
        if (this.codePresent[filename]) {
            script.push(...this._codeHandler.scriptLines);
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

    /**
     * Whether code (as in code blocks or code spans) is present in the Svelte
     * file. Used to decide whether CSS should be added to the Svelte file's
     * `<svelte:head>` tag (assuming that the user has enabled the feature and
     * is using a code backend that can make use of this feature).
     */
    private codePresent: Record<string, boolean> = {};

    /**
     * Whether math is present in the Svelte file. Used to decide whether CSS
     * should be added to the Svelte file's `<svelte:head>` tag (assuming that
     * the user has enabled the feature).
     */
    private mathPresent: Record<string, boolean> = {};

    /**
     * Lines to add to the `<script>` tag in the Svelte file, e.g. `import`
     * statements for the TeX components or variable definitions from the
     * frontmatter.
     */
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
            !this._configuration.extensions.some((ext) =>
                filename.endsWith(ext),
            )
        ) {
            return;
        }

        const markdownHandler = this._markdownHandler;
        const codeHandler = this._codeHandler;
        const mathHandler = this._mathHandler;
        const verbatimHandler = this._verbatimHandler;

        try {
            // Step 1: Escape potentially tricky code (fenced code blocks,
            //         inline code, and content inside "verbatim" environments).
            const { escapedDocument, escapedSnippets } = escape(
                content,
                [...this._verbatimHandler.verbEnvs.keys()],
                this._configuration.math.delims,
                this._verbatimHandler.verbEnvs,
                this._configuration.markdown.directives,
            );

            let headId: string | undefined = undefined;
            let headSnippet: ProcessedSnippet | undefined = undefined;
            let scriptPresent: boolean = false;
            const prependToProcessed: string[] = [];
            let frontmatter: Frontmatter | undefined = undefined;

            let codePresent = false;
            let mathPresent = false;

            const headLines: string[] = [];

            // Step 2: Process the saved matches.
            const processedSnippets: [string, ProcessedSnippet][] = [];
            const processEscapedSnippets = escapedSnippets.map(
                async ([uuid, snippet]) => {
                    let processedSnippet: ProcessedSnippet;
                    let processed = '';
                    const unescapeOptions = snippet.unescapeOptions ?? {
                        removeParagraphTag: true,
                    };
                    if (snippet.type === 'code') {
                        typeAssert(is<Snippet<'code'>>(snippet));
                        if (!codePresent) codePresent = true;
                        processedSnippet = await codeHandler.process(
                            snippet.processable.innerContent,
                            {
                                ...snippet.processable.optionsForProcessor,
                            },
                        );
                    } else if (snippet.type === 'verbatim') {
                        typeAssert(is<Snippet<'verbatim'>>(snippet));
                        // snippet.original.loc.start.line
                        processedSnippet = await verbatimHandler.process(
                            snippet.processable.innerContent,
                            {
                                filename,
                                ...snippet.processable.optionsForProcessor,
                            },
                        );
                    } else if (snippet.type === 'math') {
                        typeAssert(is<Snippet<'math'>>(snippet));
                        if (!mathPresent) mathPresent = true;
                        processedSnippet = await mathHandler.process(
                            snippet.processable.innerContent,
                            snippet.processable
                                .optionsForProcessor as MathProcessOptions<T>,
                        );
                    } else if (snippet.type === 'frontmatter') {
                        typeAssert(is<Snippet<'frontmatter'>>(snippet));
                        const handledFrontmatter = handleFrontmatter(
                            snippet.processable,
                        );
                        headLines.push(...handledFrontmatter.headLines);
                        this.scriptLines[filename] =
                            handledFrontmatter.scriptLines;
                        frontmatter = handledFrontmatter.frontmatter;
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
            if (mathPresent) {
                this.mathPresent[filename] = true;
                headLines.push(...this._mathHandler.headLines);
                this._mathHandler.updateCss();
            }
            if (codePresent) {
                this.codePresent[filename] = true;
                headLines.push(...this._codeHandler.headLines);
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

            let html = escapedDocument;

            // Apply the pre-transformers
            html = applyTransformations(
                html,
                frontmatter ?? {},
                markdownHandler.configuration.transformers.pre,
            );

            html = (await markdownHandler.process(html, { filename }))
                .processed;

            // Apply the post-transformers
            html = applyTransformations(
                html,
                frontmatter ?? {},
                markdownHandler.configuration.transformers.post,
            );
            /* eslint-enable @typescript-eslint/no-unnecessary-condition */

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
     * Deep copy of the configuration object.
     *
     * ⚠ **Warning**: Mutating this object will have no effect on the Sveltex
     * instance.
     */
    get configuration(): FullSveltexConfiguration<M, C, T> {
        const clone = deepClone(this._configuration);
        const { markdown, code, math, verbatim } = this._configuration;

        // rfdc doesn't handle RegExps well, so we have to copy them manually
        const tMarkdown = markdown.transformers;
        clone.markdown.transformers.pre = copyTransformations(tMarkdown.pre);
        clone.markdown.transformers.post = copyTransformations(tMarkdown.post);

        const tCode = code.transformers;
        clone.code.transformers.pre = copyTransformations(tCode.pre);
        clone.code.transformers.post = copyTransformations(tCode.post);

        const tMath = math.transformers;
        clone.math.transformers.pre = copyTransformations(tMath.pre);
        clone.math.transformers.post = copyTransformations(tMath.post);

        clone.verbatim = Object.fromEntries(
            Object.entries(this._verbatimHandler.configuration).map(
                ([k, v]) => {
                    const real = verbatim[k];
                    if (real?.transformers) {
                        const { transformers } = real;
                        const { pre, post } = transformers;
                        return [
                            k,
                            {
                                ...v,
                                transformers: {
                                    pre: copyTransformations(pre),
                                    post: copyTransformations(post),
                                },
                            },
                        ];
                    } else {
                        return [k, v];
                    }
                },
            ),
        );

        return clone;
    }

    public static async create<
        M extends MarkdownBackend,
        C extends CodeBackend,
        T extends MathBackend,
    >(
        markdownBackend: M,
        codeBackend: C,
        mathBackend: T,
        userConfig: SveltexConfiguration<M, C, T>,
    ): Promise<Sveltex<M, C, T>> {
        const sveltex = new Sveltex<M, C, T>(
            markdownBackend,
            codeBackend,
            mathBackend,
        );
        sveltex._configuration = mergeConfigs(
            sveltex._configuration,
            userConfig,
        );

        const errors = [];

        // Markdown handler
        try {
            sveltex._markdownHandler = await MarkdownHandler.create(
                markdownBackend,
                userConfig.markdown,
            );
        } catch (err) {
            errors.push(err);
        }

        // Code handler
        try {
            (sveltex._codeHandler as unknown) = await CodeHandler.create(
                codeBackend,
                sveltex._configuration.code as CodeConfiguration<C>,
            );
        } catch (err) {
            errors.push(err);
        }

        // Math handler
        try {
            sveltex._mathHandler = await MathHandler.create(
                mathBackend,
                sveltex._configuration.math as unknown as MathConfiguration<T>,
            );
        } catch (err) {
            errors.push(err);
        }

        if (errors.length > 0) {
            const install =
                '\n\nPlease install the necessary dependencies by running:\n\n' +
                `${await detectPackageManager()} add -D ${missingDeps.join(' ')}`;

            throw Error(`Failed to create Sveltex preprocessor.` + install, {
                cause:
                    'The following dependencies could not be found: ' +
                    missingDeps.map(enquote).join(', ') +
                    '.\n\nCaught errors:\n' +
                    errors.join('\n\n'),
            });
        }

        sveltex._texHandler = await TexHandler.create(
            sveltex._configuration.tex,
        );

        sveltex._verbatimHandler = VerbatimHandler.create(
            sveltex._codeHandler,
            sveltex._texHandler,
            userConfig.verbatim,
        );

        return sveltex;
    }

    private constructor(markdownBackend: M, codeBackend: C, mathBackend: T) {
        // Take note of the backends chosen by the user.
        this.markdownBackend = markdownBackend;
        this.codeBackend = codeBackend;
        this.mathBackend = mathBackend;

        // Initialize configuration with defaults corresponding to the chosen
        // backends.
        this._configuration = getDefaultSveltexConfig(
            this.markdownBackend,
            this.codeBackend,
            this.mathBackend,
        );
    }
}
