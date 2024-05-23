// Internal dependencies
import {
    ifPresentAndDefined,
    isBoolean,
    isFunction,
    isNonNullObject,
    isNumber,
    isOneOf,
    isRecord,
    isString,
    isStringArray,
} from '$type-guards/utils.js';
import {
    isSimpleEscapeInstruction,
    isVerbatimType,
} from '$type-guards/verbatim.js';
import { Diagnoser, insteadGot } from '$utils/diagnosers/Diagnoser.js';
import { log } from '$utils/debug.js';
import { diagnoseTexLiveConfig } from '$utils/diagnosers/texLiveConfig.js';
import { getDefaultVerbEnvConfig } from '$config/defaults.js';
import { VerbatimType } from '$types/handlers/Verbatim.js';

/**
 * Diagnose whether a given object is a valid verbatim environment
 * configuration.
 *
 * @param x - The object to diagnose.
 * @param env - The name of the verbatim environment to which the configuration
 * corresponds.
 * @returns An object containing:
 * - `errors`: The number of errors found.
 * - `warnings`: The number of warnings found.
 * - `problems`: The total number of problems found (i.e., `errors + warnings`).
 */
export function diagnoseVerbEnvConfig(x: unknown, env?: string) {
    if (!isNonNullObject(x)) {
        log(
            'error',
            `Expected configuration of verbatim environment${env ? ' ' + JSON.stringify(env) : ''} to be non-null object. ${insteadGot(x)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }

    const d = new Diagnoser(x);
    d.ifPresent(
        'type',
        `one of: "advancedTex", "code", "escapeOnly", "custom", "noop"`,
        isVerbatimType,
        'string',
    );

    const type: VerbatimType | undefined =
        'type' in x &&
        x.type &&
        isString(x.type) &&
        isOneOf(x.type, ['code', 'noop', 'advancedTex', 'escapeOnly', 'custom'])
            ? (x.type as VerbatimType)
            : undefined;

    d.ifPresent(
        'defaultAttributes',
        'an object with string keys and string, number, boolean, null, or undefined values',
        (v) =>
            isRecord(
                v,
                ([k, v]) =>
                    isString(k) &&
                    (isString(v) ||
                        isBoolean(v) ||
                        isNumber(v) ||
                        v === null ||
                        v === undefined),
            ),
        'object',
    );
    d.ifPresent(
        'aliases',
        'a (possibly empty) array of strings',
        isStringArray,
        'object',
    );
    d.ifPresent(
        'attributeForwardingBlocklist',
        'an array of strings',
        isStringArray,
        'object',
    );
    d.ifPresent(
        'attributeForwardingAllowlist',
        'an array of strings or "all"',
        (v) => isStringArray(v) || v === 'all',
        ['object', 'string'],
    );
    d.ifPresent(
        'component',
        'a string or null',
        (v) => isString(v) || v === null,
        ['string', 'null'],
    );
    d.ifPresent(
        'selfCloseOutputWith',
        'one of "auto", "/>", " />"',
        (v) => isOneOf(v, ['auto', '/>', ' />']),
        'string',
    );
    d.ifPresent(
        'respectSelfClosing',
        type === 'advancedTex' ? 'false' : 'a boolean',
        (v) => (type === 'advancedTex' ? v === false : isBoolean(v)),
        'boolean',
    );
    if (type === 'code') d.ifPresent('wrap', 'a boolean', isBoolean, 'boolean');
    if (type === 'escapeOnly') {
        d.ifPresent(
            'escapeInstructions',
            'an object of type { escapeBraces?: boolean; escapeHtml?: boolean }',
            isSimpleEscapeInstruction,
            'object',
        );
    }
    if (type === 'custom') {
        d.ifPresent(
            'customProcess',
            'a function (inner: string, attributes: Record<string, string | boolean | number | null | undefined>) => string',
            isFunction,
            'function',
        );
    }

    if (type === 'advancedTex') {
        d.ifPresent('preamble', 'a string', isString, 'string');
        d.ifPresent('documentClass', 'a string', isString, 'string');
        d.ifPresent(
            'overrides',
            'a non-null object',
            isNonNullObject,
            'object',
        );
        ifPresentAndDefined(x, 'overrides', (v) => {
            if (!isNonNullObject(v)) return true;
            const tlcDiagnoser = diagnoseTexLiveConfig(v);
            if (!tlcDiagnoser.passed) {
                tlcDiagnoser.problems.forEach((problem) => {
                    d.addProblem(
                        problem.message.replace('"', '"overrides.'),
                        problem.severity,
                    );
                });
                return false;
            }
            return true;
        });
        d.ifPresent(
            'handleAttributes',
            'a function (attributes: Record<string, string | number | boolean | null | undefined>, tc: Omit<TexComponent, ...> & ...) => Record<string, unknown>',
            isFunction,
            'function',
        );
        d.ifPresent(
            'postprocess',
            'a function (svgComponent: string, tc: TexComponent<A>) => string',
            isFunction,
            'function',
        );
    } else {
        [
            'preamble',
            'documentClass',
            'overrides',
            'handleAttributes',
            'postprocess',
        ].forEach((prop) => {
            d.ifPresent(
                prop,
                'undefined, since "type" is not "advancedTex"',
                (v) => v === undefined,
                'undefined',
                'warn',
            );
        });
    }
    if (type) {
        d.noteUnexpectedProperties(Object.keys(getDefaultVerbEnvConfig(type)));
    }
    if (!d.passed) {
        log(
            d.stats.errors > 0 ? 'error' : 'warn',
            `Problems found in configuration of verbatim environment${env ? ' ' + JSON.stringify(env) : ''}:`,
        );
    }
    d.printProblems();
    return d.stats;
}
