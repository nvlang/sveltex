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
            // remove comments
            .replace(/(?<=^|[^\\])((?:\\\\)*)(?<!\(\?)#.*$/gm, '$1')
            // unescape hashtags and backticks
            .replace(/(?<=^|[^\\])((?:\\\\)*)\\([#`])/gm, '$1$2')
            // remove all whitespace except for escaped spaces
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
    // const regex =
    //     /(?:<script[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>|[\s\S]+?(?=<script|<style|$))/g;

    // Trim the content to remove leading and trailing whitespace, including newlines
    content = content.trim();

    return content.match(regex) ?? [];
}
