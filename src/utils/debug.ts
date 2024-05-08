// Types
import type { Colors } from 'picocolors/types.js';

// Internal dependencies
import {
    ifPresentAndDefined,
    isArray,
    isNonNullObject,
    isOneOf,
    isPresentAndDefined,
    isString,
} from '$type-guards/utils.js';
import { fs } from '$utils/fs.js';

// External dependencies
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import pc from 'picocolors';
import ora, { Ora } from 'ora';

export type SpecialWhitespaceCharacter = '\t' | '\n' | '\r' | '\f';

export const escapedSpecialWhitespaceCharacters: Record<
    SpecialWhitespaceCharacter,
    string
> = {
    '\n': '\\n',
    '\t': '\\t',
    '\r': '\\r',
    '\f': '\\f',
};

export function escapeWhitespace(input: string): string {
    return input.replace(
        /[\n\t\r\f]/g,
        (match) =>
            escapedSpecialWhitespaceCharacters[
                match as SpecialWhitespaceCharacter
            ],
    );
}

export function time(): bigint {
    return process.hrtime.bigint();
}

export function timeSince(start: bigint): bigint {
    return process.hrtime.bigint() - start;
}

export function timeToString(time: bigint): string {
    const ms = Math.round(Number(time / BigInt(1e6)));
    let timeString: string;
    if (ms > 1000) {
        timeString = `${(ms / 1000).toFixed(2)}s`;
    } else {
        timeString = `${ms.toFixed(0)}ms`;
    }
    return timeString;
}

type PicocolorStyle = keyof Omit<Colors, 'isColorSupported'>;

function isPicocolorStyle(input: unknown): input is PicocolorStyle {
    return isString(input) && input in pc && input !== 'isColorSupported';
}

export function applyPcStyles(input: string, styles: PicocolorStyle[]): string {
    let output = input;
    const stylesReverse = styles.reverse();
    for (const style of stylesReverse) {
        output = pc[style](output);
    }
    return output;
}

type LogSeverity = 'error' | 'warn' | 'info' | 'log' | 'debug';

const defaultPcStyles: Record<LogSeverity, PicocolorStyle[]> = {
    error: ['red'],
    warn: ['yellow'],
    info: ['blue'],
    log: [],
    debug: ['dim'],
} as const;

export const consoles = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log,
    debug: console.debug,
} as const;

function isLogSeverity(input: unknown): input is LogSeverity {
    return (
        isString(input) &&
        isOneOf(input, ['error', 'warn', 'info', 'log', 'debug'])
    );
}

function isLogOptionsObject(input: unknown): input is LogOptionsObject {
    return (
        isNonNullObject(input) &&
        ifPresentAndDefined(input, 'severity', isLogSeverity) &&
        ifPresentAndDefined(
            input,
            'style',
            (style) =>
                isPicocolorStyle(style) || isArray(style, isPicocolorStyle),
        )
    );
}

interface LogOptionsObject {
    severity?: LogSeverity | undefined;
    style?: PicocolorStyle | PicocolorStyle[] | undefined;
}

type LogOptions = LogSeverity | LogOptionsObject;

function isLogOptions(input: unknown): input is LogOptions {
    return isLogSeverity(input) || isLogOptionsObject(input);
}

/**
 * Logs a message to the console with optional styling.
 *
 * @param options - The log options. If a string, it is interpreted as the
 * severity. If an object, it can contain a `severity` property (a log severity)
 * and a `style` property (a Picocolor style or an array of Picocolor styles).
 * @param args - The arguments to log.
 */
export function log(options: LogOptions, ...args: unknown[]): void;
export function log(...args: unknown[]): void;

/**
 * Logs a message with `console.log`.
 *
 * @param args - The arguments to pass to `console.log`.
 */
export function log(...args: unknown[]) {
    const possiblyOptions = args[0];
    let remainingArgs = args;
    let severity: LogSeverity = 'log';
    let style: PicocolorStyle | PicocolorStyle[] = [];

    // If the first argument is a log severity or log options object, extract
    // the severity and style, and remove the first argument from the list of
    // arguments to pass to the console logger.
    if (isLogOptions(possiblyOptions)) {
        remainingArgs = args.slice(1);
        if (isString(possiblyOptions)) {
            severity = possiblyOptions;
        } else {
            if (possiblyOptions.severity) severity = possiblyOptions.severity;
            if (possiblyOptions.style) style = possiblyOptions.style;
        }
    }

    // if (severity === 'debug') return;

    // If color is not supported or no styles are provided, log without styling
    if (
        !pc.isColorSupported ||
        (defaultPcStyles[severity].length === 0 && style.length === 0)
    ) {
        consoles[severity](...remainingArgs);
        return;
    }

    // Concatenate default styles with any additional styles the user may have
    // specified.
    const pcStyles = defaultPcStyles[severity].concat(style);

    // Log with styling
    consoles[severity](
        ...remainingArgs.map((arg) =>
            isString(arg) ? applyPcStyles(arg, pcStyles) : arg,
        ),
    );
}

export function prettifyStackTrace(stack: string): string {
    return pc.red(
        stack
            .split('\n')
            .map((line) => {
                const match = line.match(/\s*at.*\/node_modules\//);
                if (match) {
                    return pc.dim(line);
                }
                return line;
            })
            .join('\n'),
    );
}

export function prettifyError(err: unknown): string {
    if (
        isNonNullObject(err) &&
        isPresentAndDefined(err, 'stack') &&
        isString(err.stack)
    ) {
        return prettifyStackTrace(err.stack);
    }
    return inspect(err, { colors: true });
    // if (!isNonNullObject(err)) return err;
    // const arr: string[] = [];
    // if (isPresentAndDefined(err, 'stack')) {
    //     if (isString(err.stack)) {
    //         arr.push(prettifyStackTrace(err.stack));
    //     }
    //     arr.push(String(err.stack));
    // }
    // return err instanceof Error
    //     ? [err.stack, err.cause].filter(isDefined).join('\n\n')
    //     : err;
}

/**
 * Checks if a file or directory exists at the specified path.
 *
 * @param path - The path to check.
 * @returns `true` if the path exists, `false` otherwise.
 */
export function pathExists(path: string) {
    try {
        return fs.existsSync(path);
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
        const packageJsonContent = fs.readFileSync(packageJsonPath).toString();
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
    const pmFromLockFile = getPmFromLockfile(cwd);
    // Defaults to "npm" if no lock file or packageManager field is found
    return pmFromLockFile ?? 'npm';
}

export async function runWithSpinner(
    action: (spinner: Ora, startTime: bigint) => unknown,
    messages: {
        startMessage: string;
        succeedMessage: (timeTaken: string) => string;
        failMessage: (timeTaken: string, error: unknown) => string;
    },
): Promise<0 | 1> {
    const start = time();
    const spinner = ora(messages.startMessage).start();
    try {
        await action(spinner, start);
        spinner.succeed(
            pc.green(messages.succeedMessage(timeToString(timeSince(start)))),
        );
        return 0;
    } catch (err) {
        spinner.fail(
            pc.red(messages.failMessage(timeToString(timeSince(start)), err)),
        );
        log('error', prettifyError(err) + '\n\n');
        return 1;
    }
}
