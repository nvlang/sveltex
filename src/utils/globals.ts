// Internal dependencies
import { detectPackageManager, log, prettifyError } from '$utils/debug.js';

// External dependencies
import { VERSION, semverMajor } from '$deps.js';

function getMajorVersion(version: string): number {
    try {
        return (semverMajor as (v: string) => number)(version);
    } catch (error) {
        log(
            'error',
            `Could not determine Svelte compiler version. Got: "${version}".\n\n${prettifyError(error)}\n\n`,
        );
        return -1;
    }
}

/**
 * The major version of the Svelte compiler (e.g., `4` or `5`).
 *
 * @see {@link VERSION | `VERSION`}, from `svelte/compiler`.
 */
export const SVELTE_MAJOR_VERSION: number = getMajorVersion(VERSION);

/**
 * Array to keep track of missing dependencies
 */
export const missingDeps: string[] = [];

/**
 * Package manager used in the project, detected by the `detect-package-manager`
 * package.
 */
export const packageManager: 'pnpm' | 'bun' | 'npm' | 'yarn' =
    detectPackageManager();
