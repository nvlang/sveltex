// External dependencies
import { htmlTagNames } from '$deps.js';

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
