// File description: Diagnoser for `MathConfiguration` type.

// Types
import type { MathBackend } from '../../types/handlers/Math.js';

// Internal dependencies
import {
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
} from '../../typeGuards/utils.js';
import { log } from '../debug.js';
import { checkTransformers, Diagnoser, insteadGot } from './Diagnoser.js';
import { getDefaultMathConfig } from '../../base/defaults.js';

export function diagnoseMathConfiguration(
    backend: MathBackend,
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
    checkTransformers(d);
    d.ifPresent('delims', 'a non-null object', isNonNullObject, 'object');
    d.ifPresent('delims.dollars', 'a boolean', isBoolean, 'boolean');
    d.ifPresent(
        'delims.inline',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent(
        'delims.inline.singleDollar',
        'a boolean',
        isBoolean,
        'boolean',
    );
    d.ifPresent(
        'delims.inline.escapedParentheses',
        'a boolean',
        isBoolean,
        'boolean',
    );
    d.ifPresent(
        'delims.display',
        'a non-null object',
        isNonNullObject,
        'object',
    );
    d.ifPresent(
        'delims.display.escapedSquareBrackets',
        'a boolean',
        isBoolean,
        'boolean',
    );
    d.ifPresent(
        'delims.doubleDollarSignsDisplay',
        'one of "always", "newline", "fenced"',
        (v) => isOneOf(v, ['always', 'newline', 'fenced']),
        'string',
    );
    if (backend === 'katex') {
        d.ifPresent('katex', 'a non-null object', isNonNullObject, 'object');
        d.ifPresent(
            'css',
            'null, or a valid CSS configuration object',
            (v) => v === null || isNonNullObject(v),
            ['object', 'null'],
        );
        d.ifPresent(
            'css.type',
            'one of "cdn", "hybrid", "none"',
            (v) => isOneOf(v, ['cdn', 'hybrid', 'none']),
            'string',
        );
    } else if (backend === 'mathjax') {
        d.ifPresent(
            'outputFormat',
            'one of "svg", "chtml"',
            (v) => isOneOf(v, ['svg', 'chtml']),
            'string',
        );
        d.ifPresent('mathjax', 'a non-null object', isNonNullObject, 'object');
        d.ifPresent(
            'css',
            'null, or a valid CSS configuration object',
            (v) => v === null || isNonNullObject(v),
            ['object', 'null'],
        );
        d.ifPresent(
            'css.type',
            'one of "hybrid", "none"',
            (v) => isOneOf(v, ['hybrid', 'none']),
            'string',
        );
    } else if (backend === 'custom') {
        d.isPresent('process', 'a function', isFunction, 'function');
    }
    d.noteUnexpectedProperties(Object.keys(getDefaultMathConfig(backend)));
    d.printProblems();
    return d.stats;
}
