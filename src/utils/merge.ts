import { deepmergeCustom } from 'deepmerge-ts';

/**
 * Merge multiple configuration objects into one.
 *
 * @param config - The base configuration object.
 * @param configs - The configuration objects to merge into the base configuration.
 * @returns The merged configuration object.
 */
export function mergeConfigs<T extends NonNullable<object>>(
    config: T,
    ...configs: NonNullable<object>[]
): T {
    return mergeCustom(config, ...configs) as unknown as T;
}

export const mergeCustom = deepmergeCustom({
    mergeOthers: (values, utils) =>
        utils.defaultMergeFunctions.mergeOthers(
            values.filter((v) => v !== undefined && v !== null),
        ),
});

export function mergeWithoutUndefinedOverrides<T extends NonNullable<object>>(
    config: T,
    ...configs: NonNullable<object>[]
): T {
    return mergeCustomWithoutUndefinedOverrides(
        config,
        ...configs,
    ) as unknown as T;
}

export const mergeCustomWithoutUndefinedOverrides = deepmergeCustom({
    mergeOthers: (values, utils) =>
        utils.defaultMergeFunctions.mergeOthers(
            values.filter((v) => v !== undefined),
        ),
});
