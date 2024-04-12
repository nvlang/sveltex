import YAML from 'yaml';
import { Frontmatter } from '$types';
import { isFrontmatter } from '$type-guards';
import { log } from '$utils';

/**
 * Consume frontmatter from a string.
 *
 * @param content - Contents of a `.sveltex` file, with frontmatter.
 * @returns
 * - Original content, but without the frontmatter.
 * - The frontmatter as a JavaScript object.
 *
 * @example
 * ```ts
 * const content = `
 * ---
 * title: "Hello, world!"
 * author: "John Doe"
 * ---
 * <p>Hello, world!</p>
 * `;
 * const { contentWithoutFrontmatter, frontmatter } = consumeFrontmatter(content);
 * console.log(contentWithoutFrontmatter); // <p>Hello, world!</p>
 * console.log(frontmatter); // { title: "Hello, world!", author: "John Doe" }
 * ```
 */
export function consumeFrontmatter(contentWithFrontmatter: string): {
    contentWithoutFrontmatter: string;
    frontmatter: Frontmatter;
} {
    const frontmatterRegex =
        /^\s*((?:<!--(?:(?!(?:<!--|-->)).)*?-->\s*?)*)\s*^---[ ]*$\s*(.+?)\s*^---[ ]*$\s*/msu;
    const match = contentWithFrontmatter.match(frontmatterRegex);

    if (match) {
        // The first match group is the pre-frontmatter HTML comments. It's
        // guaranteed to exist, even if it's an empty string, so we could add a
        // non-null assertion operator (`!`) to the end of the match group. But
        // we'll use the nullish coalescing operator (`??`) instead and exclude
        // that branch from coverage, since it's unreachable.
        /* v8 ignore next */
        const preFrontmatterHtmlComments = match[1] ?? '';
        const interWhitespace = preFrontmatterHtmlComments !== '' ? '\n\n' : '';
        const frontmatterContent = match[2];

        /* v8 ignore next 11 */
        if (frontmatterContent === undefined) {
            log('warn')(
                "SvelTeX Warning: RegExp detected frontmatter, but the frontmatter's match group" +
                    ' is undefined. This is likely a bug in SvelTeX. Please report it at' +
                    ' https://github.com/nvlang/sveltex/issues. Thank you!',
            );
            return {
                contentWithoutFrontmatter: contentWithFrontmatter,
                frontmatter: {},
            };
        }

        const parsedFrontmatter: unknown = YAML.parse(frontmatterContent);
        const frontmatter: Frontmatter = isFrontmatter(parsedFrontmatter)
            ? parsedFrontmatter
            : {};
        const contentWithoutFrontmatter =
            preFrontmatterHtmlComments +
            interWhitespace +
            contentWithFrontmatter.substring(match[0].length);

        return { contentWithoutFrontmatter, frontmatter };
    }

    return {
        contentWithoutFrontmatter: contentWithFrontmatter,
        frontmatter: {},
    };
}
