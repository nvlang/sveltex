// File description: Type guards some of the types defined in
// [`Code.ts`](src/types/utils/Code.ts).

// Types
import type { Equals, Extends } from '$deps.js';

// Internal dependencies
import { isOneOf, isString } from '$typeGuards/utils.js';
import type { CodeBackend, CodeBackendWithCss } from '$types/handlers/Code.js';
import type { SupportedCdn } from '$types/handlers/Css.js';
import {
    type HighlightJsThemeName,
    type StarryNightThemeName,
    highlightJsThemeNames,
    starryNightThemeNames,
} from '$data/code.js';

// External dependencies
import { typeAssert } from '$deps.js';

export function isCodeBackendWithCss(
    input: unknown,
): input is CodeBackendWithCss {
    return (
        isString(input) &&
        codeBackendsWithCss.includes(input as CodeBackendWithCss)
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

typeAssert<Equals<CodeBackendWithCss, (typeof codeBackendsWithCss)[number]>>();
typeAssert<Extends<CodeBackendWithCss, CodeBackend>>();
typeAssert<Equals<SupportedCdn, (typeof supportedCdns)[number]>>();

export const codeBackendsWithCss = ['highlight.js', 'starry-night'] as const;

export const supportedCdns = ['jsdelivr', 'esm.sh', 'unpkg', 'cdnjs'] as const;
