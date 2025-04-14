// File description: `remark` and `micromark` extensions to disable autolinks
// and indented code blocks. Also, `adjustHtmlSpacing` and
// `detectAndImportComponents` functions to adjust whitespace in markup and
// detect and import (some) components, respectively.

import { canBeInParagraph, canContainParagraph } from '../data/markdown.js';
import {
    hastFromHtml,
    is,
    MagicString,
    nodeAssert,
    typeAssert,
    type HastElement,
} from '../deps.js';
import { countNewlines } from '../handlers/MarkdownHandler.js';
import { isPresentAndDefined } from '../typeGuards/utils.js';
import type { ComponentInfo } from '../types/handlers/Markdown.js';
import { getLocationUnist, walkUnist } from './ast.js';

/**
 * Small remark plugin to disable indented code blocks and autolinks.
 */
export function remarkDisableIndentedCodeBlocksAndAutolinks(
    this: import('unified').Processor,
): void {
    // eslint-disable-next-line no-invalid-this
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
    id: string,
): string {
    const hast = hastFromHtml(document, { fragment: true, verbose: true });
    const lines = document.split(/\r\n?|\n/u);
    const s = new MagicString(document);
    const noParRanges: [number, number][] = [];
    walkUnist(hast, (node) => {
        if (node.type === 'element') {
            typeAssert(is<HastElement>(node));
            const loc = getLocationUnist(node, lines);
            /* v8 ignore next 1 (unreachable code) */
            if (!node.data?.position.opening) return false;
            const locOpeningTag = getLocationUnist(
                { position: node.data.position.opening },
                lines,
            );

            const match = new RegExp(node.tagName, 'iu').exec(
                document.slice(locOpeningTag.start, locOpeningTag.end),
            );
            nodeAssert(match !== null);
            const tagName = match[0].replaceAll(id, '');

            const canBeInPar = canBeInParagraph(tagName, components);

            if (!node.data.position.closing) {
                // Self-closing element

                if (!canBeInPar) {
                    s.prependRight(locOpeningTag.start, '\n\n');
                    s.appendLeft(locOpeningTag.end, '\n\n');
                }

                // Self-closing element; don't need to look any deeper.
                return false;
            }

            const locClosingTag = getLocationUnist(
                { position: node.data.position.closing },
                lines,
            );

            if (!canBeInPar) {
                s.prependRight(locOpeningTag.start, '\n\n');
                s.appendLeft(locClosingTag.end, '\n\n');
            }

            // Don't modify inner content of <pre> tags.
            if (tagName === 'pre') {
                return false;
            }

            const innerContent = document.slice(
                locOpeningTag.end,
                locClosingTag.start,
            );

            /* v8 ignore next 2 (unreachable branches due to regex format) */
            const leadingWhitespace = /^(\s*)/u.exec(innerContent)?.[0] ?? '';
            const trailingWhitespace = /(\s*)$/u.exec(innerContent)?.[0] ?? '';
            const leadingNewlines = countNewlines(leadingWhitespace);
            let prefIn = prefersInline(tagName);

            const compInfo = components.find((c) => c.name === tagName);

            if (compInfo) {
                if (compInfo.prefersInline !== undefined) {
                    prefIn = compInfo.prefersInline;
                }
            }

            const inline =
                /[^ \t\r\n][ \t]*$/u.test(
                    document.slice(0, locOpeningTag.start),
                ) ||
                /^[ \t]*[^ \t\r\n]/u.test(document.slice(locClosingTag.end));

            const noPar =
                !canContainParagraph(tagName, components) ||
                (inline &&
                    canBeInPar &&
                    (leadingNewlines === 0 ||
                        (leadingNewlines === 1 && prefIn)));

            const inNoParRange = noParRanges.some(
                ([start, end]) => loc.start >= start && loc.end <= end,
            );

            if (noPar && !inNoParRange) {
                noParRanges.push([loc.start, loc.end]);
            }

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

                // We want to avoid stuff like
                //   a<Foo>\n\nb\n\n</Foo>c
                // since that would result in
                //   <p>a <Foo></Foo></p>\n<p>b</p>\n<p>c</p>
                if (inline) {
                    s.prependRight(locOpeningTag.start, '\n\n');
                    s.appendLeft(locClosingTag.end, '\n\n');
                }
            }
        }
        return true;
    });
    return s.toString();
}

/**
 * Detects components used in the given Svelte document, sees if they're
 * imported yet, and, if not, returns lines to append to the `<script>` tag to
 * import them. Only checks for components that are present in the array from
 * the `markdown.components` SvelTeX configuration property, and have the
 * `importPath` property set therein.
 *
 * @param markup - The Svelte document to search for components in, after
 * SvelTeX's `markup` function has processed it.
 * @param components - Value of `markdown.components` SvelTeX configuration
 * property.
 * @param script - The content of the `<script>` tag in the document, split by
 * lines.
 *
 * @returns Lines to append to the `<script>` tag to import the detected and
 * not-yet-imported components.
 */
export function detectAndImportComponents(
    markup: string,
    components: ComponentInfo[],
    script: string,
    scriptAppend: string[],
): string[] {
    const append: string[] = [];
    const scriptFullStr = [script, ...scriptAppend].join('\n');
    components.forEach((componentInfo) => {
        if (
            isPresentAndDefined(componentInfo, 'name') &&
            /[A-Z][0-9_a-zA-Z]*/u.test(componentInfo.name) &&
            isPresentAndDefined(componentInfo, 'importPath') &&
            !isImported(scriptFullStr, componentInfo) &&
            isUsed(script ? markup.replace(script, '') : markup, componentInfo)
        ) {
            append.push(
                `import ${componentInfo.name} from '${componentInfo.importPath}';`,
            );
        }
    });
    return append;
}

export function isImported(
    script: string,
    componentInfo: { name: string; importPath: string },
): boolean {
    return new RegExp(
        `^\\s*import\\s*(?:\\s${componentInfo.name}\\s|\\{\\s*default as ${componentInfo.name}\\s*\\})\\s*from\\s*['"]`,
        'mu',
    ).test(script);
}

function isUsed(markup: string, componentInfo: { name: string }): boolean {
    return new RegExp(
        `<\\s*${componentInfo.name}(\\s[^>]*?)?\\s*/?>`,
        'u',
    ).test(markup);
}
