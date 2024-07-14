// File description: `remark` and `micromark` extensions to disable autolinks
// and indented code blocks.

import { canBeInParagraph, canContainParagraph } from '$data/markdown.js';
import {
    hastFromHtml,
    inspect,
    is,
    MagicString,
    typeAssert,
    type HastElement,
} from '$deps.js';
import { countNewlines } from '$handlers/MarkdownHandler.js';
import type { ComponentInfo } from '$types/handlers/Markdown.js';
import { getLocationUnist, walkUnist } from '$utils/ast.js';
import { re } from '$utils/misc.js';

/**
 * Small remark plugin to disable indented code blocks and autolinks.
 */
export function remarkDisableIndentedCodeBlocksAndAutolinks(
    this: import('unified').Processor,
): void {
    const data = this.data();
    const micromarkExtensions =
        data.micromarkExtensions ?? (data.micromarkExtensions = []);
    micromarkExtensions.push(micromarkDisableIndentedCodeAndAutolinks);
}

/**
 * Small micromark extension to disable indented code blocks and autolinks.
 *
 * @remarks
 * The names come from `import('micromark-util-types').TokenTypeMap`.
 */
export const micromarkDisableIndentedCodeAndAutolinks: object = {
    disable: {
        null: [
            'codeIndented',
            'autolink',
            'autolinkEmail',
            'autolinkMarker',
            'autolinkProtocol',
        ],
    },
};

export function adjustHtmlSpacing(
    document: string,
    prefersInline: (tag: string) => boolean,
    components: ComponentInfo[],
): string {
    const hast = hastFromHtml(document, { fragment: true, verbose: true });
    const lines = document.split(/\r\n?|\n/);
    const s = new MagicString(document);
    const noParRanges: [number, number][] = [];
    walkUnist(hast, (node) => {
        if (node.type === 'element') {
            typeAssert(is<HastElement>(node));
            const loc = getLocationUnist(node, lines);
            if (!node.data?.position.opening || !node.data.position.closing) {
                // Self-closing element; don't need to look any deeper.
                return false;
            }
            const locOpeningTag = getLocationUnist(
                { position: node.data.position.opening },
                lines,
            );
            const locClosingTag = getLocationUnist(
                { position: node.data.position.closing },
                lines,
            );
            const innerContent = document.slice(
                locOpeningTag.end,
                locClosingTag.start,
            );
            if (node.tagName === 'pre') {
                return false;
            }
            const leadingWhitespace = /^\s*/.exec(innerContent)?.[0] ?? '';
            const trailingWhitespace = /(\s*)$/.exec(innerContent)?.[0] ?? '';
            const leadingNewlines = countNewlines(leadingWhitespace);
            let prefIn = prefersInline(node.tagName);
            let noPar = !canContainParagraph(node.tagName);

            console.log({ noPar, node });

            const compInfo = components.find((c) => c.name === node.tagName);

            if (compInfo) {
                if (['all', 'sectioning'].includes(compInfo.type as string)) {
                    noPar = false;
                } else if (
                    ['phrasing', 'none'].includes(compInfo.type as string)
                ) {
                    noPar = true;
                }
                if (compInfo.prefersInline !== undefined) {
                    prefIn = compInfo.prefersInline;
                }
            }

            const inNoParRange = noParRanges.some(
                ([start, end]) => loc.start >= start && loc.end <= end,
            );

            if (noPar && !inNoParRange) {
                noParRanges.push([loc.start, loc.end]);
            }

            console.log(
                inspect(
                    {
                        hast,
                        compInfo,
                        prefIn,
                        prefersInline: prefersInline.toString(),
                        noPar,
                        inNoParRange,
                        noParRanges,
                        document,
                    },
                    { depth: 10 },
                ),
            );

            if (
                noPar ||
                inNoParRange ||
                leadingNewlines === 0 ||
                (leadingNewlines === 1 && prefIn)
            ) {
                // Trim whitespace to make sure inner content won't be wrapped
                // in <p> tags by markdown processor.
                const innerContentTrimmed = innerContent.trim();
                if (innerContentTrimmed !== innerContent) {
                    if (leadingWhitespace.length > 0) {
                        s.overwrite(
                            locOpeningTag.end,
                            locOpeningTag.end + leadingWhitespace.length,
                            '',
                        );
                    }
                    if (trailingWhitespace.length > 0) {
                        s.overwrite(
                            locClosingTag.start - trailingWhitespace.length,
                            locClosingTag.start,
                            '',
                        );
                    }
                }
            } else {
                // Pad with newlines to make sure inner content will be wrapped
                // in <p> tags by markdown processor (if it's not already within
                // a paragraph), and also to ensure that the inner content gets
                // processed by the markdown processor at all.
                s.prependRight(locOpeningTag.end, '\n\n');
                s.appendLeft(locClosingTag.start, '\n\n');
            }

            const canBeInPar = canBeInParagraph(node.tagName);
            if (!canBeInPar) {
                s.prependRight(locOpeningTag.start, '\n\n');
                s.appendLeft(locClosingTag.end, '\n\n');
            }
        }
        return true;
    });
    return s.toString();
}

// function isWhitespace(str: unknown): str is ' ' | '\n' | '\t' | '\r' {
//     return str === ' ' || str === '\n' || str === '\t' || str === '\r';
// }

export function removeBadParagraphs(content: string): string {
    return content;
}

/**
 * Regular expression for parsing a component from an HTML string. The regular
 * expression has six capture groups:
 *
 * 1. Opening tag *(required)*
 * 2. Tag name *(required)*
 * 3. Closing slash (*optional;* `/` or empty string) (present iff tag is
 *    self-closing)
 * 4. Leading whitespace in inner content *(optional)*
 *
 * @see {@link parseComponent | `parseComponent`}
 */
export const componentRegExp: RegExp = re`
    ^                               # (start of string)
    (                               # 1: opening tag
        <                           # (opening angle bracket)
            \s*                     # (optional whitespace)
            (                       # 2: tag name
                [a-zA-Z]            # (first character)
                [-.:0-9_a-zA-Z]*    # (remaining characters)
            )
            (?:                     # -: attributes
                (?:                 # -: optional attribute(s)
                    \s              # (mandatory whitespace)
                    [^>]*?          # (any character except '>', lazy)
                    (?:             # -: quoted attribute values (optional)
                        (?:'[^']*')
                      | (?:"[^"]*")
                    )?
                )*
            )
            \s*                     # (optional whitespace)
            (                       # 3: optional closing slash
                \/?                 # (optional slash)
            )
        >
    )
    (                           # 4: optional leading whitespace
        \s*                     # (whitespace character, ≥0, greedy)
    )
    (?:                         # -: inner content (optional)
        .*?                     # (any character, incl. newlines; lazy, so that
                                # it doesn't eat the closing tag)
    )
    (?:                         # -: closing tag (optional)
        (?:                     # -: optional closing tag
            <                   # (opening angle bracket)
            /                   # (leading slash)
            \s*                 # (optional whitespace)
            \2                  # (tag name backreference)
            \s*                 # (optional whitespace)
            >                   # (closing angle bracket)
        )?
    )
    \s*                         # (optional trailing whitespace)

                                # FLAGS
    ${'su'}                     # s = Single line (dot matches newline)
                                # u = Unicode support
`;
