// Types
import type {
    AdvancedTexBackend,
    CliInstruction,
    DvisvgmOptions,
    SimpleEscapeInstruction,
    SupportedTexEngine,
    TexComponentConfiguration,
    TexLiveConfiguration,
    VerbatimEnvironmentConfiguration,
    VerbatimProcessInner,
} from '$types';

// Internal dependencies
import {
    ifPresentAndDefined,
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
    isString,
    isStringArray,
} from '$type-guards/utils.js';

export function isTexComponentConfig(
    config: unknown,
): config is TexComponentConfiguration<AdvancedTexBackend> {
    return (
        isNonNullObject(config) &&
        ifPresentAndDefined(config, 'documentClass', isString) &&
        ifPresentAndDefined(config, 'preamble', isString) &&
        ifPresentAndDefined(config, 'overrides', isTexLiveConfig) &&
        ifPresentAndDefined(config, 'aliases', isStringArray) &&
        ifPresentAndDefined(config, 'handleAttributes', isFunction)
    );
}

export function isTexLiveConfig(x: unknown): x is TexLiveConfiguration {
    return (
        isNonNullObject(x) &&
        ifPresentAndDefined(
            x,
            'shellEscape',
            (v) => isBoolean(v) || v === 'restricted',
        ) &&
        ifPresentAndDefined(x, 'saferLua', isBoolean) &&
        ifPresentAndDefined(x, 'intermediateFiletype', (v) =>
            isOneOf(v, ['pdf', 'dvi']),
        ) &&
        ifPresentAndDefined(
            x,
            'overrideCompilationCommand',
            isCliInstruction,
        ) &&
        ifPresentAndDefined(x, 'overrideConversionCommand', isCliInstruction) &&
        ifPresentAndDefined(x, 'cacheDirectory', isString) &&
        ifPresentAndDefined(x, 'caching', isBoolean) &&
        ifPresentAndDefined(x, 'dvisvgmOptions', isDvisvgmOptions) &&
        ifPresentAndDefined(x, 'verbose', isBoolean) &&
        ifPresentAndDefined(x, 'outputDirectory', isString) &&
        ifPresentAndDefined(x, 'texEngine', isSupportedTexEngine)
    );
}

export function isSupportedTexEngine(x: unknown): x is SupportedTexEngine {
    return isOneOf(x, ['pdflatex', 'lualatex', 'lualatexmk', 'tex', 'latexmk']);
}

export function isDvisvgmOptions(x: unknown): x is DvisvgmOptions {
    return isNonNullObject(x);
}

export function isCliInstruction(x: unknown): x is CliInstruction {
    return (
        isNonNullObject(x) &&
        'command' in x &&
        isString(x.command) &&
        ifPresentAndDefined(x, 'args', isStringArray) &&
        ifPresentAndDefined(x, 'env', isNonNullObject) &&
        ifPresentAndDefined(x, 'silent', isBoolean)
    );
}

export function isVerbatimEnvironmentConfiguration(
    x: unknown,
): x is VerbatimEnvironmentConfiguration {
    return (
        isNonNullObject(x) &&
        ifPresentAndDefined(x, 'processInner', isVerbatimProcessInner) &&
        ifPresentAndDefined(x, 'defaultAttributes', isNonNullObject) &&
        ifPresentAndDefined(x, 'attributeForwardingBlocklist', isStringArray) &&
        ifPresentAndDefined(
            x,
            'attributeForwardingAllowlist',
            (v) => isStringArray(v) || v === 'all',
        ) &&
        ifPresentAndDefined(x, 'component', isString) &&
        ifPresentAndDefined(x, 'respectSelfClosing', isBoolean) &&
        ifPresentAndDefined(x, 'selfCloseOutputWith', (v) =>
            isOneOf(v, ['auto', '/>', ' />']),
        )
    );
}

export function isVerbatimProcessInner(x: unknown): x is VerbatimProcessInner {
    return (
        x !== undefined &&
        x !== null &&
        (x === 'code' ||
            x === 'noop' ||
            isSimpleEscapeInstruction(x) ||
            typeof x === 'function')
    );
}

export function isSimpleEscapeInstruction(
    obj: unknown,
): obj is SimpleEscapeInstruction {
    if (!isNonNullObject(obj)) {
        return false;
    }
    if (
        'escapeBraces' in obj &&
        obj.escapeBraces !== undefined &&
        typeof obj.escapeBraces !== 'boolean'
    ) {
        return false;
    }
    if (
        'escapeHtml' in obj &&
        obj.escapeHtml !== undefined &&
        typeof obj.escapeHtml !== 'boolean'
    ) {
        return false;
    }
    return true;
}
