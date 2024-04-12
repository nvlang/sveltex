import { htmlTagNames } from 'html-tag-names';

export function isValidComponentName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(name) && !htmlTagNames.includes(name);
}

/**
 * This function is used to "complete" a possibly "incomplete" `TexComponentConfig` object with
 * default property values.
 *
 * @param texComponentConfig - User-provided TeX component config, which may or may not have some
 * properties unset (example: `{ name: 'example' }`).
 * @param sveltexConfig - The SvelTeX configuration context within which we are working.
 * @returns A `TexComponentConfig` object with all properties that were unset in
 * texComponentConfig set to default values instead.
 *
 * @internal
 */
// export function isValidTexComponentConfig(
//     texComponentConfig: TexComponentConfig,
// ): boolean {
//     const name = texComponentConfig.name;

//     if (!isValidComponentName(name)) {
//         throw new Error(
//             `Expected 'name' to be a valid TeX component name, but got '${name}'`,
//         );
//     }

//     texComponentConfig.aliases?.forEach((alias) => {
//         if (!isValidComponentName(alias)) {
//             throw new Error(
//                 `Expected 'aliases' to only contain valid TeX component names, but found '${alias}'`,
//             );
//         }
//     });

//     return true;
// }
