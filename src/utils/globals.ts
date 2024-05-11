// Internal dependencies
import { detectPackageManager, log } from '$utils/debug.js';

// External dependencies
import { VERSION } from '$deps.js';

/**
 * The major version of the Svelte compiler (e.g., `4` or `5`).
 *
 * @see {@link VERSION | `VERSION`}, from `svelte/compiler`.
 */
export const SVELTE_MAJOR_VERSION: number = parseInt(
    (VERSION.match(/^(\d+)\.\d+\.\d+(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 * The minor version of the Svelte compiler.
 *
 * @see {@link VERSION | `VERSION`}, from `svelte/compiler`.
 */
export const SVELTE_MINOR_VERSION: number = parseInt(
    (VERSION.match(/^\d+\.(\d+)\.\d+(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 * The patch version of the Svelte compiler.
 *
 * @see {@link VERSION | `VERSION`}, from `svelte/compiler`.
 */
export const SVELTE_PATCH_VERSION: number = parseInt(
    (VERSION.match(/^\d+\.\d+\.(\d+)(?:-.*)?$/) ?? [])[1] ?? '0',
);

/**
 * Whether the Svelte compiler is a pre-release version.
 *
 * @see {@link VERSION | `VERSION`}, from `svelte/compiler`.
 */
export const SVELTE_PRERELEASE: boolean = VERSION.includes('-');

if (
    isNaN(SVELTE_MAJOR_VERSION) ||
    (SVELTE_MAJOR_VERSION === 0 && !VERSION.match(/^\d+\.\d+\.\d+(?:-.*)?$/))
) {
    log(
        'error',
        `Could not determine Svelte compiler version. Got: "${VERSION}".`,
    );
}

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
