// External dependencies
import { deepmergeCustom } from '$deps.js';

/**
 * Merge multiple configuration objects into one.
 *
 * @param config - The base configuration object.
 * @param configs - The configuration objects to merge into the base
 * configuration.
 * @returns The merged configuration object.
 *
 * @remarks
 * This function uses `deepmerge-ts` to merge the configuration objects. The
 * only way in which it differs from the default `deepmerge` function from
 * `deepmerge-ts` is that it doesn't merge arrays, overriding them instead.
 *
 * @remarks
 * `undefined` values will not override previous values.
 *
 * @example
 * ```ts
 * mergeConfigs({ a: 1 }, { a: 2 }); // { a: 2 }
 * mergeConfigs({ a: [1] }, { a: [2] }); // { a: [2] }
 * mergeConfigs({ a: 1 }, { a: null }); // { a: null }
 * mergeConfigs({ a: 1 }, { a: undefined }); // { a: 1 }
 * ```
 */
export function mergeConfigs<T extends NonNullable<object>>(
    config: T,
    ...configs: NonNullable<object>[]
): T {
    return mergeCustom(config, ...configs) as unknown as T;
}

export const mergeCustom = deepmergeCustom({
    // Don't merge arrays; override them instead. For example, we want:
    //     mergeCustom({ a: [1] }, { a: [2] }) => { a: [2] }
    // In this case, `values` would be [[1], [2]] and we want to return [2].
    //     [[1], [2]] => [2]
    // In other words, we want to return the last value of the `values` array.
    mergeArrays: (values) => values[values.length - 1],
});
