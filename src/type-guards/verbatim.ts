// Types
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type {
    SimpleEscapeInstruction,
    VerbatimType,
} from '$types/handlers/Verbatim.js';
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type { DvisvgmOptions } from '$types/utils/DvisvgmOptions.js';

// Internal dependencies
import {
    ifPresentAndDefined,
    isBoolean,
    isNonNullObject,
    isOneOf,
    isString,
    isStringArray,
} from '$type-guards/utils.js';

// External dependencies
import { Equals, typeAssert } from '$deps.js';

export const supportedTexEngines = [
    'lualatex',
    'lualatexmk',
    'pdflatex',
    'pdflatexmk',
    'xelatex',
    // 'xelatexmk',
] as const;

typeAssert<Equals<(typeof supportedTexEngines)[number], SupportedTexEngine>>();

export function isSupportedTexEngine(x: unknown): x is SupportedTexEngine {
    return isOneOf(x, supportedTexEngines);
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

export const verbatimTypes = ['tex', 'code', 'escapeOnly', 'noop'] as const;

// Ensure we didnt miss any Verbatim type
typeAssert<Equals<(typeof verbatimTypes)[number], VerbatimType>>();

export function isVerbatimType(x: unknown): x is VerbatimType {
    return isString(x) && isOneOf(x, verbatimTypes);
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
