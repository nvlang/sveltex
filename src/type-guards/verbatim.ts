import { isNonNullObject, isString } from '$src/type-guards/utils.js';
import type {
    SimpleEscapeInstruction,
    TexComponentConfig,
    TexLiveConfig,
    VerbatimEnvironmentCode,
    VerbatimProcessInner,
} from '$types';

export function isTexComponentConfig(x: unknown): x is TexComponentConfig {
    return isNonNullObject(x) && 'name' in x && isString(x.name);
}

export function isTexLiveConfig(x: unknown): x is TexLiveConfig {
    return isNonNullObject(x);
}

export function isVerbatimEnvironmentCode(
    x: unknown,
): x is VerbatimEnvironmentCode {
    return (
        isVerbatimProcessInner(x) ||
        (isNonNullObject(x) &&
            'processInner' in x &&
            isVerbatimProcessInner(x.processInner))
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
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'escapeBraces' in obj &&
        'escapeHtml' in obj &&
        (obj.escapeBraces === undefined ||
            typeof obj.escapeBraces === 'boolean') &&
        (obj.escapeHtml === undefined || typeof obj.escapeHtml === 'boolean')
    );
}
