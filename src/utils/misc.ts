// Internal dependencies
import { isBoolean, isNumber, isString } from '$type-guards/utils.js';
import { log } from '$utils/debug.js';
import { createHash, type BinaryToTextEncoding } from 'node:crypto';

/**
 * "Interprets" a string as a boolean, number, null, or undefined, if
 * applicable. Otherwise, returns the string as is.
 *
 * @param str - The string to interpret.
 * @returns The interpreted value.
 *
 * @example
 * // All of the below are true
 * interpretString('true') === true;
 * interpretString('false') === false;
 * interpretString('null') === null;
 * interpretString('undefined') === undefined;
 * interpretString('NaN') === NaN;
 * interpretString('Infinity') === Infinity;
 * interpretString('-Infinity') === -Infinity;
 * interpretString('5') === 5;
 * interpretString('5.5') === 5.5;
 * interpretString('something') === 'something';
 */
export function interpretString(
    str: string | undefined,
): string | number | boolean | null | undefined {
    if (str === undefined) return undefined;
    const trimmedStr = str.trim();
    switch (trimmedStr) {
        case 'true':
            return true;
        case 'false':
            return false;
        case 'null':
            return null;
        case 'undefined':
            return undefined;
        case 'NaN':
            return NaN;
        case 'Infinity':
            return Infinity;
    }
    if (trimmedStr.endsWith('Infinity')) {
        if (trimmedStr.match(/^[+]\s*Infinity$/)) {
            return +Infinity;
        }
        if (trimmedStr.match(/^[-]\s*Infinity$/)) {
            return -Infinity;
        }
    }
    if (trimmedStr.replace(/\s*/g, '').match(/^[+-]?(\d+|\d*.\d+)$/)) {
        const num = Number(trimmedStr);
        if (!isNaN(num)) {
            return num;
        }
    }
    return str;
}

/**
 * Calls {@link interpretString | `interpretString`} on each value in the given
 * object.
 *
 * @param attrs - The object whose values to interpret.
 * @returns A new object with the interpreted values.
 *
 * @example
 * ```ts
 * interpretAttributes({
 *     a: 'true',
 *     b: '5',
 *     c: 'something',
 * });
 * ```
 *
 * ...would return...
 *
 * ```ts
 * {
 *     a: true,
 *     b: 5,
 *     c: 'something',
 * }
 * ```
 */
export function interpretAttributes(
    attrs: Record<string, unknown>,
    strict: boolean = true,
): Record<string, string | number | boolean | null | undefined> {
    const rv: Record<string, string | number | boolean | null | undefined> = {};
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && !isString(value)) {
            const supportedValueType: boolean =
                isBoolean(value) ||
                isNumber(value) ||
                (value as unknown) === null;
            log(
                strict ? 'error' : 'warn',
                `Expected string for attribute \`${key}\`, but got \`${String(value)}\`. ${strict || !supportedValueType ? 'Ignoring attribute.' : 'Passing value as-is.'} (Hint: Numbers, booleans, null and undefined, if wrapped in double quotes, will be transformed back into their original types by Sveltex.)`,
            );
            if (!strict && supportedValueType)
                rv[key] = value as boolean | number | null;
        } else if (value === undefined) {
            rv[key] === value;
        } else {
            rv[key] = interpretString(value);
        }
    }
    return rv;
}

/**
 * Ensures that the given value is within the given range.
 *
 * @param value - The value to ensure is within the range.
 * @param range - The range to ensure the value is within.
 * @returns The value, constrained to the range.
 *
 * @remarks
 * This is basically just a wrapper around
 * `Math.max(range[0], Math.min(value, range[1]))`. Accordingly, you can use
 * `Infinity` and `-Infinity` to represent unbounded ranges.
 *
 * @remarks
 * If the range is invalid (i.e., `range[0] > range[1]`), this function will
 * log an error and return `NaN`.
 *
 * @example
 * ```ts
 * ensureWithinRange(5, [0, 10]); // 5
 * ensureWithinRange(-5, [0, 10]); // 0
 * ensureWithinRange(15, [0, 10]); // 10
 * ensureWithinRange(5, [-Infinity, 10]); // 5
 * ensureWithinRange(5, [0, Infinity]); // 5
 * ensureWithinRange(5, [-Infinity, Infinity]); // 5
 * ```
 */
export function ensureWithinRange(
    value: number,
    range: [number, number],
): number {
    const [min, max] = range;
    if (min > max) {
        log('error', 'Invalid range:', range);
        return NaN;
    }
    return Math.max(min, Math.min(value, max));
}

/**
 * Hash function used to generate unique references for TeX components.
 */
export function sha256(
    input: string,
    format: BinaryToTextEncoding = 'base64url',
): string {
    return createHash('sha256').update(input).digest(format);
}

/**
 * You can use the `re` template tag to create regular expressions with comments and whitespace
 * removed (simulating the `x` flag in Perl-compatible regular expressions). Escaped spaces are
 * preserved. The `re` tag also allows you to specify flags for the regular expression by inserting
 * `${flags}` at any point inside the template string.
 *
 * @example
 * ```ts
 * const regex = re`
 *     (
 *         [a-z]+   # comment
 *         | [\ ]+  # escaped space
 *     )
 *    ${'mg'}`;
 * ```
 */
export function re(strings: TemplateStringsArray, ...flags: string[]) {
    return new RegExp(
        strings.raw
            .join('')
            // Remove comments.
            .replace(/(?<=^|[^\\])((?:\\\\)*)(?<!\(\?)#.*$/gm, '$1')
            // Unescape hashtags and backticks.
            .replace(/(?<=^|[^\\])((?:\\\\)*)\\([#`])/gm, '$1$2')
            // Remove all whitespace except for escaped spaces.
            .replace(
                /(?<=^|[^\\])((?:\\\\)*)(\\[ ])|\s+/gm,
                (_match, pairsOfBackslashes, whitespace) => {
                    const pairsOfBackslashesString =
                        typeof pairsOfBackslashes === 'string'
                            ? pairsOfBackslashes
                            : '';
                    return whitespace ? pairsOfBackslashesString + ' ' : '';
                },
            ),
        flags.join(''),
    );
}

/**
 * Splits content into segments based on `<script>` and `<style>` tags,
 * including the content within these tags, and any other text outside these
 * tags.
 *
 * @param content - The HTML or text content to split into segments.
 * @returns An array of strings, where each string is either a `<script>` block,
 * a `<style>` block, or text outside these blocks.
 *
 * @remarks
 *
 * **✓ Invariant**: The following is always true:
 * ```ts
 * splitContent(content).join('') === content // always true
 * ```
 *
 * @example
 * Suppose you have the following content string:
 *
 * ```ts
 * const content = `
 * <script lang='ts'>
 * A
 * </script>
 * B
 * <style lang="postcss">
 * C
 * </style>
 * D
 * `
 * ```
 *
 * Then the output of `splitContent(content)` would be:
 *
 * ```ts
 * [
 *     "<script lang='ts'>\nA\n</script>",
 *     'B',
 *     '<style lang="postcss">\nC\n</style>',
 *     'D'
 * ]
 * ```
 */
export function splitContent(content: string): string[] {
    const regex = re`
        (?:
            <script [^>]* > .*? <\/script>  # script block
            | <style [^>]* > .*? <\/style>  # style block
            | .+? (?=<script|<style|$))
        ${'gsu'}
    `;
    return content.match(regex) ?? [];
}
