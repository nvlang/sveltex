// Types
import type {
    AdvancedTexBackend,
    CodeBackend,
    Location,
    MarkdownBackend,
    TexBackend,
} from '$types';

// Internal dependencies
import type { Sveltex } from '$sveltex-preprocess';
import { isPresentAndDefined } from '$type-guards/utils.js';
import { re, splitContent } from '$utils/misc.js';

// External dependencies
import MagicString from 'magic-string';
import { v4 as uuidv4 } from 'uuid';

/**
 * Components whose contents should be interpreted as plain text by the Svelte
 * parser.
 */
// const verbatimComponents = ['Code', 'TeX'];

// const notEscapedRegExp = re`
//     (?<=            # The opening $$ must be preceded by
//         ^           # ...the start of the line,
//         | [^\\]     # ...XOR a non-backslash character,
//     )
//     ((?:\\\\)*)     # ...AND zero or more PAIRS of backslashes.
// `;

// const notEscaped = notEscapedRegExp.source;

// function mathRegex(delim: string, endDelim: string = delim) {
//     return new RegExp(
//         notEscaped +
//             delim +
//             `((?:\\${notEscaped + '\\' + endDelim}|[^${endDelim}])+?)` +
//             notEscaped +
//             endDelim,
//         'mg',
//     );
// }

// const mathRegexes = {
//     inline: {
//         dollar: mathRegex('\\$'),
//         escapedParentheseses: mathRegex('\\(', '\\)'),
//     },
// };

/**
 * Regular expressions that should match constructs whose contents should be
 * escaped to ensure the Svelte parser interprets them as plain text. The
 * targets are:
 * - `$$`...`$$`: LaTeX display math.
 * - `$`...`$`: Inline LaTeX code.
 * - \`\`\`...\`\`\`: Code blocks.
 * - \`\`...\`\`: Inline code.
 * - \`...\`: Inline code.
 * - `<TeX>...</TeX>`, `<Code>...</Code>`, and any other components from
 *   {@link verbatimComponents | `verbatimComponents`}: Verbatim components.
 */
export const escapeRegExps = {
    /**
     * RegExp for verbatim components.
     */
    // new RegExp(
    //     `<(${verbatimComponents.join('|')})([^>]*?)>([\\s\\S]*?)<\\/\\1>`,
    //     'g',
    // ),

    /**
     * RegExp for LaTeX display math.
     */
    texDisplay: /\$\$.+\$\$/g,

    // re`
    //     (?<=            # The opening $$ must be preceded by
    //         ^           # ...the start of the line,
    //         | [^\\]     # ...XOR a non-backslash character,
    //     )
    //     (?:\\\\)*       # ...AND zero or more PAIRS of backslashes.
    //     [$]{2}

    //     ((              # Inside the display math, we may have
    //         (?<=^|[^\\])((?:\\\\)*) \\\$ # ...escaped dollar signs,
    //         | [^$]      # ...OR any character that is not a dollar sign,
    //     )+?)            # ...zero or more times.

    //     (?<=            # The closing $$ must be preceded by
    //         ^           # ...the start of the line,
    //         | [^\\]     # ...XOR a non-backslash character,
    //     )
    //     (?:\\\\)*       # ...AND zero or more PAIRS of backslashes.
    //     [$]{2}
    //                     # FLAGS
    //     ${'mg'}         # m = Multiline (^ and $ match start/end of each line)
    //                     # g = Global (don't return after first match)
    // `,

    /**
     * RegExp for inline LaTeX code.
     */
    texInline: re`
        (?<=            # The opening $ must be preceded by
            ^           # ...the start of the line,
            | [^\\]     # ...XOR a non-backslash character,
        )
        (?:\\\\)*       # ...AND zero or more PAIRS of backslashes.
        \$

        ((              # Inside the display math, we may have
            (?<=^|[^\\])((?:\\\\)*) \\\$ # ...escaped dollar signs,
            | [^$]      # ...OR any character that is not a dollar sign,
        )+?)            # ...zero or more times.

        (?<=            # The closing $ must be preceded by
            ^           # ...the start of the line,
            | [^\\]     # ...XOR a non-backslash character,
        )
        (?:\\\\)*       # ...AND zero or more PAIRS of backslashes.
        \$
                        # FLAGS
        ${'mg'}         # m = Multiline (^ and $ match start/end of each line)
                        # g = Global (don't return after first match)
    `,

    /**
     * RegExp for code blocks.
     */
    codeBlock: re`
        (?<=            # The opening backticks must be preceded by
            ^           # ...the start of the line,
            | [^\\]     # ...XOR a non-backslash character,
        )
        ((?:\\\\)*)     # ...AND zero or more PAIRS of backslashes.
        \`\`\`          # Three backticks.

        (?!\`)          # The opening backticks must not be followed by a backtick.

        (               # Inside the code block, we may have
            .           # ...any character (including newlines),
        +?)             # ...one or more times, as few times as possible.

        (?<!\`)         # The closing backticks must not be preceded by a backtick.
        \`\`\`          # Three backticks.

        (?!\`)          # The closing backticks must not be followed by a backtick.

                        # FLAGS
        ${'mgs'}        # m = Multiline (^ and $ match start/end of each line)
                        # g = Global (don't return after first match)
                        # s = Single line (. matches newline)
    `,
    /**
     * RegExp for inline code (double backtick).
     *
     * ```c
     * (?<!\\|(?<!\\)`) // Negative lookbehind: ensures first opening backtick isn't escaped,
     *                  // nor preceded by an unescaped backtick
     * ``               // Matches the opening `` for an inline code block.
     * (?!`)            // Negative lookahead: ensures the opening `` is not followed by another
     *                  // backtick.
     * ([\w\W]+?)       // Lazily matches any character, including newlines, one or more times.
     *                  // This captures the content of the inline code.
     * (?<!`)``(?!`)    // Matches the closing ``, ensuring it is properly closed and not part of a
     *                  // larger code block or escaped.
     * ```
     */
    codeInlineDoubleBacktick: /(?<!\\|(?<!\\)`)``(?!`)([\w\W]+?)(?<!`)``(?!`)/g,

    /**
     * RegExp for inline code (single backtick).
     *
     * ```c
     * (?<!\\|(?<!\\)`) // Negative lookbehind: ensures opening backtick isn't
     *                  // escaped, nor preceded by an unescaped backtick
     * `                // Matches the opening ` for an inline code.
     * ([^`]+?)         // Lazily matches any character except a backtick, one or more times.
     *                  // This captures the content of the inline code.
     * (?<!`)`(?!`)     // Matches the closing ` for an inline code, ensuring it is properly closed
     *                  // and not part of a larger code block or escaped.
     * ```
     */
    codeInlineSingleBacktick: /(?<!\\|(?<!\\)`)`([^`]+?)(?<!`)`(?!`)/g,
};

/**
 * "Escapes" LaTeX code, code blocks, inline code, and other constructs whose
 * contents could mess with the Svelte parser, so that the Svelte parser will
 * interpret them as plain text.
 *
 * By "escaping", we mean replacing the string with a UUIDv4, and storing the
 * original string in a map. This way, we can restore the original string after
 * the Svelte parser has done its job.
 *
 * @param content - Contents of a `.sveltex` file, without frontmatter.
 * @returns
 * - `escapedContent`: The escaped content.
 * - `savedMatches`: A map of the escaped matches.
 * - `map`: A source map.
 *
 * @example
 * ```ts
 * const { content, savedMatches } =
 *     escape('This is a $$\\LaTeX$$ equation.');
 * // content = 'This is a 123e4567-e89b-12d3-a456-426614174000 equation.'
 * // savedMatches = { '123e4567-e89b-12d3-a456-426614174000': '$$\\LaTeX$$' }
 * // map = { ... }
 * ```
 * NB: In an actual SvelTeX file, the user would write `$$\LaTeX$$` instead of `$$\\LaTeX$$`.
 */
export function escapeVerb<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(
    sveltex: Sveltex<M, C, T, A>,
    content: string,
    filename?: string,
    hires: boolean | 'boundary' = 'boundary',
) {
    const verbEnvsConfig = sveltex.configuration.verbatim.verbatimEnvironments;
    const verbEnvs = Object.keys(verbEnvsConfig).flatMap((env) => {
        const description = verbEnvsConfig[env];
        if (description && isPresentAndDefined(description, 'aliases')) {
            return [env, ...description.aliases];
        }
        return [env];
    });
    const texComponents = [
        ...sveltex.advancedTexHandler.tccNames,
        ...sveltex.advancedTexHandler.tccAliases,
    ];
    const verbatimTags: string[] = [...verbEnvs, ...texComponents];

    const regexps = [
        escapeRegExps.texDisplay,
        escapeRegExps.texInline,
        escapeRegExps.codeBlock,
        escapeRegExps.codeInlineDoubleBacktick,
        escapeRegExps.codeInlineSingleBacktick,
    ];

    if (verbatimTags.length > 0) {
        regexps.unshift(
            new RegExp(
                `<(${verbatimTags.join('|')})([^>]*?)>([\\s\\S]*?)<\\/\\1>`,
                'g',
            ),
            new RegExp(`<(${verbatimTags.join('|')})([^>]*?)\\/>`, 'g'),
        );
    }

    /**
     * A map of the escaped matches, where the key is a UUIDv4 and the value is
     * the original match.
     */
    const savedMatches = new Map<string, string>();
    const s = new MagicString(content);

    /**
     * The index of the first character of the current section within the
     * {@link content | `content`} string.
     */
    let offset = 0;

    // Split the content into sections based on script and style tags
    const sections = splitContent(content);

    // Escape the markup sections with `escapeMarkupSection`
    sections.forEach((section) => {
        if (sectionType(section) === 'markup') {
            escapeVerbInMarkup(section, savedMatches, s, offset, regexps);
        }
        // Update the offset to the end of the current section
        offset += section.length;
    });

    const escapedContent = s.toString();
    const source = filename ? { source: filename } : {};
    const map = s.generateMap({ ...source, hires, includeContent: true });

    return { escapedContent, savedMatches, map };
}

/**
 * "Unescapes" content.
 *
 * @param content - Escaped content.
 * @param savedMatches - A map of the escaped matches, where the key is a UUIDv4
 * and the value is the original match.
 * @param removeParagraphTag - *Optional:* A function that returns `true` if the
 * paragraph tag surrounding the escaped string, if any, should be removed, and
 * `false` otherwise. The default is a function that always returns `true`.
 * @returns The original content, with the escaped matches restored.
 */
export function unescape(
    content: string,
    savedMatches: Map<string, string>,
    removeParagraphTag: (code: string) => boolean = () => true,
): string {
    // Replace the UUIDs with the original matches
    let unescaped = content;
    savedMatches.forEach((match, uuid) => {
        // Escaped content is usually not "inline", and so it often doesn't make
        // sense to have it wrapped in a paragraph tag. However, because the
        // markdown processor ran while the content was escaped to a plaintext
        // UUIDv4, it may have added paragraph tags. Hence, we remove them here.
        if (removeParagraphTag(match)) {
            unescaped = unescaped.replace(
                new RegExp(`<p>\\s*${uuid}\\s*</p>|${uuid}`, 'u'),
                match,
            );
        } else {
            unescaped = unescaped.replace(uuid, match);
        }
    });
    return unescaped;
}

/**
 * The type of a section of a "content string".
 */
type SectionType = 'script' | 'style' | 'markup';

/**
 * Returns the type of a section of a "content string".
 */
export function sectionType(section: string): SectionType {
    if (section.trimStart().toLowerCase().startsWith('<script')) {
        return 'script';
    } else if (section.trimStart().toLowerCase().startsWith('<style')) {
        return 'style';
    } else {
        return 'markup';
    }
}

/**
 * Given a markup string, "escapes" LaTeX code, code blocks, inline code, and
 * other constructs whose contents could mess with the Svelte parser, so that
 * the Svelte parser will interpret them as plain text.
 *
 * By "escaping", we mean replacing the string with a UUIDv4, and storing the
 * original string in a map. This way, we can restore the original string after
 * the Svelte parser has done its job.
 *
 * @param markup - The markup to escape.
 * @param savedMatches - A map to which the escaped matches should be added.
 * @param s - The MagicString instance whose string representation contains (but
 * is not necessarily equal to) the `markup` parameter.
 * @param startOffset - The offset of the `markup` parameter in the string
 * representation of `s`.
 * @param regExps - Regular expressions that should match constructs whose
 * contents should be escaped by this function.
 *
 * @remarks
 * Modifies `s` and `savedMatches` in-place.
 *
 * @example
 * ```ts
 * const { markup, savedMatches } =
 *     escape('This is a $$\\LaTeX$$ equation.');
 * // markup = 'This is a 123e4567-e89b-12d3-a456-426614174000 equation.'
 * // savedMatches = { '123e4567-e89b-12d3-a456-426614174000': '$$\\LaTeX$$' }
 * ```
 * NB: In an actual SvelTeX file, the user would write `$$\LaTeX$$` instead of
 * `$$\\LaTeX$$`.
 */
export function escapeVerbInMarkup(
    markup: string,
    savedMatches: Map<string, string>,
    s: MagicString,
    startOffset: number,
    regExps: RegExp[],
): void {
    const matchedRanges: (Location & { content: string })[] = [];
    regExps.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(markup)) !== null) {
            matchedRanges.push({
                start: startOffset + match.index,
                end: startOffset + match.index + match[0].length,
                content: match[0],
            });
        }
    });
    const ranges = outermostRanges(matchedRanges);
    ranges.forEach((range) => {
        const id = uuidv4();
        savedMatches.set(id, range.content);
        s.overwrite(range.start, range.end, id);
    });
}

/**
 * Given an array of ranges, returns an array of the "outermost" ranges.
 *
 * @param ranges - An array of ranges.
 * @returns An array of the outermost ranges, sorted by increasing `start`
 * value.
 *
 * @remarks The returned ranges will be pairwise disjoint.
 * @remarks The returned ranges will be sorted by increasing `start` value.
 * @remarks The order in which the ranges are passed to this function doesn't
 * matter.
 *
 * @example
 * ```ts
 * const ranges = [
 *     { start: 0, end: 100 }, // outermost
 *     { start: 10, end: 20 },
 *     { start: 50, end: 150 },
 *     { start: 120, end: 130 }, // outermost
 * ]
 * console.log(outermostRanges(ranges));
 * // [
 * //     { start: 0, end: 100 },
 * //     { start: 120, end: 130 },
 * // ]
 * ```
 *
 * @example Adjacent ranges:
 * ```ts
 * const ranges = [
 *     { start: 0, end: 1 }, // outermost
 *     { start: 1, end: 2 }, // outermost
 * ]
 * console.log(outermostRanges(ranges));
 * // [
 * //     { start: 0, end: 1 },
 * //     { start: 1, end: 2 },
 * // ]
 * ```
 *
 * @example Ranges with smaller start points have precedence:
 * ```ts
 * const ranges = [
 *     { start: 0, end: 2 }, // outermost
 *     { start: 1, end: 10 },
 * ]
 * console.log(outermostRanges(ranges));
 * // [ { start: 0, end: 2 } ]
 * ```
 *
 * @example If two ranges start at the same point, the larger range will be
 * picked:
 * ```ts
 * const ranges = [
 *     { start: 0, end: 1 },
 *     { start: 0, end: 2 }, // outermost
 * ]
 * console.log(outermostRanges(ranges));
 * // [ { start: 0, end: 2 } ]
 * ```
 */
export function outermostRanges<Range extends Location>(
    ranges: Range[],
): Range[] {
    const sortedRanges = ranges.sort((a, b) => {
        const startDiff = a.start - b.start;
        if (startDiff !== 0) return startDiff;
        return b.end - a.end; // Prefer larger ranges
    });
    const outermostRanges: Range[] = [];
    let currentPos = 0;
    for (const range of sortedRanges) {
        if (range.start >= currentPos) {
            outermostRanges.push(range);
            currentPos = range.end;
        }
    }
    return outermostRanges;
}

export function intersection(a: Location, b: Location): Location | null {
    const min = a.start < b.start ? a : b;
    const max = min == a ? b : a;
    if (min.end < max.start) return null;
    return { start: max.start, end: min.end < max.end ? min.end : max.end };
}

export function escapeMustacheTags(
    content: string,
    ranges: Location[],
    filename: string,
    hires: boolean | 'boundary' = 'boundary',
) {
    /**
     * A map of the escaped matches, where the key is a UUIDv4 and the value is
     * the original match.
     */
    const savedMatches = new Map<string, string>();
    const s = new MagicString(content);

    // Escape mustache tags
    ranges.forEach((range) => {
        const match = content.slice(range.start, range.end);
        const id = uuidv4();
        savedMatches.set(id, match);
        s.overwrite(range.start, range.end, id);
    });

    const escapedContent = s.toString();
    const map = s.generateMap({
        source: filename,
        hires,
        includeContent: true,
    });

    return { escapedContent, savedMatches, map };
}

export function escapeBraces(content: string) {
    return content.replaceAll('{', '&lbrace;').replaceAll('}', '&rbrace;');
}

export const uniqueEscapeSequences = {
    '<': uuidv4(),
    '>': uuidv4(),
    '{': uuidv4(),
    '}': uuidv4(),
} as const;

// /**
//  * Escape HTML special characters and curly brackets.
//  *
//  * TODO: Make this safer (see https://npmjs.com/package/html-escaper)
//  */
// export function escapeSvelteSpecialChars(
//     content: string,
//     customEscapeSequences: boolean = false,
// ) {
//     return content
//         .replaceAll(
//             '{',
//             customEscapeSequences ? '&lbrace;' : uniqueEscapeSequences['{'],
//         )
//         .replaceAll(
//             '}',
//             customEscapeSequences ? '&rbrace;' : uniqueEscapeSequences['}'],
//         )
//         .replaceAll(
//             '<',
//             customEscapeSequences ? '&lt;' : uniqueEscapeSequences['<'],
//         )
//         .replaceAll(
//             '>',
//             customEscapeSequences ? '&gt;' : uniqueEscapeSequences['>'],
//         );
// }

/**
 * Replace custom escape sequences with their HTML equivalents.
 *
 * TODO: Make this safer (see https://npmjs.com/package/html-escaper)
 */
export function customEscapeSequencesToHtml(escapedContent: string) {
    return escapedContent
        .replaceAll(uniqueEscapeSequences['<'], '&lt;')
        .replaceAll(uniqueEscapeSequences['>'], '&gt;')
        .replaceAll(uniqueEscapeSequences['{'], '&lbrace;')
        .replaceAll(uniqueEscapeSequences['}'], '&rbrace;');
}

// /**
//  *
//  */
// export function rangesForSvelteEscape(content: string) {
//     let match;
//     const locationsOfSpecialChars = new Map<string, Location[]>();
//     while ((match = /[<>{}]/g.exec(content)) !== null) {
//         const char: string = match[0];
//         const loc: Location = {
//             start: match.index,
//             end: match.index + match[0].length,
//         };
//         if (locationsOfSpecialChars.has(char)) {
//             locationsOfSpecialChars.get(char)?.push(loc);
//         } else {
//             locationsOfSpecialChars.set(char, [loc]);
//         }
//     }
//     return locationsOfSpecialChars;
// }

// export const svelteEscapeStrings: Record<string, string> = {
//     '&': '&amp;',
//     '<': '&lt;',
//     '>': '&gt;',
//     '"': '&quot;',
//     "'": '&#39;',
//     '{': '&lbrace;',
//     '}': '&rbrace;',
// };

// export function svelteEscapeString(char: string) {
//     return svelteEscapeStrings[char] ?? char;
// }
