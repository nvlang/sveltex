// Internal dependencies
import { getDefaultTexConfig } from '$config/defaults.js';
import {
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
    isString,
    isStringArray,
} from '$type-guards/utils.js';
import {
    isCliInstruction,
    isSupportedTexEngine,
    supportedTexEngines,
} from '$type-guards/verbatim.js';
import { Diagnoser, enquote } from '$utils/diagnosers/Diagnoser.js';

/**
 * Diagnose whether a given object is a valid TeX live configuration.
 *
 * @param x - The object to diagnose.
 * @returns Diagnoser object.
 */
export function diagnoseTexConfig(x: object) {
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
    d.ifPresent('debug.verbose', 'a boolean', isBoolean, 'boolean');

    d.noteUnexpectedProperties(Object.keys(getDefaultTexConfig()));
    return d;
}