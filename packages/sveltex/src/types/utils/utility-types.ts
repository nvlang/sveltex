// File description: Utility types used throughout SvelTeX.

/**
 * Make properties required, and remove `undefined` from their types, if
 * present. This utility type applies to the first two levels of the object
 * only.
 *
 * @example
 * ```ts
 * FirstTwoLevelsRequiredDefinedNotNull<{
 *     a?: string | null | undefined;
 *     b?: {
 *         c?: string | null | undefined;
 *         d?: { e?: string | null | undefined } | null | undefined;
 *     } | null | undefined;
 * }>
 * // {
 * //     a: string | null;
 * //     b: {
 * //         c: string | null;
 * //         d: { e?: string | null | undefined } | null;
 * //     } | null;
 * // }
 * ```
 */

export type FirstTwoLevelsRequiredDefined<T> = {
    [K in keyof T]-?: Exclude<RequiredDefined<T[K]>, undefined>;
};

/**
 * Make properties required, and remove `undefined` and `null` from their types,
 * if present. This utility type applies to the first two levels of the object
 * only.
 *
 * @example
 * ```ts
 * FirstTwoLevelsRequiredDefinedNotNull<{
 *     a?: string | undefined;
 *     b?: {
 *         c?: string | undefined;
 *         d?: { e?: string | undefined } | undefined;
 *     } | undefined;
 * }>
 * // {
 * //     a: string;
 * //     b: {
 * //         c: string;
 * //         d: { e?: string | undefined };
 * //     };
 * // }
 * ```
 */
export type FirstTwoLevelsRequiredDefinedNotNull<T> = {
    [K in keyof T]-?: Exclude<RequiredDefinedNotNull<T[K]>, null | undefined>;
};

/**
 * Make properties required, and remove `undefined` from their types, if
 * present.
 *
 * @example
 * ```ts
 * RequiredDefined<{
 *     a?: string | null | undefined;
 *     b?: { c?: string | null | undefined } | null | undefined;
 * }>
 * // { a: string | null, b: { c?: string | null | undefined } | null }
 * ```
 */
export type RequiredDefined<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined>;
};

/**
 * A union type meant to encompass all possible TypeScript types.
 */
type PrimitiveTypeOrNull =
    | string
    | number
    | bigint
    | boolean
    | symbol
    | undefined
    | object
    | UnknownFunction
    | null;

/**
 * Any type other than `undefined`.
 */
export type Defined = Exclude<PrimitiveTypeOrNull, undefined>;

/**
 * A type representing any function that takes any number of arguments and
 * returns any value.
 */
export type UnknownFunction = (...args: unknown[]) => unknown;

/**
 * Make properties required, and remove `undefined` from their types, if
 * present. This utility type applies deeply, meaning that it will also make
 * nested properties required (and remove `undefined` from their types as well,
 * if present).
 *
 * @example
 * ```ts
 * DeepRequiredDefined<{
 *     a?: string | null | undefined;
 *     b?: {
 *         c?: string | null | undefined;
 *     } | null | undefined;
 * }>
 * // { a: string | null, b: { c: string | null } | null }
 * ```
 */
export type DeepRequiredDefined<T> = RequiredDefined<{
    [K in keyof T]: T[K] extends RequiredDefined<T[K]>
        ? T[K]
        : DeepRequiredDefined<T[K]>;
}>;

/**
 * @remarks
 * Properties may still be optional; in other words:
 *
 * ```ts
 * PropertiesDefinedNotNull<{
 *     a?: string | null | undefined;
 * }>
 * // ...is equivalent to...
 * { a?: string }
 * ```
 */
export type PropertiesDefinedNotNull<T> = {
    [P in keyof T]: Exclude<T[P], null | undefined>;
};

/**
 * @remarks
 * Properties may still be optional; in other words:
 *
 * ```ts
 * PropertiesDefined<{
 *     a?: string | null | undefined;
 * }>
 * // ...is equivalent to...
 * { a?: string | null }
 * ```
 */
export type PropertiesDefined<T> = {
    [P in keyof T]: Exclude<T[P], undefined>;
};

/**
 * Make properties required, and remove `null` and `undefined` from their types,
 * if present.
 *
 * @example
 * ```ts
 * RequiredDefinedNotNull<{
 *    a?: string | null | undefined;
 * }>
 * // { a: string }
 * ```
 */
export type RequiredDefinedNotNull<T> = Required<PropertiesDefinedNotNull<T>>;

/**
 * Taken from Shiki's definition of the same type.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729#issuecomment-471566609
 */
export type StringLiteralUnion<T extends U, U = string> = T | (U & {});
