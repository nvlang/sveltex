// Types
import type { BinaryToTextEncoding } from '$deps.js';
import type { Transformer } from '$types/handlers/Handler.js';

// Internal dependencies
import { isArray, isString } from '$type-guards/utils.js';
import { log } from '$utils/debug.js';

// External dependencies
import { createHash, htmlTagNames } from '$deps.js';

/**
 * Check if a string is a valid name for a component. For this to be the case,
 * it has to not be an HTML tag name, and it has to be an alphanumeric string
 * that starts with a letter.
 *
 * @param name - The name to check.
 * @returns `true` if the name is valid, `false` otherwise.
 *
 * @example
 * ```ts
 * isValidComponentName('div'); // false
 * isValidComponentName('div2'); // true
 * isValidComponentName('MyComponent'); // true
 * ```
 */
export function isValidComponentName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(name) && !htmlTagNames.includes(name);
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
 * Ensures that a string ends with another given string.
 *
 * @param str - Some string.
 * @param postfix - The postfix to ensure the string ends with.
 * @returns `str`, with `postfix` appended if it didn't already end with it.
 *
 * @example
 * ```ts
 * ensureEndsWith('foo', '-'); // 'foo-'
 * ensureEndsWith('foo-', '-'); // 'foo-'
 * ```
 */
export function ensureEndsWith<Postfix extends string>(
    str: string,
    postfix: Postfix,
): `${string}${Postfix}` {
    return str.endsWith(postfix)
        ? (str as `${string}${Postfix}`)
        : `${str}${postfix}`;
}

/**
 * Ensures that a string ends with another given string.
 *
 * @param str - Some string.
 * @param prefix - The prefix to ensure the string starts with.
 * @returns `str`, with `prefix` prepended if it didn't already start with it.
 *
 * @example
 * ```ts
 * ensureStartsWith('foo', '-'); // '-foo'
 * ensureStartsWith('-foo', '-'); // '-foo'
 * ```
 */
export function ensureStartsWith<Prefix extends string>(
    str: string,
    prefix: Prefix,
): `${Prefix}${string}` {
    return str.startsWith(prefix)
        ? (str as `${Prefix}${string}`)
        : `${prefix}${str}`;
}

/**
 * Ensures that the given path doesn't start with a slash.
 *
 * @param path - The path to ensure doesn't start with a slash.
 * @returns The path, with the leading slash removed if it started with one.
 *
 * @example
 * ```ts
 * ensureDoesNotStartWithSlash('path/to/file'); // 'path/to/file'
 * ensureDoesNotStartWithSlash('/path/to/file'); // 'path/to/file'
 * ```
 */
export function ensureDoesNotStartWithSlash(path: string): string {
    return path.startsWith('/') ? path.slice(1) : path;
}

/**
 * @param t - The {@link Transformer | `Transformation`} to copy.
 * @returns A copy of the given transformation.
 */
export function copyTransformation<Options extends object>(
    t: Transformer<Options>,
): Transformer<Options> {
    return isArray(t)
        ? [isString(t[0]) ? t[0] : new RegExp(t[0].source, t[0].flags), t[1]]
        : t;
}

/**
 * @param t - The {@link Transformer | `Transformation`} (or array thereof)
 * to copy.
 * @returns A copy of the given transformation(s).
 */
export function copyTransformations<Options extends object>(
    t: Transformer<Options> | Transformer<Options>[],
): Transformer<Options> | Transformer<Options>[] {
    return isArray(t) && !isString(t[1])
        ? (t as Transformer<Options>[]).map(copyTransformation)
        : copyTransformation(t as Transformer<Options>);
}
