// File description: Diagnoser for `CodeConfiguration` type.

// Types
import type { CodeBackend } from '$types/handlers/Code.js';

// Internal dependencies
import { highlightJsThemeNames, starryNightThemeNames } from '$data/code.js';
import {
    isHighlightJsThemeName,
    isStarryNightThemeName,
    isSupportedCdn,
    isCodeBackendWithCss,
    supportedCdns,
    codeBackendsWithCss,
} from '$typeGuards/code.js';
import {
    isArray,
    isBoolean,
    isNonNullObject,
    isNumber,
    isOneOf,
    isPresentAndDefined,
    isString,
} from '$typeGuards/utils.js';
import { log } from '$utils/debug.js';
import {
    checkTransformers,
    Diagnoser,
    enquote,
    insteadGot,
} from '$utils/diagnosers/Diagnoser.js';

// External dependencies
import { nodeAssert } from '$deps.js';

export function diagnoseCodeConfiguration(
    backend: CodeBackend,
    x: unknown,
): { errors: number; warnings: number; problems: number } {
    if (!isNonNullObject(x)) {
        log(
            'error',
            `Expected configuration to be non-null object. ${insteadGot(x)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }
    const d = new Diagnoser(x);
    d.ifPresent(
        'addLanguageClass',
        'a string or boolean',
        (v) => isString(v) || isBoolean(v),
        ['string', 'boolean'],
    );
    checkTransformers(d);
    if (isPresentAndDefined(x, 'theme')) {
        if (isCodeBackendWithCss(backend)) {
            nodeAssert('theme' in x);
            if (!isNonNullObject(x.theme)) {
                d.addProblem(
                    `Expected "theme" to be non-null object. ${insteadGot(x, 'object')}`,
                );
            } else {
                d.ifPresent(
                    'theme.cdn',
                    `one of (or an array of) the following: "${supportedCdns.join('", "')}"`,
                    (v) => isSupportedCdn(v) || isArray(v, isSupportedCdn),
                );
                d.ifPresent(
                    'theme.timeout',
                    'a positive number (timeout in milliseconds)',
                    (n) => isNumber(n) && n > 0,
                    'number',
                );
                d.ifPresent('theme.read', 'a boolean', isBoolean);
                d.ifPresent('theme.write', 'a boolean', isBoolean);
                d.ifPresent('theme.dir', 'a string', isString);
                if (backend === 'highlight.js') {
                    d.ifPresent(
                        'theme.name',
                        `a supported highlight.js theme, i.e., one of: "${highlightJsThemeNames.join('", "')}"`,
                        isHighlightJsThemeName,
                        'string',
                    );
                    d.ifPresent('theme.min', 'a boolean', isBoolean);
                } else {
                    d.ifPresent(
                        'theme.name',
                        `a supported starry-night theme, i.e., one of: "${starryNightThemeNames.join('", "')}"`,
                        isStarryNightThemeName,
                        'string',
                    );
                    d.ifPresent(
                        'theme.mode',
                        'one of: "light", "dark", "both"',
                        (v) => isOneOf(v, ['light', 'dark', 'both']),
                        'string',
                    );
                }
            }
        } else if (backend === 'shiki') {
            d.addProblem(
                `The "theme" property is intended for the following backends: ${codeBackendsWithCss.map(enquote).join(', ')}. If you want to set the theme using the "shiki" backend, you can do so in the "shiki.theme" property of the code configuration instead.`,
                'warn',
            );
        } else {
            d.addProblem(
                `The "theme" property is not supported for the "${backend}" backend. Supported backends: ${codeBackendsWithCss.map(enquote).join(', ')}.`,
                'warn',
            );
        }
    }
    d.printProblems();
    return d.stats;
}
