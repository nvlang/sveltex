// NOTE: Some lines in this file are excluding from coverage. This is because
// they should be technically unreachable. At the same time, I don't want to
// remove them because I want to keep type assertions to a minimum.

// Types
import type { AdvancedTexBackend } from '$types/handlers/AdvancedTex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { ConfigureFn, ProcessFn } from '$types/handlers/Handler.js';
import type {
    FullVerbatimConfiguration,
    FullVerbatimEnvironmentConfiguration,
    VerbatimConfiguration,
    VerbatimProcessOptions,
} from '$types/handlers/Verbatim.js';

// Internal dependencies
import { getDefaultVerbatimEnvironmentConfiguration } from '$config/defaults.js';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { Handler } from '$handlers/Handler.js';
import { isSimpleEscapeInstruction } from '$type-guards/verbatim.js';
import { log, prettifyError } from '$utils/debug.js';
import { diagnoseVerbatimEnvironmentConfiguration } from '$utils/diagnosers/verbatimEnvironmentConfiguration.js';
import { escapeBraces } from '$utils/escape.js';
import { mergeConfigs } from '$utils/merge.js';
import { interpretAttributes } from '$utils/misc.js';
import { parseComponent } from '$utils/parseComponent.js';

// External dependencies
import { escapeHtml, nodeAssert, rfdc } from '$deps.js';

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
    // private readonly sveltexConfiguration: FullSveltexConfiguration< C, A>;

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
            content: string,
            options: VerbatimProcessOptions,
            verbatimHandler: VerbatimHandler<C, A>,
        ) => {
            try {
                const {
                    tag,
                    attributes,
                    content: innerContent,
                    selfClosing,
                } = parseComponent(content);

                if (selfClosing && innerContent !== undefined) {
                    log(
                        'error',
                        `Self-closing HTML tag "${tag}" should not have content.`,
                    );
                    return content;
                }

                if (!selfClosing && innerContent === undefined) {
                    log(
                        'error',
                        `HTML tag "${tag}" should have content, but none was found.`,
                    );
                    return content;
                }

                const isVerbEnv = verbatimHandler.verbEnvs.has(tag);
                const isAdvancedTexComponent =
                    verbatimHandler.advancedTexHandler.tccMap.has(tag);

                if (!isVerbEnv && !isAdvancedTexComponent) {
                    log('error', `Unknown verbatim environment "${tag}".`);
                    return content;
                }

                if (isVerbEnv && isAdvancedTexComponent) {
                    log(
                        'error',
                        `HTML tag "${tag}" is ambiguous, as it refers to both a verbatim environment and an advanced TeX component.`,
                    );
                    return content;
                }

                if (isVerbEnv) {
                    const config = verbatimHandler.verbEnvs.get(tag);
                    nodeAssert(config !== undefined);

                    const defaultAttributes: Record<
                        string,
                        string | boolean | number | null | undefined
                    > = config.defaultAttributes;

                    const mergedAttributes = {
                        ...defaultAttributes,
                        ...attributes,
                    };

                    const fullConfig = mergeConfigs(
                        getDefaultVerbatimEnvironmentConfiguration(),
                        config,
                    );

                    // isVerbEnv === true

                    const processInner = fullConfig.processInner;

                    const component = fullConfig.component ?? tag;

                    let closingBracket = '>';
                    if (selfClosing && fullConfig.respectSelfClosing) {
                        if (fullConfig.selfCloseOutputWith === 'auto') {
                            closingBracket = `${content.match(/\s+\/>\s*$/) ? ' ' : ''}/>`;
                        } else {
                            closingBracket = fullConfig.selfCloseOutputWith;
                        }
                    }

                    const filteredMergedAttributes = Object.entries(
                        mergedAttributes,
                    ).filter(
                        ([key]) =>
                            (fullConfig.attributeForwardingAllowlist ===
                                'all' ||
                                fullConfig.attributeForwardingAllowlist.includes(
                                    key,
                                )) &&
                            !fullConfig.attributeForwardingBlocklist.includes(
                                key,
                            ),
                    );

                    const returnComponentOpen =
                        `<${component}` +
                        (filteredMergedAttributes.length === 0 ? '' : ' ') +
                        filteredMergedAttributes
                            .map(
                                (attr) =>
                                    `${attr[0]}${attr[1] === undefined ? '' : `="${String(attr[1])}"`}`,
                            )
                            .join(' ') +
                        closingBracket;

                    if (selfClosing || innerContent === undefined) {
                        return returnComponentOpen;
                    }

                    let processedInner: string = innerContent;
                    const returnComponentClose = `</${component}>`;

                    if (isSimpleEscapeInstruction(fullConfig.processInner)) {
                        let escaped = innerContent;
                        if (fullConfig.processInner.escapeHtml) {
                            escaped = escapeHtml(escaped);
                        }
                        // NB: It's important to escape braces _after_ escaping HTML, since
                        // escaping braces will introduce ampersands which escapeHtml would
                        // escape
                        if (fullConfig.processInner.escapeBraces) {
                            escaped = escapeBraces(escaped);
                        }
                        processedInner = escaped;
                    } else if (typeof processInner === 'string') {
                        if (processInner === 'code') {
                            processedInner =
                                await verbatimHandler.codeHandler.process(
                                    innerContent,
                                    {
                                        ...interpretAttributes(
                                            mergedAttributes,
                                        ),
                                        _wrap: config.wrap,
                                    },
                                );
                        }
                        if (processInner === 'noop') {
                            processedInner = innerContent;
                        }
                    } else if (typeof processInner === 'function') {
                        processedInner = processInner(
                            innerContent,
                            mergedAttributes,
                        );
                    }

                    return [
                        returnComponentOpen,
                        processedInner,
                        returnComponentClose,
                    ].join('');
                } else {
                    return verbatimHandler.advancedTexHandler.process(
                        innerContent ?? '',
                        {
                            attributes,
                            tag,
                            filename: options.filename,
                            selfClosing,
                        },
                    );
                }
            } catch (err) {
                log('error', prettifyError(err));
                return content;
            }
        };
        const configure = (
            _configuration: VerbatimConfiguration,
            verbatimHandler: VerbatimHandler<C, A>,
        ) => {
            const { verbatimEnvironments } = verbatimHandler.configuration;
            const defaultVerbatimEnvironmentConfiguration =
                getDefaultVerbatimEnvironmentConfiguration();

            const verbEnvs = verbatimHandler._verbEnvs;

            const validVerbatimEnvironments: [
                string,
                FullVerbatimEnvironmentConfiguration,
            ][] = Object.entries(verbatimEnvironments)
                .filter(([env, config]) => {
                    const diagnosis =
                        diagnoseVerbatimEnvironmentConfiguration(config);
                    if (diagnosis.isVerbatimEnvironmentConfiguration) {
                        return true;
                    } else {
                        log(
                            'error',
                            `Invalid verbatim environment configuration for "${env}":\n${diagnosis.reasonsForFailure.map((s) => `- ${s}`).join('\n')}\n`,
                        );
                        return false;
                    }
                })
                .map(([env, config]) => [
                    env,
                    mergeConfigs(
                        defaultVerbatimEnvironmentConfiguration,
                        config,
                    ),
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
            configuration: configuration ?? { verbatimEnvironments: {} },
            process,
            processor: processor ?? {},
            configure,
        });
        this.codeHandler = codeHandler;
        this.advancedTexHandler = advancedTexHandler;
    }

    private _verbEnvs: Map<string, FullVerbatimEnvironmentConfiguration> =
        new Map<string, FullVerbatimEnvironmentConfiguration>();

    /**
     * Verbatim environments.
     *
     * @remarks
     * Mutating this object won't have any effect on the
     * {@link _verbEnvs | `_verbEnvs`} property.
     */
    get verbEnvs(): Map<string, FullVerbatimEnvironmentConfiguration> {
        return deepClone(this._verbEnvs);
    }
}
