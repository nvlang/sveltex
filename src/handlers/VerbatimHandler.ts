// NOTE: Some lines in this file are excluding from coverage. This is because
// they should be technically unreachable. At the same time, I don't want to
// remove them because I want to keep type assertions to a minimum.

// Types
import type {
    AdvancedTexBackend,
    CodeBackend,
    FullSveltexConfig,
    MarkdownBackend,
    TexBackend,
    VerbatimEnvironmentCode,
} from '$types';
import type { Sveltex } from '$processor';

// Internal dependencies
import {
    isSimpleEscapeInstruction,
    isVerbatimEnvironmentCode,
} from '$type-guards';
import { escapeBraces } from '$processor/escape.js';
import { re } from '$processor/utils.js';

// External dependencies
import { escape as escapeHtml } from 'html-escaper';
import { AdvancedTexHandler, CodeHandler } from '$handlers';
import { log } from '$src/utils/log.js';

/**
 * Handler for verbatim environments.
 */
export class VerbatimHandler<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
> {
    private readonly tagRegExp = re`
        ^ < \s*
        ( [a-zA-Z] [a-zA-Z0-9_-]* )         # $1: tag name
        (                                   # $2: attributes
            (?:
                \s*
                [a-zA-Z] [a-zA-Z0-9_-]*     # attribute name
                \s* = \s*
                " [^"\r\n]*? "              # attribute value
                \s*
            )*
        )
        \s* >
        (?:\r\n?|\n)?                       # optional newline
    `;

    private readonly codeHandler: CodeHandler<C>;
    private readonly advancedTexHandler: AdvancedTexHandler<A>;
    private readonly sveltexConfiguration: FullSveltexConfig<M, C, T, A>;

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
    readonly process = async (
        content: string,
        options: { filename: string },
    ) => {
        const matchArray = content.match(this.tagRegExp);
        if (!matchArray) {
            log('error')(
                `Unexpected verbatim environment encountered: "${content}".`,
            );
            return content;
        }
        const tag = matchArray[1];
        const attributesString = matchArray[2];

        /* v8 ignore next 4 */
        if (tag === undefined) {
            log('error')(`Unknown verbatim environment "${String(tag)}".`);
            return content;
        }

        const closingTagRegExp = new RegExp(
            '(?:\r\n?|\n)?[ \t]*</\\s*' + tag + '\\s*>\\s*$',
        );

        const innerContent = content
            .slice(matchArray[0].length)
            .replace(closingTagRegExp, '');

        const isVerbEnv = this._verbEnvs.has(tag);
        const isAdvancedTexComponent = this.advancedTexHandler.tccMap.has(tag);

        if (!isVerbEnv && !isAdvancedTexComponent) {
            log('error')(`Unknown verbatim environment "${tag}".`);
            return content;
        }

        if (isVerbEnv && isAdvancedTexComponent) {
            log('error')(
                `HTML tag "${tag}" is ambiguous, as it refers to both a verbatim environment and an advanced TeX component.`,
            );
            return content;
        }

        let config;
        if (isVerbEnv) {
            config = this._verbEnvs.get(tag);
        } else {
            config = this.advancedTexHandler.tccMap.get(tag);
        }

        /* v8 ignore next 6 */
        if (!config) {
            log('error')(`Unknown verbatim environment "${tag}".`);
            return content;
        }

        const defaultAttributes: object =
            typeof config === 'object' && 'defaultAttributes' in config
                ? config.defaultAttributes ?? {}
                : {};

        const attributes: Record<string, string> = {};

        if (attributesString) {
            const attributesArray = attributesString.match(
                /[a-zA-Z][a-zA-Z0-9_-]*\s*=\s*"[^"\r\n]*"/g,
            );
            if (attributesArray) {
                attributesArray.forEach((attr) => {
                    const [name, value] = attr.split('=');
                    /* v8 ignore next */
                    if (name === undefined || value === undefined) return;
                    attributes[name.trim()] = value.trim().slice(1, -1);
                });
            }
        }

        const mergedAttributes = {
            ...defaultAttributes,
            ...attributes,
        };

        if (isAdvancedTexComponent) {
            if (this.advancedTexHandler.backendIsNot('none')) {
                return this.advancedTexHandler.process(innerContent, {
                    attributes: mergedAttributes,
                    name: tag,
                    ref: mergedAttributes['ref'],
                    filename: options.filename,
                });
            }
            log('error')(
                'Advanced TeX components are not supported when advanced TeX backend is set to "none".',
            );
            return content;
        }

        if (!isVerbatimEnvironmentCode(config)) {
            log('error')(
                `Invalid verbatim environment configuration for "${tag}".`,
            );
            return content;
        }

        // isVerbEnv === true

        const processInner =
            typeof config === 'object' && 'processInner' in config
                ? config.processInner
                : config;

        const component =
            typeof config === 'object' && 'component' in config
                ? config.component
                : tag;

        const returnComponentOpen =
            `<${component}` +
            (Object.entries(mergedAttributes).length === 0 ? '' : ' ') +
            Object.entries(mergedAttributes)
                .map((attr) => `${attr[0]}="${attr[1]}"`)
                .join(' ') +
            '>';
        let processedInner: string = innerContent;
        const returnComponentClose = `</${component}>`;

        // Simple escape instruction
        const simpleEscapeInstruction = isSimpleEscapeInstruction(config)
            ? config
            : typeof config === 'object' &&
                isSimpleEscapeInstruction(config.processInner)
              ? config.processInner
              : undefined;

        if (simpleEscapeInstruction) {
            let escaped = innerContent;
            if (simpleEscapeInstruction.escapeHtml) {
                escaped = escapeHtml(escaped);
            }
            // NB: It's important to escape braces _after_ escaping HTML, since
            // escaping braces will introduce ampersands which escapeHtml would
            // escape
            if (simpleEscapeInstruction.escapeBraces) {
                escaped = escapeBraces(escaped);
            }
            processedInner = escaped;
        } else if (typeof processInner === 'string') {
            if (processInner === 'code') {
                processedInner = await this.codeHandler.process(
                    innerContent,
                    mergedAttributes,
                );
            }
            if (processInner === 'noop') {
                processedInner = innerContent;
            }
        } else if (typeof processInner === 'function') {
            processedInner = processInner(innerContent, mergedAttributes);
        }
        return [returnComponentOpen, processedInner, returnComponentClose].join(
            '\n',
        );
    };

    constructor(sveltex: Sveltex<M, C, T, A>) {
        this.codeHandler = sveltex.codeHandler;
        this.advancedTexHandler = sveltex.advancedTexHandler;
        this.sveltexConfiguration = sveltex.configuration;
        this.verbEnvs = this.sveltexConfiguration.general.verbatimEnvironments;
    }

    private _verbEnvs: Map<string, VerbatimEnvironmentCode> = new Map<
        string,
        VerbatimEnvironmentCode
    >();

    set verbEnvs(
        verbatimEnvironments:
            | Record<string, VerbatimEnvironmentCode>
            | undefined,
    ) {
        if (verbatimEnvironments === undefined) return;

        const verbEnvs = new Map<string, VerbatimEnvironmentCode>();

        // Add "main" names of verbatim environments
        for (const [env, desc] of Object.entries(verbatimEnvironments)) {
            verbEnvs.set(env, desc);
        }

        // Array to store duplicate aliases, for logging
        const duplicates: string[] = [];

        // Add aliases, and check for duplicates
        for (const [env, desc] of Object.entries(verbatimEnvironments)) {
            if (typeof desc === 'object' && 'aliases' in desc) {
                for (const alias of desc.aliases) {
                    if (alias !== env) {
                        if (verbEnvs.has(alias)) {
                            duplicates.push(alias);
                        }
                        verbEnvs.set(alias, desc);
                    }
                }
            }
        }

        // Log error about duplicates, if present
        [...new Set(duplicates)].forEach((alias) => {
            log('error')(
                `Duplicate verbatim environment name/alias "${alias}".`,
            );
        });

        this._verbEnvs = verbEnvs;
    }
}
