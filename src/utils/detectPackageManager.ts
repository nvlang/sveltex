import { accessSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Checks if a file or directory exists at the specified path.
 *
 * @param path - The path to check.
 * @returns `true` if the path exists, `false` otherwise.
 */
export function pathExists(path: string) {
    try {
        accessSync(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Retrieves the package manager from the package.json file.
 * @param cwd - The current working directory. Defaults to `process.cwd()`.
 * @returns The package manager ('pnpm', 'bun', 'npm', or 'yarn'), or
 * `undefined` if not found (or unknown package manager is found).
 */
export function getPmFromPackageJson(
    cwd = process.cwd(),
): 'pnpm' | 'bun' | 'npm' | 'yarn' | undefined {
    const packageJsonPath = resolve(cwd, 'package.json');
    if (pathExists(packageJsonPath)) {
        const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
        const packageJsonObj: unknown = JSON.parse(packageJsonContent);
        if (
            typeof packageJsonObj !== 'object' ||
            packageJsonObj === null ||
            !('packageManager' in packageJsonObj) ||
            typeof packageJsonObj.packageManager !== 'string'
        ) {
            return undefined;
        }
        const pm = packageJsonObj.packageManager.split('@')[0];
        if (pm !== undefined && ['pnpm', 'bun', 'npm', 'yarn'].includes(pm)) {
            return pm as 'pnpm' | 'bun' | 'npm' | 'yarn';
        }
    }
    return undefined;
}

const lockFiles = [
    { name: 'pnpm-lock.yaml', pm: 'pnpm' },
    { name: 'bun.lockb', pm: 'bun' },
    { name: 'package-lock.json', pm: 'npm' },
    { name: 'yarn.lock', pm: 'yarn' },
] as const;

/**
 * Determines the type of lock file present in the current working directory.
 * @param cwd - The current working directory. Defaults to `process.cwd()`.
 * @returns The type of lock file ('pnpm', 'bun', 'npm', 'yarn'), or `undefined`
 * if no known lock file is found.
 */
export function getPmFromLockfile(
    cwd = process.cwd(),
): 'pnpm' | 'bun' | 'npm' | 'yarn' | undefined {
    for (const file of lockFiles) {
        if (pathExists(resolve(cwd, file.name))) {
            return file.pm;
        }
    }
    return undefined;
}

/**
 * Detects the package manager being used in the current project.
 * @param cwd - The current working directory. Defaults to `process.cwd()`.
 * @returns The detected package manager ('pnpm', 'bun', 'npm', or 'yarn'). If
 * no package manager is detected, or an unknown package manager is detected,
 * returns 'npm'.
 */
export function detectPackageManager(
    cwd = process.cwd(),
): 'pnpm' | 'bun' | 'npm' | 'yarn' {
    // First, attempt to determine the package manager from package.json
    const packageManager = getPmFromPackageJson(cwd);
    if (packageManager) {
        return packageManager;
    }

    // If not specified in package.json, check for lock files
    const typeFromLockFile = getPmFromLockfile(cwd);
    // Defaults to "npm" if no lock file or packageManager field is found
    return typeFromLockFile ?? 'npm';
}
