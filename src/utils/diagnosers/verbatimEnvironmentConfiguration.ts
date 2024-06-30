// File description: Diagnoser for `VerbatimEnvironmentConfiguration` type.

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
} from '$typeGuards/utils.js';
import {
    isSimpleEscapeInstruction,
    isVerbatimType,
    verbatimTypes,
} from '$typeGuards/verbatim.js';
import { Diagnoser, insteadGot } from '$utils/diagnosers/Diagnoser.js';
import { log } from '$utils/debug.js';
import { diagnoseTexConfig } from '$utils/diagnosers/texConfiguration.js';
import { getDefaultVerbEnvConfig } from '$base/defaults.js';
import type { VerbatimType } from '$types/handlers/Verbatim.js';

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
export function diagnoseVerbEnvConfig(
    x: unknown,
    env?: string,
): { errors: number; warnings: number; problems: number } {
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
        `one of: "tex", "code", "escape", "custom", "noop"`,
        isVerbatimType,
        'string',
    );

    const type: VerbatimType | undefined =
        'type' in x &&
        x.type &&
        isString(x.type) &&
        isOneOf(x.type, verbatimTypes)
            ? (x.type as VerbatimType)
            : undefined;

    d.ifPresent(
        'transformers',
        'an object with "pre" and "post" properties',
        (obj) => isRecord(obj, ([k]) => k === 'pre' || k === 'post'),
        'object',
    );

    d.ifPresent(
        'defaultAttributes',
        'an object with string keys and string, number, boolean, null, or undefined values',
        (obj) =>
            isRecord(
                obj,
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
        type === 'tex' ? 'false' : 'a boolean',
        (v) => (type === 'tex' ? v === false : isBoolean(v)),
        'boolean',
    );
    if (type === 'escape') {
        d.ifPresent(
            'escapeInstructions',
            'an object of type { escapeBraces?: boolean; escapeHtml?: boolean }',
            isSimpleEscapeInstruction,
            'object',
        );
    }

    if (type === 'tex') {
        d.ifPresent('preamble', 'a string', isString, 'string');
        d.ifPresent(
            'documentClass',
            'a string or an object of type { name?: string; options?: string[] }',
            (v) =>
                isString(v) ||
                isRecord(
                    v,
                    ([k, v]) =>
                        (k === 'name' && (v === undefined || isString(v))) ||
                        (k === 'options' &&
                            (v === undefined || isStringArray(v))),
                ),
            ['string', 'object'],
        );
        d.ifPresent(
            'overrides',
            'a non-null object',
            isNonNullObject,
            'object',
        );
        ifPresentAndDefined(x, 'overrides', (v) => {
            if (!isNonNullObject(v)) return true;
            const tlcDiagnoser = diagnoseTexConfig(v);
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
                'undefined, since "type" is not "tex"',
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
