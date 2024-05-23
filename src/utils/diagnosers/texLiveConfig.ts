// Internal dependencies
import { getDefaultTexLiveConfig } from '$config/defaults.js';
import {
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
    isString,
} from '$type-guards/utils.js';
import {
    isCliInstruction,
    isSupportedTexEngine,
} from '$type-guards/verbatim.js';
import { Diagnoser } from '$utils/diagnosers/Diagnoser.js';

/**
 * Diagnose whether a given object is a valid TeX live configuration.
 *
 * @param x - The object to diagnose.
 * @returns Diagnoser object.
 */
export function diagnoseTexLiveConfig(x: object) {
    const d = new Diagnoser(x);
    d.ifPresent(
        'shellEscape',
        `a boolean or "restricted"`,
        (v) => isBoolean(v) || v === 'restricted',
        ['boolean', 'string'],
    );
    d.ifPresent('saferLua', 'a boolean', isBoolean, 'boolean');
    d.ifPresent(
        'intermediateFiletype',
        'either "pdf" or "dvi"',
        (v) => isOneOf(v, ['pdf', 'dvi']),
        'string',
    );
    d.ifPresent('caching', 'a boolean', isBoolean, 'boolean');
    d.ifPresent('cacheDirectory', 'a string', isString, 'string');
    d.ifPresent(
        'overrideCompilationCommand',
        'a CliInstruction object or null',
        (v) => isCliInstruction(v) || v === null,
        ['object', 'null'],
    );
    d.ifPresent(
        'overrideSvgPostprocess',
        'a function (svg: string, tc: TexComponent<A>) => string or null',
        (v) => isFunction(v) || v === null,
        ['function', 'null'],
    );
    d.ifPresent('svgoOptions', 'a non-null object', isNonNullObject, 'object');
    d.ifPresent(
        'dvisvgmOptions',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent('verbose', 'a boolean', isBoolean, 'boolean');
    d.ifPresent('outputDirectory', 'a string', isString, 'string');
    d.ifPresent(
        'engine',
        'one of "lualatex" (default), "pdflatex", "lualatexmk", "tex", or "latexmk"',
        isSupportedTexEngine,
        'string',
    );
    d.noteUnexpectedProperties(Object.keys(getDefaultTexLiveConfig('local')));
    return d;
}
