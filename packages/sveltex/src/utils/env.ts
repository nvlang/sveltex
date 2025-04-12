// File description: Read `package.json` and parse version numbers and the package manager being used.

// Internal dependencies
import { process, resolve } from '../deps.js';
import { getDefaultCacheDirectory } from '../base/defaults.js';
import { log, prettifyError } from './debug.js';
import { fs, pathExists } from './fs.js';

/**
 * Array to keep track of missing dependencies
 */
export const missingDeps: string[] = [];

/**
 * Gets the version of the specified package.
 */
export async function getVersion(pkg: string): Promise<string | undefined> {
    let backendVersion: string | undefined;
    try {
        const prefix =
            /(.*?)\/node_modules/.exec(getDefaultCacheDirectory())?.[1] ?? '';
        const path = resolve(prefix, 'node_modules', pkg, 'package.json');
        const fileContents = await fs.readFile(path, 'utf-8');
        if (fileContents) {
            const json = JSON.parse(fileContents) as { version?: string };
            if (json.version) backendVersion = json.version;
        }
    } catch (err) {
        backendVersion = undefined;
        log(
            'error',
            `Error getting ${pkg} version:\n\n${prettifyError(err)}\n\n`,
        );
    }
    return backendVersion;
}

/**
 * Retrieves the package manager from the package.json file.
 * @param cwd - The current working directory. Defaults to `process.cwd()`.
 * @returns The package manager ('pnpm', 'bun', 'npm', or 'yarn'), or
 * `undefined` if not found (or unknown package manager is found).
 */
export async function getPmFromPackageJson(
    cwd = process.cwd(),
): Promise<'pnpm' | 'bun' | 'npm' | 'yarn' | undefined> {
    const packageJsonPath = resolve(cwd, 'package.json');
    if (pathExists(packageJsonPath)) {
        const packageJsonContent = (
            await fs.readFile(packageJsonPath)
        ).toString();
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
export async function detectPackageManager(
    cwd = process.cwd(),
): Promise<'pnpm' | 'bun' | 'npm' | 'yarn'> {
    // First, attempt to determine the package manager from package.json
    const packageManager = await getPmFromPackageJson(cwd);
    if (packageManager) {
        return packageManager;
    }

    // If not specified in package.json, check for lock files
    const pmFromLockFile = getPmFromLockfile(cwd);
    // Defaults to "npm" if no lock file or packageManager field is found
    return pmFromLockFile ?? 'npm';
}
