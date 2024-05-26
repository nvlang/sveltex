// Types
import type { Equals, Extends } from '$deps.js';

// Internal dependencies
import { isOneOf, isString } from '$type-guards/utils.js';
import { CodeBackend, ThemableCodeBackend } from '$types/handlers/Code.js';
import { SupportedCdn } from '$types/handlers/misc.js';
import {
    HighlightJsThemeName,
    StarryNightThemeName,
    highlightJsThemeNames,
    starryNightThemeNames,
} from '$data/code.js';

// External dependencies
import { typeAssert } from '$deps.js';

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

typeAssert<
    Equals<ThemableCodeBackend, (typeof themableCodeBackends)[number]>
>();
typeAssert<Extends<ThemableCodeBackend, CodeBackend>>();
typeAssert<Equals<SupportedCdn, (typeof supportedCdns)[number]>>();

export const themableCodeBackends = ['highlight.js', 'starry-night'] as const;

export const supportedCdns = ['jsdelivr', 'esm.sh', 'unpkg'] as const;
