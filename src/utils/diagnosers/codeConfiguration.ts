// Types
import type { CodeBackend } from '$types/handlers/Code.js';

// Internal dependencies
import { highlightJsThemeNames, starryNightThemeNames } from '$data/code.js';
import {
    isHighlightJsThemeName,
    isStarryNightThemeName,
    isSupportedCdn,
    isThemableCodeBackend,
    supportedCdns,
    themableCodeBackends,
} from '$type-guards/code.js';
import {
    isArray,
    isBoolean,
    isFunction,
    isNonNullObject,
    isNumber,
    isOneOf,
    isPresentAndDefined,
    isString,
} from '$type-guards/utils.js';
import { log } from '$utils/debug.js';
import { Diagnoser, insteadGot } from '$utils/diagnosers/Diagnoser.js';

// External dependencies
import { nodeAssert } from '$deps.js';

export function diagnoseCodeConfiguration(backend: CodeBackend, x: unknown) {
    if (!isNonNullObject(x)) {
        log(
            'error',
            `Expected configuration to be non-null object. ${insteadGot(x)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }
    const d = new Diagnoser(x);
    d.ifPresent('wrapClassPrefix', 'a string', isString);
    d.ifPresent(
        'wrap',
        'a function (options) => [string, string]',
        isFunction,
        'function',
    );
    if (isPresentAndDefined(x, 'theme')) {
        if (isThemableCodeBackend(backend)) {
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
        } else {
            d.addProblem(
                `The "theme" property is not supported for the "${backend}" backend. Supported backends: "${themableCodeBackends.join('", "')}".`,
                'warn',
            );
        }
    }
    // console.log(`printing ${String(d.stats.problems)} problems`);
    d.printProblems();
    return d.stats;
}
