// Internal dependencies
import {
    isDefined,
    isString,
    ifPresentAndDefined,
    isArray,
} from '$typeGuards/utils.js';
import { log } from '$utils/debug.js';

// External dependencies
import { inspect, getProperty } from '$deps.js';

/**
 * A class to diagnose problems in an object.
 *
 * @example
 * ```ts
 * const x = { a: 0, b: 0 };
 * const d = new Diagnoser(x);
 * d.ifPresent('a', 'a string', isString);
 * d.ifPresent('b', 'a positive number', (v) => isNumber(v) && v > 0, 'number');
 * d.passed; // false
 * d.problems.length; // 2
 * d.printProblems();
 * // Output:
 * // - Expected "a" to be a string. Instead, got a number.
 * // - Expected "b" to be a positive number. Instead, got: 0
 * ```
 */
export class Diagnoser {
    /**
     * The object being diagnosed.
     */
    private subject: object;

    /**
     * @param subject - The object to diagnose.
     */
    constructor(subject: object) {
        this.subject = subject;
    }

    /**
     * Array of problems found during diagnosis.
     */
    problems: { message: string; severity: 'error' | 'warn' }[] = [];

    get stats() {
        return {
            errors: this.problems.filter((p) => p.severity === 'error').length,
            warnings: this.problems.filter((p) => p.severity === 'warn').length,
            problems: this.problems.length,
        };
    }

    noteUnexpectedProperties(
        expected: string[],
        severity: 'error' | 'warn' = 'warn',
    ) {
        const subject = this.subject;
        const keys = Object.keys(subject);
        const unexpected = keys.filter((k) => !expected.includes(k));
        unexpected.forEach((k) => {
            this.problems.push({
                severity,
                message: `Unexpected property "${k}" will be ignored.`,
            });
        });
    }

    /**
     * Whether the object passed the diagnosis.
     */
    get passed() {
        return this.problems.length === 0;
    }

    /**
     * Print the problems found during diagnosis. If no problems were found,
     * this method does nothing.
     *
     * @param what - What to print. Either `'errors'`, `'warnings'`, or
     * `'both'`. Default: `'both'`.
     * @param grouped - Whether to group errors and warnings separately.
     * Default: `true`.
     * @param order - Order in which to print the problems. Either
     * `'unmodified'`, `'reversed'`, `'asc'`, or `'desc'`. Default: `'asc'`.
     * @param color - Whether to color the output. Default: `true`.
     * @param prefix - Prefix to add to each problem message before logging it.
     * Default: `'- '`.
     */
    printProblems(
        what: 'errors' | 'warnings' | 'both' = 'both',
        grouped: boolean = true,
        order: 'unmodified' | 'reversed' | 'asc' | 'desc' = 'asc',
        color: boolean = true,
        prefix: string = '- ',
    ) {
        // "what"
        let allProblems = [...this.problems];
        if (what === 'errors') {
            allProblems = allProblems.filter((p) => p.severity === 'error');
        } else if (what === 'warnings') {
            allProblems = allProblems.filter((p) => p.severity === 'warn');
        }

        // If no problems, return early
        if (allProblems.length === 0) return;

        // Sort
        if (order === 'asc' || order === 'desc') {
            allProblems.sort((a, b) => a.message.localeCompare(b.message));
        }
        if (order === 'reversed' || order === 'desc') {
            allProblems.reverse();
        }
        if (grouped && what === 'both') {
            const errors = allProblems.filter((p) => p.severity === 'error');
            const warnings = allProblems.filter((p) => p.severity === 'warn');
            allProblems = [...errors, ...warnings];
        }
        allProblems.forEach((p) => {
            if (color) log(p.severity, prefix + p.message);
            else log({ severity: p.severity, style: null }, prefix + p.message);
        });
    }

    /**
     * Manually add a problem to the diagnosis.
     *
     * @param message - The problem message.
     * @param severity - Severity of the problem. Either `'error'` or `'warn'`.
     * Default: `'error'`.
     *
     * @example
     * ```ts
     * d.addProblem('Expected "a" to be a string. Instead, got a number.', 'warn')
     * ```
     */
    addProblem(message: string, severity: 'error' | 'warn' = 'error') {
        this.problems.push({ message, severity });
    }

    /**
     * @param prop - Property key to check. Can be nested (e.g. `'a.b.c[0]'`).
     * @param expect - String representing what was expected.
     * @param typeGuard - Type guard to check the property against.
     * @param expectType - Expected type of the property. This is used to provide
     *
     * @param severity - Severity of the problem. Either `'error'` or `'warn'`.
     * Default: `'error'`.
     *
     * @example
     * ```ts
     * d.ifPresent('a', 'a string', isString);
     * d.ifPresent('b', 'a positive number', (v) => isNumber(v) && v > 0, 'number');
     * ```
     */
    ifPresent(
        prop: PropertyKey,
        expect: string,
        typeGuard: (x: unknown) => boolean,
        expectType?: NameOfPrimitiveTypeOrNull | NameOfPrimitiveTypeOrNull[],
        severity: 'error' | 'warn' = 'error',
    ) {
        let passed = true;
        const subject = this.subject;
        if (isString(prop) && (prop.includes('.') || prop.includes('['))) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
            const propValue = getProperty<unknown>(subject, prop, undefined);
            passed = !isDefined(propValue) || typeGuard(propValue);
        } else {
            passed = ifPresentAndDefined(subject, prop, typeGuard);
        }
        if (!passed) {
            this.problems.push({
                severity,
                message: `Expected "${String(prop)}" to be ${expect}. ${insteadGot(subject[prop as keyof typeof subject], expectType)}`,
            });
        }
    }
}

export type NameOfPrimitiveTypeOrNull =
    | 'object'
    | 'string'
    | 'number'
    | 'bigint'
    | 'boolean'
    | 'symbol'
    | 'undefined'
    | 'function'
    | 'null';

export function getType(x: unknown): NameOfPrimitiveTypeOrNull {
    return x === null ? 'null' : typeof x;
}

export function insteadGot(
    x: unknown,
    expectedType?: NameOfPrimitiveTypeOrNull | NameOfPrimitiveTypeOrNull[],
) {
    const typeStr = getType(x);
    const showDetails = isArray(expectedType)
        ? expectedType.includes(typeStr)
        : typeStr === expectedType;
    switch (typeStr) {
        case 'object':
            return `Instead, got${showDetails ? `: ${inspect(x, { depth: 3 })}` : ' an object.'}`;
        case 'null':
        case 'undefined':
            return `Instead, got ${typeStr}.`;
        default:
            return `Instead, got${showDetails ? `: ${inspect(x, { depth: 3 })}` : ` a ${typeStr}.`}`;
    }
}

export function enquote(str: unknown) {
    return `"${String(str)}"`;
}
