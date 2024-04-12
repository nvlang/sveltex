import { detectPackageManager } from '$utils';

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
