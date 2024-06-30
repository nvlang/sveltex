// File description: Diagnoser for `TexConfiguration` type.

// Internal dependencies
import { getDefaultTexConfig } from '$base/defaults.js';
import { isRegExp } from '$deps.js';
import {
    isArray,
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
    isString,
    isStringArray,
} from '$typeGuards/utils.js';
import {
    isCliInstruction,
    isSupportedTexEngine,
    supportedTexEngines,
} from '$typeGuards/verbatim.js';
import { extendedLogSeverities } from '$utils/TexComponent.js';
import { Diagnoser, enquote } from '$utils/diagnosers/Diagnoser.js';

/**
 * Diagnose whether a given object is a valid TeX live configuration.
 *
 * @param x - The object to diagnose.
 * @returns Diagnoser object.
 */
export function diagnoseTexConfig(x: object): Diagnoser {
    const d = new Diagnoser(x);

    // Caching options
    d.ifPresent('caching.enabled', 'a boolean', isBoolean, 'boolean');
    d.ifPresent('caching.cacheDirectory', 'a string', isString, 'string');

    // Compilation options
    d.ifPresent(
        'compilation.shellEscape',
        `a boolean or "restricted"`,
        (v) => isBoolean(v) || v === 'restricted',
        ['boolean', 'string'],
    );
    d.ifPresent('compilation.saferLua', 'a boolean', isBoolean, 'boolean');
    d.ifPresent(
        'compilation.intermediateFiletype',
        'either "pdf" or "dvi"',
        (v) => isOneOf(v, ['pdf', 'dvi']),
        'string',
    );
    d.ifPresent(
        'compilation.overrideCompilation',
        'a CliInstruction object or null',
        (v) => isCliInstruction(v) || v === null,
        ['object', 'null'],
    );
    d.ifPresent(
        'compilation.overrideCompilation.args',
        'an array of strings',
        isStringArray,
        'object',
    );
    d.ifPresent(
        'compilation.overrideCompilation.env',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent(
        'compilation.overrideCompilation.silent',
        'a boolean',
        isBoolean,
        'boolean',
    );
    d.ifPresent(
        'compilation.engine',
        `one of: ${supportedTexEngines.map(enquote).join(', ')}`,
        isSupportedTexEngine,
        'string',
    );

    // Optimization options
    d.ifPresent(
        'optimization.currentColor',
        'a string in the format "#rgb" or "#rrggbb"',
        (v) => isString(v) && /^#[0-9a-f]{3,8}$/i.test(v),
        'string',
    );
    d.ifPresent(
        'optimization.overrideOptimization',
        'a function (svg: string, tc: TexComponent<A>) => string or null',
        (v) => isFunction(v) || v === null,
        ['function', 'null'],
    );
    d.ifPresent(
        'optimization.svgo',
        'a non-null object',
        isNonNullObject,
        'object',
    );

    // Conversion options
    d.ifPresent('conversion', 'a non-null object', isNonNullObject, 'object');
    d.ifPresent(
        'conversion.converter',
        'one of: "dvisvgm", "poppler"',
        (v) => v === 'dvisvgm' || v === 'poppler',
        'string',
    );
    d.ifPresent(
        'conversion.dvisvgm',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent(
        'conversion.poppler',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent('conversion.outputDirectory', 'a string', isString, 'string');
    d.ifPresent(
        'conversion.overrideConversion',
        'a CliInstruction object or null',
        (v) => isCliInstruction(v) || v === null,
        ['object', 'null'],
    );
    d.ifPresent(
        'conversion.overrideConversion.args',
        'an array of strings',
        isStringArray,
        'object',
    );
    d.ifPresent(
        'conversion.overrideConversion.env',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent(
        'conversion.overrideConversion.silent',
        'a boolean',
        isBoolean,
        'boolean',
    );

    // Debug options
    d.ifPresent(
        'debug.ignoreLogMessages',
        'an array of strings or regular expressions',
        (v) => isArray(v, (elem) => isString(elem) || isRegExp(elem)),
        'object',
    );
    d.ifPresent(
        'debug.verbosity',
        `a non-null object or one of: ${extendedLogSeverities.map(enquote).join(', ')}`,
        (v) => isNonNullObject(v) || isOneOf(v, extendedLogSeverities),
        ['object', 'string'],
    );
    d.ifPresent(
        'debug.verbosity.onFailure',
        `one of: ${extendedLogSeverities.map(enquote).join(', ')}`,
        (v) => isOneOf(v, extendedLogSeverities),
        'string',
    );
    const logSeveritiesWithoutError = extendedLogSeverities.filter(
        (s) => s !== 'error',
    );
    d.ifPresent(
        'debug.verbosity.onSuccess',
        `one of: ${logSeveritiesWithoutError.map(enquote).join(', ')}`,
        (v) => isOneOf(v, logSeveritiesWithoutError),
        'string',
    );

    d.noteUnexpectedProperties(Object.keys(getDefaultTexConfig()));
    return d;
}
