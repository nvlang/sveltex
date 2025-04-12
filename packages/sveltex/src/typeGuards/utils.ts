// File description:

// Types
import type { Defined, UnknownFunction } from '../types/utils/utility-types.js';

/**
 * Type guard to check that an input is defined (i.e., not `undefined`).
 */
export function isDefined(input: unknown): input is Defined {
    return input !== undefined;
}

/**
 * Type guard to check that an input is defined (i.e., not `undefined`).
 *
 * Alias of {@link isDefined | `isDefined`}.
 */
export function isNotUndefined(input: unknown): input is Defined {
    return isDefined(input);
}

/**
 * Type guard to check that an input is {@link NonNullable | `NonNullable`}
 * (i.e., neither `undefined` nor `null`).
 */
export function isNonNullable(input: unknown): input is NonNullable<unknown> {
    return input !== undefined && input !== null;
}

/**
 * Type guard to check that an input is a string.
 */
export function isString(input: unknown): input is string {
    return typeof input === 'string';
}

/**
 * Type guard to check that an input is a number.
 */
export function isNumber(input: unknown): input is number {
    return typeof input === 'number';
}

/**
 * Type guard to check that an input is a boolean.
 */
export function isBoolean(input: unknown): input is boolean {
    return typeof input === 'boolean';
}

/**
 * Type guard to check that an input is an object.
 */
export function isObject(input: unknown): input is object | null {
    return typeof input === 'object';
}

/**
 * Type guard to check that an input is a {@link UnknownFunction | function}.
 */
export function isFunction(input: unknown): input is UnknownFunction {
    return typeof input === 'function';
}

// Composite
/**
 * Check if an input is a non-null object.
 *
 * @example
 * ```ts
 * // true:
 * isNonNullObject({});
 * isNonNullObject({ a: 1 });
 * isNonNullObject([]);
 * isNonNullObject([1, 2, 3]);
 *
 * // false:
 * isNonNullObject(null);
 * isNonNullObject(undefined);
 * isNonNullObject(123);
 * ```
 */
export function isNonNullObject(input: unknown): input is object {
    return isObject(input) && input !== null;
}

// Arrays
/**
 * Type guard to check that an input is an array.
 *
 * @param input - The input to check.
 * @param check - An optional type guard to apply to each element of the array.
 * @returns `true` if the input is an array and, if `check` is provided, if
 * every element of the array passes the check.
 *
 * @example
 * ```ts
 * // true:
 * isArray([]);
 * isArray([], isNumber);
 * isArray([], isString);
 * isArray([1, 2, 3]);
 * isArray([1, 2, 3], isNumber);
 * isArray(['a', 'b', 'c'], isString);
 * isArray([true, false, true], isBoolean);
 * isArray([{}, {}], isObject);
 * isArray([() => {}, () => {}], isFunction);
 *
 * // false:
 * isArray({});
 * isArray(null);
 * isArray(undefined);
 * isArray(123);
 * isArray([1, 2, 3], isString);
 * ```
 */
export function isArray(
    input: unknown,
    check?: (value: unknown, index?: number, array?: unknown[]) => boolean,
): input is unknown[] {
    return Array.isArray(input) && (check === undefined || input.every(check));
}

/**
 * Type guard to check that an input is an array of strings.
 */
export function isStringArray(input: unknown): input is string[] {
    return isArray(input, isString);
}

/**
 * Type guard to check that an input is an array of numbers.
 */
export function isNumberArray(input: unknown): input is number[] {
    return isArray(input, isNumber);
}

/**
 * Type guard to check that an input is an array of booleans.
 */
export function isBooleanArray(input: unknown): input is boolean[] {
    return isArray(input, isBoolean);
}

/**
 * Type guard to check that an input is an array of objects.
 */
export function isObjectArray(input: unknown): input is object[] {
    return isArray(input, isObject);
}

/**
 * Type guard to check that an input is an array of functions.
 */
export function isFunctionArray(input: unknown): input is UnknownFunction[] {
    return isArray(input, isFunction);
}

/**
 * Type guard to check that an input is Record.
 *
 * @param input - The input to check.
 * @param check - An optional type guard to apply to each entry of the record.
 * @returns `true` iff the input is a record (i.e., non-null object) and, if
 * `check` is provided, if every entry of the record passes the check.
 *
 * @example
 * ```ts
 * // true:
 * isRecord({});
 * isRecord([]);
 * isRecord({ a: 1, b: 2 });
 * isRecord({ a: 1, b: 2 }, ([k, v]) => isString(k) && isNumber(v));
 * isRecord([1, 2]);
 * isRecord([1, 2], ([k, v]) => isNumber(k) && isNumber(v));
 *
 * // false:
 * isRecord(null);
 * isRecord(undefined);
 * isRecord(123);
 * isRecord('a');
 * isRecord({ a: 1, b: 2 }, ([k, v]) => isString(k) && isString(v));
 * isRecord([1, 2], ([k, v]) => isString(k) && isNumber(v));
 * ```
 */
export function isRecord(
    input: unknown,
    check?: (entry: [PropertyKey, unknown]) => boolean,
): input is Record<string, unknown> {
    return (
        isNonNullObject(input) &&
        (check
            ? isArray(input)
                ? input.every((v, k) => check([k, v]))
                : Object.entries(input).every(check)
            : true)
    );
}

/**
 * Type guard to check that an input is included in the given array of options.
 */
export function isOneOf<T>(
    input: T,
    options: readonly T[],
): input is (typeof options)[number] {
    return options.includes(input);
}

/**
 * Type guard to check that a property is present in an object. The property's
 * value may still be `undefined`, however.
 *
 * @param obj - The object to check.
 * @param prop - The property to check.
 * @returns `true` if the property is present in the object.
 *
 * @example
 * ```ts
 * // true:
 * isPresent({ prop: 'hello' }, 'prop');
 * isPresent({ prop: null }, 'prop');
 * isPresent({ prop: undefined }, 'prop');
 *
 * // false:
 * isPresent({}, 'prop');
 * ```
 */
export function isPresent<T extends PropertyKey>(
    obj: object,
    prop: T,
): obj is Record<T, unknown> {
    return isNonNullObject(obj) && prop in obj;
}

/**
 * Type guard to check that a property is present in an object and that its
 * value is not `undefined`.
 *
 * @param obj - The object to check.
 * @param prop - The property to check.
 * @returns `true` if the property is present and its value is not `undefined`.
 *
 * @example
 * ```ts
 * // true:
 * isPresentAndDefined({ prop: 'hello' }, 'prop');
 * isPresentAndDefined({ prop: null }, 'prop');
 *
 * // false:
 * isPresentAndDefined({ prop: undefined }, 'prop');
 * isPresentAndDefined({}, 'prop');
 * ```
 */
export function isPresentAndDefined<T extends PropertyKey>(
    obj: object,
    prop: T,
): obj is Record<T, Defined> {
    return isPresent(obj, prop) && isDefined(obj[prop]);
}

/**
 * Ensure that, if a property *is* present (even if its value may be
 * `undefined`), it is of a certain type.
 *
 * @param obj - The object to check.
 * @param prop - The property to check.
 * @param check - The check (usually a type guard) to apply to the property
 * value.
 * @returns `true` if the property is not present or if the check passes.
 *
 * @remarks
 * This function does not result in any type narrowing, but it can still be
 * useful as a utility method, esp. for type guards.
 *
 * @example
 * ```ts
 * // true:
 * ifPresent({ prop: 'hello' }, 'prop', isString);
 *
 * // false:
 * ifPresent({ prop: 123 }, 'prop', isString);
 * ifPresent({ prop: {} }, 'prop', isString);
 * ```
 */
export function ifPresent(
    obj: object,
    prop: PropertyKey,
    check: (val: unknown) => boolean,
): boolean {
    return !isPresent(obj, prop) || check(obj[prop]);
}

/**
 * Ensure that, if a property *is* present (and not `undefined`), it is of a
 * certain type.
 *
 * @param obj - The object to check.
 * @param prop - The property to check.
 * @param check - The check (usually a type guard) to apply to the property
 * value.
 * @returns `true` if the property is not present or is `undefined`, or if the
 * check passes.
 *
 * @remarks
 * This function does not result in any type narrowing, but it can still be
 * useful as a utility method, esp. for type guards.
 *
 * @example
 * ```ts
 * // true:
 * ifPresentAndDefined({ prop: undefined }, 'prop', isString);
 * ifPresentAndDefined({ prop: 'hello' }, 'prop', isString);
 *
 * // false:
 * ifPresentAndDefined({ prop: null }, 'prop', isString);
 * ifPresentAndDefined({ prop: 123 }, 'prop', isString);
 * ifPresentAndDefined({ prop: {} }, 'prop', isString);
 * ```
 */
export function ifPresentAndDefined(
    obj: object,
    prop: PropertyKey,
    check: (val: unknown) => boolean,
): boolean {
    return !isPresentAndDefined(obj, prop) || check(obj[prop]);
}
