export type FirstTwoLevelsRequired<T> = {
    [K in keyof T]-?: Required<T[K]>;
};

export type FirstTwoLevelsRequiredNotUndefined<T> = {
    [K in keyof T]-?: ExcludeUndefined<RequiredNotUndefined<T[K]>>;
};

export type FirstTwoLevelsRequiredNonNullable<T> = {
    [K in keyof T]-?: NonNullable<RequiredNonNullable<T[K]>>;
};

export type RequiredNotUndefined<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined>;
};

export type ExcludeUndefined<T> = Exclude<T, undefined>;

/**
 * Any type other than `undefined`.
 */
export type NotUndefined = NonNullable<unknown> | null;

/**
 * A type representing any function that takes any number of arguments and
 * returns any value.
 */
export type UnknownFunction = (...args: unknown[]) => unknown;

export type MakePropertiesNonNullable<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};

export type RequiredNonNullable<T> = Required<MakePropertiesNonNullable<T>>;

export type RequiredNonNullableExcept<T, K extends keyof T> = Required<
    MakePropertiesNonNullable<Omit<T, K>>
> &
    Pick<T, K>;

export type MarkRequiredNonNullable<T, K extends keyof T> = T &
    Required<MakePropertiesNonNullable<Pick<T, K>>>;

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
