// Types
import type { Equals, Extends } from '$deps.js';

// Internal dependencies
import { isOneOf, isString } from '$type-guards/utils.js';
import { CodeBackend, ThemableCodeBackend } from '$types/handlers/Code.js';
import {
    HighlightJsThemeName,
    StarryNightThemeName,
    SupportedCdn,
} from '$types/handlers/misc.js';
import { highlightJsThemeNames, starryNightThemeNames } from '$data/code.js';

// External dependencies
import { assert } from '$deps.js';

export function isThemableCodeBackend(
    input: unknown,
): input is ThemableCodeBackend {
    return (
        isString(input) &&
        themableCodeBackends.includes(input as ThemableCodeBackend)
    );
}

export function isSupportedCdn(input: unknown): input is SupportedCdn {
    return isString(input) && isOneOf(input, supportedCdns);
}

export function isStarryNightThemeName(
    input: unknown,
): input is StarryNightThemeName {
    return isString(input) && isOneOf(input, starryNightThemeNames);
}

export function isHighlightJsThemeName(
    input: unknown,
): input is HighlightJsThemeName {
    return isString(input) && isOneOf(input, highlightJsThemeNames);
}

assert<Equals<CodeBackend, (typeof codeBackends)[number]>>();
assert<Equals<ThemableCodeBackend, (typeof themableCodeBackends)[number]>>();
assert<Extends<ThemableCodeBackend, CodeBackend>>();
assert<Equals<SupportedCdn, (typeof supportedCdns)[number]>>();

export const codeBackends = [
    'escapeOnly',
    'highlight.js',
    'starry-night',
    'none',
    'custom',
    'prismjs',
] as const;
export const themableCodeBackends = ['highlight.js', 'starry-night'] as const;

export const supportedCdns = ['jsdelivr', 'esm.sh', 'unpkg'] as const;
