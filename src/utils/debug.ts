// Types
import type { Colors, Ora } from '$deps.js';

// Internal dependencies
import {
    ifPresentAndDefined,
    isArray,
    isNonNullObject,
    isOneOf,
    isPresentAndDefined,
    isString,
} from '$typeGuards/utils.js';

// External dependencies
import { inspect, ora, pc } from '$deps.js';

type SpecialWhitespaceCharacter = '\t' | '\n' | '\r' | '\f';

const escapedSpecialWhitespaceCharacters: Record<
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

function applyPcStyles(input: string, styles: PicocolorStyle[]): string {
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
    /**
     * @defaultValue `'log'`
     */
    severity?: LogSeverity | undefined;
    style?: PicocolorStyle | PicocolorStyle[] | undefined | null;
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
    let style: PicocolorStyle | PicocolorStyle[] | null = [];

    // If the first argument is a log severity or log options object, extract
    // the severity and style, and remove the first argument from the list of
    // arguments to pass to the console logger.
    if (isLogOptions(possiblyOptions)) {
        remainingArgs = args.slice(1);
        if (isString(possiblyOptions)) {
            severity = possiblyOptions;
        } else {
            if (possiblyOptions.severity) severity = possiblyOptions.severity;
            if (possiblyOptions.style !== undefined) {
                style = possiblyOptions.style;
            }
        }
    }

    // if (severity === 'debug') return;

    // If color is not supported or no styles are provided, log without styling
    if (
        !pc.isColorSupported ||
        style === null ||
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

function prettifyStackTrace(stack: string): string {
    return pc.red(
        stack
            .split('\n')
            .map((line) => {
                const match = /\s*at\s.*\/node_modules\//.exec(line);
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

export async function runWithSpinner(
    action: (spinner: Ora, startTime: bigint) => unknown,
    messages: {
        startMessage: string;
        successMessage: (timeTaken: string) => string;
        failMessage?: (timeTaken: string, error: unknown) => string;
    },
    failureValues?: unknown[],
): Promise<0 | 1> {
    const start = time();
    const spinner = ora(messages.startMessage).start();
    let code: 0 | 1 = 0;
    let error: unknown;
    try {
        const res = await action(spinner, start);
        if (failureValues?.includes(res)) code = 1;
    } catch (err) {
        code = 1;
        error = err;
        log('error', prettifyError(err) + '\n\n');
    }
    if (code === 0) {
        spinner.succeed(
            pc.green(messages.successMessage(timeToString(timeSince(start)))),
        );
    } else {
        spinner.fail(
            pc.red(
                messages.failMessage
                    ? messages.failMessage(
                          timeToString(timeSince(start)),
                          error,
                      )
                    : prettifyError(error),
            ),
        );
    }
    return code;
}
