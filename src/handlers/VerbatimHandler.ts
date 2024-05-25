// NOTE: Some lines in this file are excluding from coverage. This is because
// they should be technically unreachable. At the same time, I don't want to
// remove them because I want to keep type assertions to a minimum.

// Types
import type { AdvancedTexBackend } from '$types/handlers/AdvancedTex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { ConfigureFn, ProcessFn } from '$types/handlers/Handler.js';
import type {
    FullVerbatimConfiguration,
    FullVerbEnvConfig,
    FullVerbEnvConfigAdvancedTex,
    FullVerbEnvConfigCode,
    FullVerbEnvConfigCustom,
    FullVerbEnvConfigEscapeOnly,
    FullVerbEnvConfigNoop,
    VerbatimConfiguration,
    VerbatimProcessOptions,
} from '$types/handlers/Verbatim.js';
import type { ProcessedSnippet, UnescapeOptions } from '$types/utils/Escape.js';

// Internal dependencies
import { getDefaultVerbEnvConfig } from '$config/defaults.js';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { Handler } from '$handlers/Handler.js';
import { log } from '$utils/debug.js';
import { diagnoseVerbEnvConfig } from '$utils/diagnosers/verbatimEnvironmentConfiguration.js';
import { escapeBraces } from '$utils/escape.js';
import { mergeConfigs } from '$utils/merge.js';

// External dependencies
import { escapeHtml, is, nodeAssert, rfdc, typeAssert } from '$deps.js';
import { applyTransformations } from '$utils/transformations.js';
import { copyTransformations } from '$utils/misc.js';

const deepClone = rfdc();

/**
 * Handler for verbatim environments.
 */
export class VerbatimHandler<
    C extends CodeBackend,
    A extends AdvancedTexBackend,
> extends Handler<
    'verbatim',
    'verbatim',
    Record<string, never>,
    VerbatimProcessOptions,
    VerbatimConfiguration,
    FullVerbatimConfiguration,
    VerbatimHandler<C, A>
> {
    /**
     * Code handler to which code processing should be delegated.
     */
    private readonly codeHandler: CodeHandler<C>;

    /**
     * Advanced TeX handler to which advanced TeX processing should be
     * delegated.
     */
    private readonly advancedTexHandler: AdvancedTexHandler<A>;

    override get configuration() {
        // rfdc doesn't handle RegExps well, so we have to copy them manually
        return Object.fromEntries(
            Object.entries(deepClone(this._configuration)).map(([k, v]) => {
                const real = this._configuration[k];
                nodeAssert(real?.transformations);
                const { transformations } = real;
                const { pre, post } = transformations;
                return [
                    k,
                    {
                        ...v,
                        transformations: {
                            pre: copyTransformations(pre),
                            post: copyTransformations(post),
                        },
                    },
                ];
            }),
        );
    }

    static create<C extends CodeBackend, A extends AdvancedTexBackend>(
        codeHandler: CodeHandler<C>,
        advancedTexHandler: AdvancedTexHandler<A>,
    ) {
        /**
         * @param content - The content to process (incl. HTML tag)
         * @returns The processed content
         *
         * @readonly
         *
         * @remarks
         * 1. Parse HTML tag and attributes
         * 2. Find corresponding verbatim environment
         * 3. Process content according to verbatim environment, possibly using
         *    attributes from the HTML tag
         * 4. Return processed content, wrapped in the original HTML tag and
         *    attributes (except if config specifies otherwise)
         *
         */
        const process = async (
            innerContent: string,
            options: VerbatimProcessOptions,
            verbatimHandler: VerbatimHandler<C, A>,
        ): Promise<ProcessedSnippet> => {
            const { tag, attributes, selfClosing, outerContent } = options;

            /**
             * At the beginning, the inner content to process; at the end, the
             * processed content.
             */
            let processed: string = innerContent;

            // Error handling: it shouldn't be possible for self-closing tags to
            // have non-empty inner content.
            if (selfClosing && innerContent) {
                log(
                    'error',
                    `Self-closing HTML tag "${tag}" should not have inner content.`,
                );
                return {
                    processed: outerContent ?? innerContent,
                };
            }

            // Get the configuration for the verbatim environment being
            // processed.
            const config = verbatimHandler._verbEnvs.get(tag);

            // Error handling: unknown verbatim environment.
            if (!config) {
                log('error', `Unknown verbatim environment "${tag}".`);
                return {
                    processed: outerContent ?? innerContent,
                };
            }

            const {
                type,
                defaultAttributes,
                respectSelfClosing,
                selfCloseOutputWith,
                transformations,
                component,
                attributeForwardingAllowlist,
                attributeForwardingBlocklist,
            } = config;

            const { pre, post } = transformations;

            // Merge default attributes with those provided ad hoc. Shallow
            // merge is enough, since the attribute values can't be objects.
            const mergedAttributes = { ...defaultAttributes, ...attributes };

            /**
             * Unescape options for the processed snippet.
             */
            let unescapeOptions: UnescapeOptions | undefined = {
                removeParagraphTag: !mergedAttributes['inline'],
            };

            // Apply pre-transformations
            processed = applyTransformations(processed, options, pre);

            /**
             * If we should wrap the output in a tag, or return a self-closing
             * tag, this will be the tag to use. If `component === 'this'`, this
             * will be the same as the input tag; if `component === 'none'`,
             * this will be `null`, which will indicate that we shouldn't wrap
             * the output in a tag.
             */
            const outputTag =
                component === 'this'
                    ? tag
                    : component === 'none'
                      ? null
                      : component;

            /**
             * Closing bracket for the opening tag of the output. If we're
             * expected to return a self-closing tag, this will be set to `'/>'`
             * or `' />'`; otherwise, it will be set to `'>'`.
             */
            let closingBracket: '>' | '/>' | ' />' = '>';

            // If we're supposed to return a self-closing tag, set the closing
            // bracket accordingly.
            if (selfClosing && respectSelfClosing) {
                if (selfCloseOutputWith === 'auto') {
                    // selfCloseOutputWith is 'auto', so we're expected to look
                    // at the (self-closing) input tag and check if there was
                    // whitespace before the closing slash.
                    const hadSpaceBeforeSlash =
                        !!outerContent?.match(/\s+\/>\s*$/);
                    closingBracket = hadSpaceBeforeSlash ? ' />' : '/>';
                } else {
                    // selfCloseOutputWith is one of: '/>', ' />'
                    closingBracket = selfCloseOutputWith;
                }
            }

            // Filter the attributes to only include those that are allowed by
            // the allowlist and not blocked by the blocklist. The filtered
            // attributes will be added to the output tag.
            const filteredMergedAttributes = Object.entries(
                mergedAttributes,
            ).filter(
                ([key]) =>
                    (attributeForwardingAllowlist === 'all' ||
                        attributeForwardingAllowlist.includes(key)) &&
                    !attributeForwardingBlocklist.includes(key),
            );

            /**
             * If we're supposed to...
             * - wrap the output, then this will be something like
             *   `<component>`.
             * - return a self-closing tag, then this will be something like
             *   `<component/>`.
             * - return the processed content without wrapping, then this will
             *   be `''`.
             */
            let outputTagOpen: '' | `<${string}${'' | '/' | ' /'}>` = '';

            /**
             * If we're supposed to...
             * - wrap the output, then this will be something like
             *   `</component>`.
             * - return a self-closing tag, then thiss will be `''`.
             * - return the processed content without wrapping, then this will
             *   be `''`.
             */
            let outputTagClose: '' | `</${string}>` = '';

            // If `outputTag` is truthy, it means that we're expected to return
            // either a self-closing tag, or to wrap the processed content with
            // a tag.
            if (outputTag) {
                outputTagOpen =
                    `<${outputTag}` +
                    (filteredMergedAttributes.length === 0 ? '' : ' ') +
                    filteredMergedAttributes
                        .map(
                            (attr) =>
                                `${attr[0]}${attr[1] === undefined ? '' : `="${String(attr[1])}"`}`,
                        )
                        .join(' ') +
                    closingBracket;

                if (!selfClosing || !respectSelfClosing) {
                    outputTagClose = `</${outputTag}>`;
                }
            }

            if (type === 'escapeOnly') {
                typeAssert(is<FullVerbEnvConfigEscapeOnly>(config));
                if (config.escapeInstructions.escapeHtml) {
                    processed = escapeHtml(processed);
                }
                // NB: It's important to escape braces _after_ escaping HTML, since
                // escaping braces will introduce ampersands which escapeHtml would
                // escape
                if (config.escapeInstructions.escapeBraces) {
                    processed = escapeBraces(processed);
                }
            } else if (type === 'code') {
                typeAssert(is<FullVerbEnvConfigCode>(config));
                const processedSnippet =
                    await verbatimHandler.codeHandler.process(processed, {
                        ...mergedAttributes,
                        _wrap:
                            selfClosing && respectSelfClosing
                                ? false
                                : config.wrap,
                    });
                processed = processedSnippet.processed;
                unescapeOptions = processedSnippet.unescapeOptions;
            } else if (type === 'advancedTex') {
                // Advanced TeX Content
                typeAssert(is<FullVerbEnvConfigAdvancedTex>(config));
                const res = await verbatimHandler.advancedTexHandler.process(
                    processed,
                    {
                        attributes: mergedAttributes,
                        tag,
                        filename: options.filename,
                        selfClosing,
                        outerContent,
                        config: config,
                    },
                );
                processed = res.processed;
                unescapeOptions = res.unescapeOptions ?? unescapeOptions;
            } else if (type === 'custom') {
                typeAssert(is<FullVerbEnvConfigCustom>(config));
                processed = config.customProcess(processed, mergedAttributes);
            } else {
                // type === 'noop'
                typeAssert(is<FullVerbEnvConfigNoop>(config));
            }

            processed = applyTransformations(processed, options, post);

            // If `component !== 'none'`, wrap the processed content in the
            // output tag, so that `processed` now stores the _outer_ content.
            if (outputTag) {
                processed =
                    selfClosing && respectSelfClosing
                        ? outputTagOpen
                        : outputTagOpen + processed + outputTagClose;
            }

            return { processed, unescapeOptions };
        };
        const configure = (
            _configuration: VerbatimConfiguration,
            verbatimHandler: VerbatimHandler<C, A>,
        ) => {
            const verbatimEnvironments = verbatimHandler._configuration;

            const verbEnvs = verbatimHandler._verbEnvs;
            const aliasMap = verbatimHandler._aliasMap;

            const validVerbatimEnvironments: [string, FullVerbEnvConfig][] =
                Object.entries(verbatimEnvironments)
                    .filter(
                        ([env, config]) =>
                            diagnoseVerbEnvConfig(config, env).errors === 0,
                    )
                    .map(([env, config]) => [
                        env,
                        mergeConfigs(
                            getDefaultVerbEnvConfig(config.type),
                            config,
                        ) as FullVerbEnvConfig,
                    ]);

            // Add "main" names of verbatim environments
            for (const [env, config] of validVerbatimEnvironments) {
                verbEnvs.set(env, config);
            }

            // Array to store duplicate aliases, for logging
            const duplicates: string[] = [];

            // Add aliases, and check for duplicates
            for (const [env, config] of validVerbatimEnvironments) {
                for (const alias of config.aliases) {
                    if (alias !== env) {
                        if (verbEnvs.has(alias)) {
                            duplicates.push(alias);
                        }
                        verbEnvs.set(alias, config);
                        aliasMap.set(alias, env);
                    }
                }
            }

            // Log error about duplicates, if present
            [...new Set(duplicates)].forEach((alias) => {
                log(
                    'error',
                    `Duplicate verbatim environment name/alias "${alias}".`,
                );
            });

            verbatimHandler._verbEnvs = verbEnvs;
        };
        return new VerbatimHandler<C, A>({
            process,
            configure,
            codeHandler,
            advancedTexHandler,
        });
    }

    private constructor({
        backend,
        processor,
        process,
        configure,
        configuration,
        codeHandler,
        advancedTexHandler,
    }: {
        backend?: 'verbatim' | undefined;
        process: ProcessFn<VerbatimProcessOptions, VerbatimHandler<C, A>>;
        processor?: Record<string, never> | undefined;
        configure?:
            | ConfigureFn<VerbatimConfiguration, VerbatimHandler<C, A>>
            | undefined;
        configuration?: FullVerbatimConfiguration | undefined;
        codeHandler: CodeHandler<C>;
        advancedTexHandler: AdvancedTexHandler<A>;
    }) {
        super({
            backend: backend ?? 'verbatim',
            configuration: configuration ?? {},
            process,
            processor: processor ?? {},
            configure,
        });
        this.codeHandler = codeHandler;
        this.advancedTexHandler = advancedTexHandler;
    }

    private _verbEnvs: Map<string, FullVerbEnvConfig> = new Map<
        string,
        FullVerbEnvConfig
    >();

    /**
     * Map from aliases to verbatim environment config name (i.e., map from
     * aliases to the key of the verbatim environment config within the
     * `verbatim` prop of the Sveltex config wherein the alias was defined in
     * the first place). If aliases conflict, the last one defined will take
     * precedence.
     */
    private _aliasMap: Map<string, string> = new Map<string, string>();

    /**
     * Verbatim environments.
     *
     * @remarks
     * Mutating this object won't have any effect on the
     * {@link _verbEnvs | `_verbEnvs`} property.
     */
    get verbEnvs(): Map<string, FullVerbEnvConfig> {
        return deepClone(this._verbEnvs);
    }
}
