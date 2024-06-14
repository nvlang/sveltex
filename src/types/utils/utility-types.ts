export type FirstTwoLevelsRequired<T> = {
    [K in keyof T]-?: Required<T[K]>;
};

export type FirstTwoLevelsRequiredNotUndefined<T> = {
    [K in keyof T]-?: ExcludeUndefined<RequiredNotUndefined<T[K]>>;
};

export type FirstTwoLevelsRequiredNotNullOrUndefined<T> = {
    [K in keyof T]-?: NotNullOrUndefined<RequiredNotNullOrUndefined<T[K]>>;
};

export type RequiredNotUndefined<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined>;
};

export type ExcludeUndefined<T> = Exclude<T, undefined>;

export type ExcludeNull<T> = Exclude<T, null>;

export type NotNullOrUndefined<T> = Exclude<T, null | undefined>;

export type PrimitiveTypeOrNull =
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
export type NotUndefined = Exclude<PrimitiveTypeOrNull, undefined>;

/**
 * A type representing any function that takes any number of arguments and
 * returns any value.
 */
export type UnknownFunction = (...args: unknown[]) => unknown;

export type DeepRequiredNotUndefined<T> = RequiredNotUndefined<{
    [K in keyof T]: T[K] extends RequiredNotUndefined<T[K]>
        ? T[K]
        : DeepRequiredNotUndefined<T[K]>;
}>;

/**
 * NB: Properties may still be optional; in other words,
 *
 * ```ts
 * MakePropertiesNotNullOrUndefined<{
 *     a?: string | null | undefined;
 * }>
 * // ...is equivalent to...
 * { a?: string }
 * ```
 */
export type MakePropertiesNotNullOrUndefined<T> = {
    [P in keyof T]: NotNullOrUndefined<T[P]>;
};

export type MakePropertiesNotUndefined<T> = {
    [P in keyof T]: ExcludeUndefined<T[P]>;
};

export type MakePropertiesNotNull<T> = {
    [P in keyof T]: ExcludeNull<T[P]>;
};

export type RequiredNotNullOrUndefined<T> = Required<
    MakePropertiesNotNullOrUndefined<T>
>;

export type RequiredNonNullOrUndefinedExcept<T, K extends keyof T> = Required<
    MakePropertiesNotNullOrUndefined<Omit<T, K>>
> &
    Pick<T, K>;

export type MarkRequiredNotNullOrUndefined<T, K extends keyof T> = T &
    Required<MakePropertiesNotNullOrUndefined<Pick<T, K>>>;

type Nullable<T> = T | null | undefined;

export type MakePropertiesNullable<T> = {
    [P in keyof T]: Nullable<T[P]>;
};

export type PartialNullable<T> = Partial<MakePropertiesNullable<T>>;

export type MarkPartialNullable<T, K extends keyof T> = T &
    Partial<MakePropertiesNullable<Pick<T, K>>>;

type Undefinable<T> = T | undefined;

export type MakePropertiesUndefinable<T> = {
    [P in keyof T]: Undefinable<T[P]>;
};

export type PartialUndefinable<T> = Partial<MakePropertiesUndefinable<T>>;

export type MarkPartialUndefinable<T, K extends keyof T> = T &
    Partial<MakePropertiesUndefinable<Pick<T, K>>>;

/**
 * Taken from Shiki's definition of the same type.
 *
 * @see https://github.com/microsoft/TypeScript/issues/29729#issuecomment-471566609
 */
export type StringLiteralUnion<T extends U, U = string> = T | (U & {});
