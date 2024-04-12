import { VERSION } from 'svelte/compiler';

/**
 * The major version of the Svelte compiler (e.g., `4` or `5`).
 */
export const SVELTE_MAJOR_VERSION: number = parseInt(
    (VERSION.match(/^(\d+)\.\d+\.\d+(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 *
 */
export const SVELTE_MINOR_VERSION: number = parseInt(
    (VERSION.match(/^\d+\.(\d+)\.\d+(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 *
 */
export const SVELTE_PATCH_VERSION: number = parseInt(
    (VERSION.match(/^\d+\.\d+\.(\d+)(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 *
 */
export const SVELTE_PRERELEASE: boolean = VERSION.includes('-');

/**
 *
 */
export const AST_API_FAMILIAR: boolean =
    SVELTE_MAJOR_VERSION === 4 || SVELTE_MAJOR_VERSION === 5;
