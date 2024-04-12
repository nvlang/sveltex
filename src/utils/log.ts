import pc from 'picocolors';
import { Colors } from 'picocolors/types.js';
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

export function applyPcStyles(input: string, styles: PicocolorStyle[]): string {
    let output = input;
    const stylesReverse = styles.reverse();
    for (const style of stylesReverse) {
        output = pc[style](output);
    }
    return output;
}

type LogSeverity = 'error' | 'warn' | 'info' | 'log';

const defaultPcStyles: Record<LogSeverity, PicocolorStyle[]> = {
    error: ['red'],
    warn: ['yellow'],
    info: ['blue'],
    log: [],
};

export function log(
    severity: LogSeverity = 'log',
    style: PicocolorStyle | PicocolorStyle[] = [],
) {
    return (...args: unknown[]) => {
        console[severity](
            ...args.map((arg) =>
                typeof arg === 'string'
                    ? applyPcStyles(
                          arg,
                          defaultPcStyles[severity].concat(style),
                      )
                    : arg,
            ),
        );
    };
}
