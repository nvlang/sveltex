export type FirstTwoLevelsRequired<T> = {
    [K in keyof T]-?: Required<T[K]>;
};

export type FirstTwoLevelsRequiredNotUndefined<T> = {
    [K in keyof T]-?: NotUndefined<RequiredNotUndefined<T[K]>>;
};

export type RequiredNotUndefined<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined>;
};

export type NotUndefined<T> = Exclude<T, undefined>;

export type MakePropertiesNonNullable<T> = {
    [P in keyof T]: Exclude<T[P], null | undefined>;
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
