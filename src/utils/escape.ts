// Types
import type { Offsets } from '$types/utils/Ast.js';
import type {
    EscapableSnippet,
    EscapedSnippet,
    PaddingInstruction,
    ProcessedSnippet,
    Snippet,
    TexEscapeSettings,
} from '$types/utils/Escape.js';

// Internal dependencies
import { isArray, isOneOf, isString } from '$type-guards/utils.js';
import { getLocationUnist, walkMdast } from '$utils/ast.js';
import { parseComponent } from '$utils/parseComponent.js';

// External dependencies
import {
    MagicString,
    MdastCodeNode,
    MdastInlineCodeNode,
    MdastInlineMathNode,
    MdastMathNode,
    MdastMdxFlowExpressionNode,
    MdastMdxTextExpressionNode,
    MdastRoot,
    XRegExp,
    typeAssert,
    getKey,
    is,
    mdastFromMarkdown,
    mdastMathFromMarkdown,
    mdastMdxExpressionFromMarkdown,
    micromarkMath,
    micromarkMdxExpression,
    micromarkMdxJsx,
    micromarkMdxMd,
    nodeAssert,
    uuid,
} from '$deps.js';
import { micromarkSkip } from '$utils/micromark/syntax.js';
import { getDefaultSveltexConfig } from '$config/defaults.js';

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
export function outermostRanges<
    PositionProperty extends string | undefined,
    Range extends PositionProperty extends undefined ? Offsets : object,
>(ranges: Range[], positionProperty?: PositionProperty): Range[] {
    const getLoc: (range: Range) => Offsets = (range) =>
        positionProperty ? getKey(range, positionProperty) : (range as Offsets);
    const sortedRanges = ranges.sort((a, b) => {
        const startDiff = getLoc(a).start - getLoc(b).start;
        if (startDiff !== 0) return startDiff;
        return getLoc(b).end - getLoc(a).end; // Prefer larger ranges
    });
    const outermostRanges: Range[] = [];
    let currentPos = 0;
    for (const range of sortedRanges) {
        if (getLoc(range).start >= currentPos) {
            outermostRanges.push(range);
            currentPos = getLoc(range).end;
        }
    }
    return outermostRanges;
}

/**
 *
 */
export function escapeBraces(content: string) {
    return content.replaceAll('{', '&lbrace;').replaceAll('}', '&rbrace;');
}

export const uniqueEscapeSequences = {
    '<': uuid(),
    '>': uuid(),
    '{': uuid(),
    '}': uuid(),
} as const;

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

// 1. escape verbatim tags
// 2. escape script and style tags
// 3. run parser as above
// 4. escape content with type
//     - 'math' -> process with TexHandler
//     - 'inlineMath' -> process with TexHandler
//     - 'code' -> process with CodeHandler
//     - 'inlineCode' -> process with CodeHandler
//     - 'mdxTextExpression' -> unescape later, no processing required (however,
//       check if it's a mustache tag, and, if not, remove surrounding
//       <p>...</p> tag, if present, after unescaping)
//     - 'mdxFlowExpression' -> unescape later, no processing required (however,
//       check if it's a mustache tag, and, if not, remove surrounding
//       <p>...</p> tag, if present, after unescaping)

export function escapeStringForRegExp(str: string) {
    return str.replace(/([.*+?^${}()|[\]\\-])/gu, '\\$1');
}

function normalComponentsRegExp(rawTags: string[]): RegExp {
    nodeAssert(
        rawTags.length !== 0,
        'Empty tags array passed to regularTagsRegExp',
    );
    const tags = rawTags.map(escapeStringForRegExp).map((s) => s.trim());
    const r = XRegExp(
        `
            <                       # (opening delimiter of opening tag)
            (                       # 1: opening tag name
                ${tags.join('|')}   # (opening tag name)
            )
            (                       # 2: attributes
                (?:                 # -: optional attribute(s)
                    \\s              # (mandatory whitespace)
                    [^>]*?          # (any character except '>', lazy)
                    (?:
                        (?:         # -: single-quoted attribute value
                            '[^']*' # (any characters except "'", surrounded by "'"s)
                        )
                        | (?:       # -: double-quoted attribute value
                            "[^"]*" # (any characters except '"', surrounded by '"'s)
                        )
                    )?
                )*
            )
            >                       # (closing delimiter of opening tag)
            (                       # -: tag content
                .*?                 # (any character, incl. newlines, ≥0, lazy)
            )
            </                      # (opening delimiter of closing tag)
            \\s*                     # (optional whitespace)
            \\1                      # (backreference to opening tag name)
            \\s*                     # (optional whitespace)
            >                       # (closing delimiter of closing tag)
        `,
        'gsux',
    );
    return r;
}

function normalAndSelfClosingComponentsRegExp(rawTags: string[]): RegExp {
    nodeAssert(
        rawTags.length !== 0,
        'Empty tags array passed to allTagsRegExp',
    );
    const tags = rawTags.map(escapeStringForRegExp).map((s) => s.trim());
    return XRegExp(
        `
            <                       # (opening delimiter of opening tag)
            (                       # 1: opening tag name
                ${tags.join('|')}   # (opening tag name)
            )
            (                       # 2: attributes
                (?:                 # -: optional attribute(s)
                    \\s             # (mandatory whitespace)
                    [^>]*?          # (any character except >, lazy)
                    (?:             # -: quoted attribute value
                        (?:         # -: single-quoted attribute value
                            '       # (opening single quotation mark)
                            [^']*?  # (any character except single quotation mark, ≥0, lazy)
                            '       # (closing single quotation mark)
                        )
                        | (?:       # -: double-quoted attribute value
                            "       # (opening double quotation mark)
                            [^"]*?  # (any character except double quotation mark, ≥0, lazy)
                            "       # (closing double quotation mark)
                        )
                    )?
                )*?
            )
            \\s*?
            (?:
                />                  # (self-closing tag)
                | (?:               # -: "regular" tag
                    >               # (closing delimiter of opening tag)
                    (               # -: tag content
                        .*?         # (any character, incl. newlines, ≥0, lazy)
                    )
                    </              # (opening delimiter of closing tag)
                    \\s*            # (optional whitespace)
                    \\1             # (backreference to opening tag name)
                    \\s*            # (optional whitespace)
                    >               # (closing delimiter of closing tag)
                )
            )
        `,
        'gsux',
    );
}

/**
 *
 */
function getVerbatimES(
    content: string,
    verbatimTags: string[],
): EscapableSnippet<'verbatim'>[] {
    const es: EscapableSnippet<'verbatim'>[] = [];
    if (verbatimTags.length === 0) return es;
    const escapedVerbatimTags = verbatimTags.map((t) =>
        t.replaceAll(':', colonUuid),
    );
    const verbatimTagsRegExp =
        normalAndSelfClosingComponentsRegExp(escapedVerbatimTags);
    for (const match of content.matchAll(verbatimTagsRegExp)) {
        const outerContent = match[0];
        const { tag, attributes, innerContent, selfClosing } =
            parseComponent(outerContent);
        const loc = {
            start: match.index,
            end: match.index + outerContent.length,
        };
        es.push({
            type: 'verbatim',
            original: { loc, outerContent },
            processable: {
                innerContent,
                optionsForProcessor: {
                    tag,
                    attributes,
                    selfClosing,
                    outerContent,
                },
            },
        });
    }
    return es;
}

export function getMathInSpecialDelimsES(
    document: string,
    texSettings: TexEscapeSettings,
): EscapableSnippet<'tex'>[] {
    const es: EscapableSnippet<'tex'>[] = [];
    if (!texSettings.enabled) return es;
    const { display, inline } = texSettings.delims ?? {};
    (
        [
            [!!display?.escapedSquareBrackets, '\\\\\\[', '\\\\\\]', false],
            [!!inline?.escapedParentheses, '\\\\\\(', '\\\\\\)', true],
        ] as const
    ).forEach(([enabled, ldelim, rdelim, inline]) => {
        if (enabled) {
            es.push(
                ...XRegExp.matchRecursive(document, ldelim, rdelim, 'gmu', {
                    unbalanced: 'skip',
                    valueNames: [null, null, 'tex', null],
                }).map((match) => {
                    const pad = inline ? 0 : 2;
                    const innerContent = match.value.replace(
                        /^(?: |\r\n?|\n)(.*)(?: |\r\n?|\n)$/su,
                        '$1',
                    );
                    return {
                        original: {
                            loc: {
                                start: match.start - 2,
                                end: match.end + 2,
                            },
                        },
                        processable: {
                            innerContent,
                            optionsForProcessor: { inline },
                        },
                        escapeOptions: { pad },
                        unescapeOptions: { removeParagraphTag: !inline },
                        type: 'tex',
                    } as EscapableSnippet<'tex'>;
                }),
            );
        }
    });
    return es;
}

/**
 * @param document - The document to escape.
 * @returns An array of escapable snippets of Svelte syntax.
 * @example
 * ```ts
 * console.log(getSvelteEscapableSnippets('a<script>...</script>b'))
 * // [
 * //     {
 * //         escapeOptions: { pad: 2 },
 * //         original: {
 * //             loc: { start: 1, end: 21 },
 * //             outerContent: '<script>...</script>',
 * //         },
 * //         processable: undefined,
 * //         type: 'svelte',
 * //         unescapeOptions: { removeParagraphTag: true },
 * //     },
 * // ]
 * ```
 */
export function getSvelteES(document: string): EscapableSnippet<'svelte'>[] {
    const escapableSnippets: EscapableSnippet<'svelte'>[] = [];
    [
        normalComponentsRegExp(['script', 'style', `svelte${colonUuid}head`]),
        normalAndSelfClosingComponentsRegExp([
            `svelte${colonUuid}window`,
            `svelte${colonUuid}document`,
            `svelte${colonUuid}body`,
            `svelte${colonUuid}options`,
        ]),
    ].forEach((regExp) => {
        // console.log('document: ', document);
        // console.log('regExp: ', regExp.source);
        for (const match of document.matchAll(regExp)) {
            // console.log('match: ', match[0]);
            const { index, 0: outerContent } = match;
            const loc = {
                start: index,
                end: index + outerContent.length,
            };
            escapableSnippets.push({
                type: 'svelte',
                original: { loc, outerContent },
                processable: undefined,
                escapeOptions: { pad: 2 },
                unescapeOptions: { removeParagraphTag: true },
            });
        }
    });
    return escapableSnippets;
}

export const colonUuid = uuid().replace(/-/g, '');

export function getColonES(document: string): EscapableSnippet<'svelte'>[] {
    const escapableSnippets: EscapableSnippet<'svelte'>[] = [];
    const addColon = (loc: Offsets) => {
        escapableSnippets.push({
            type: 'svelte',
            original: { loc, outerContent: ':' },
            processable: undefined,
            escapeOptions: { pad: false, hyphens: false },
            unescapeOptions: { removeParagraphTag: false },
        });
    };
    [
        normalComponentsRegExp(['svelte:head']),
        normalAndSelfClosingComponentsRegExp([
            'svelte:self',
            'svelte:component',
            'svelte:element',
            'svelte:fragment',
            //
            'svelte:window',
            'svelte:document',
            'svelte:body',
            'svelte:options',
        ]),
    ].forEach((regExp) => {
        for (const match of document.matchAll(regExp)) {
            const { index, 0: outerContent } = match;
            // console.log(match);
            const firstColonIdx = outerContent.indexOf(':');
            const locFirst = {
                start: index + firstColonIdx,
                end: index + firstColonIdx + 1,
            };
            // console.log(locFirst);
            addColon(locFirst);
            const lastColonIdx = outerContent.lastIndexOf(':');
            if (lastColonIdx !== firstColonIdx) {
                const locLast = {
                    start: index + lastColonIdx,
                    end: index + lastColonIdx + 1,
                };
                addColon(locLast);
            }
        }
    });
    return escapableSnippets;
}

// /<!--[^]*?-->|<style((?:\s+[^=>'"/]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/]+)*\s*)(?:\/>|>([\S\s]*?)<\/style>)/g

/* eslint-disable tsdoc/syntax */
/**
 * @param document - The document in which to find escapable snippets.
 * @param documentLines - The lines of the document, i.e., `document.split('\n')`.
 * @returns An array of escapable snippets of:
 * - `'code'`: Code spans (`` `...` ``) and fenced code blocks
 *   (```` ```...\n...\n``` ````)
 * - `'math'`: Inline math (`$...$`) and display math (`$$...$$`)
 * - `'svelte'`: Special tags (`{@const ...}`, `{@debug ...}`)
 * - `'svelte'`: Delimiters of logic blocks (`{#if ...}`, `{#else ...}`,
 *   `{/if}`, etc.)
 * - `'mustacheTag'` Mustache tags (`{...}`), i.e., almost anything in braces
 *   that hasn't already been escaped by this method or otherwise.
 */
/* eslint-enable tsdoc/syntax */
export function getMdastES({
    ast,
    document,
    lines,
    texSettings,
}: {
    ast: MdastRoot;
    document: string;
    lines: string[];
    texSettings: TexEscapeSettings;
}): EscapableSnippet<'code' | 'mustacheTag' | 'tex' | 'svelte'>[] {
    const escapableSnippets: EscapableSnippet<
        'code' | 'mustacheTag' | 'tex' | 'svelte'
    >[] = [];
    walkMdast(ast, (node) => {
        // If the node is not one of the interesting types, we don't need to
        // analyze it any further; instead, we just keep walking this branch
        // of the tree.
        if (
            !isOneOf(node.type, [
                'math',
                'inlineMath',
                'code',
                'inlineCode',
                'mdxTextExpression',
                'mdxFlowExpression',
            ])
        ) {
            return true;
        }
        const loc = getLocationUnist(node, lines);
        // Inline math and display math
        if (isOneOf(node.type, ['inlineMath', 'math'])) {
            if (!texSettings.enabled) return true;
            typeAssert(is<MdastMathNode | MdastInlineMathNode>(node));
            nodeAssert(node.position, 'Node has positional information.');
            const isDisplayMath = texSettings.$$?.isDisplayMath ?? 'always';
            let inline: boolean = node.type === 'inlineMath';
            // Micromark parses a lot of stuff that some might expect to be
            // display math as inline math, so we need to check if it really is
            // inline math given the user's preferences. On the other hand, if
            // Micromark parses something as display math, we can be sure that
            // it really is display math.
            const { start, end } = node.position;

            // `true` iff the first line of the outer content matches /^\s*\$/
            const startsWithNewline = !!lines[start.line - 1]
                ?.trimStart()
                .startsWith('$');

            // `true` iff the last line of the outer content matches /\$\s*$/
            const endsWithNewline = !!lines[end.line - 1]
                ?.trimEnd()
                .endsWith('$');

            if (inline) {
                // Get math content _with_ the surrounding delimiters
                const outerContent = document.slice(loc.start, loc.end);
                // Check if the delimiters are ≥2 dollar signs
                if (outerContent.match(/^\s*\$\$.*\$\$\s*$/su)) {
                    if (isDisplayMath === 'always') {
                        inline = false;
                    } else if (isDisplayMath === 'newline') {
                        inline = !(startsWithNewline && endsWithNewline);
                    }
                }
            }

            // If we're dealing with inline math, we don't pad the escape
            // string. However, if we're dealing with display math, we want to
            // make sure that the processed math won't be caught within a
            // paragraph tag with other content, so we pad the escape string
            // with newlines.
            const pad = inline ? 0 : 2;

            // To follow CommonMark conventions, if the inner content starts
            // resp. ends with ≥1 spaces or newlines, we trim the first resp.
            // last such whitespace character.
            const innerContent = node.value.replace(
                /^(?: |\r\n?|\n)(.*)(?: |\r\n?|\n)$/su,
                '$1',
            );

            escapableSnippets.push({
                type: 'tex',
                original: { loc, outerContent: undefined },
                escapeOptions: { pad },
                processable: {
                    innerContent,
                    optionsForProcessor: { inline },
                },
                unescapeOptions: { removeParagraphTag: !inline },
            });
        }
        // Code spans and fenced code blocks
        else if (isOneOf(node.type, ['inlineCode', 'code'])) {
            typeAssert(is<MdastCodeNode | MdastInlineCodeNode>(node));
            nodeAssert(node.position, 'Node has positional information.');
            const inline = node.type === 'inlineCode';
            const { start, end } = node.position;
            escapableSnippets.push({
                type: 'code',
                original: { loc, outerContent: undefined },
                processable: {
                    innerContent: node.value,
                    optionsForProcessor: inline
                        ? { _wrap: true, inline }
                        : {
                              _wrap: true,
                              lang: node.lang ?? undefined,
                              inline,
                              info: node.meta ?? undefined,
                          },
                },
                escapeOptions: {
                    pad: inline
                        ? false
                        : [
                              lines[start.line - 1 - 1]?.trim().length !== 0,
                              lines[end.line - 1 + 1]?.trim().length !== 0,
                          ],
                },
                unescapeOptions: { removeParagraphTag: !inline },
            });
        } else if (
            isOneOf(node.type, ['mdxTextExpression', 'mdxFlowExpression'])
        ) {
            typeAssert(
                is<MdastMdxTextExpressionNode | MdastMdxFlowExpressionNode>(
                    node,
                ),
            );
            const outerContent = document.slice(loc.start, loc.end);
            // const innerContent = node.value;
            // If the expression starts with `#`, `:`, or `/`, it's a Svelte
            // logic block. In this case, we want to remove any <p>...</p> tags
            // with which the markdown processor may wrap the escaped string.
            // If the expression starts with `@html`, it's a raw HTML block. In
            // this case, it should be treated as plain text, just like mustache
            // tags.
            if (
                node.value.match(/^\s*[#@:/]/) &&
                !node.value.startsWith('@html')
            ) {
                let pad: boolean | [string, string] = true;
                if (node.position) {
                    // We don't want a logic block to be caught within a
                    // paragraph tag with other content, so we pad the escape
                    // string with newlines if necessary.
                    pad = [
                        // `node.position.start.line - 1` = 0-based line number
                        !lines[node.position.start.line - 1 - 1]?.trim()
                            ? '\n\n'
                            : '\n',
                        // `node.position.end.line - 1` = 0-based line number
                        !lines[node.position.end.line - 1 + 1]?.trim()
                            ? '\n\n'
                            : '\n',
                    ];
                    // pad = false;
                }
                escapableSnippets.push({
                    original: { loc, outerContent },
                    processable: undefined,
                    escapeOptions: { pad },
                    type: 'svelte',
                    unescapeOptions: { removeParagraphTag: true },
                });
            } else {
                escapableSnippets.push({
                    type: 'mustacheTag',
                    original: { loc, outerContent },
                    processable: undefined,
                    escapeOptions: { pad: false },
                    unescapeOptions: { removeParagraphTag: false },
                });
            }
        }
        return false;
    });
    return escapableSnippets;
}

/**
 * Pad a string left and right.
 *
 * @param str - The string to pad.
 * @param padInstr - The padding instruction. If `true` (the default), a newline
 * is added on both sides. If `false`, no padding is added. If a number, then
 * that number of newlines (`\n`) is added to both sides. If a string, that
 * string is added on both sides. If a 2-tuple, the previous procedure is
 * applied independently to the left and right side of the string with the first
 * and second element of the tuple, respectively.
 * @returns The padded string.
 *
 * @example
 * ```ts
 * padString('foo'); // '\nfoo\n'
 * padString('foo', true); // '\nfoo\n'
 * padString('foo', false); // 'foo'
 * padString('foo', 'bar'); // 'barfoobar'
 * padString('foo', [true, false]); // '\nfoo'
 * padString('foo', [true, 'bar']); // '\nfoobar'
 * padString('foo', [0, 2]); // 'foo\n\n'
 * padString('foo', ['bar\n', 1]); // 'bar\nfoo\n'
 * padString('foo', ['bar', 'baz']); // 'barfoobaz'
 * ```
 */
export function padString(
    str: string,
    padInstr: PaddingInstruction | undefined = true,
): string {
    if (!padInstr) return str;
    const pad: [string | boolean | number, string | boolean | number] =
        !isArray(padInstr) ? [padInstr, padInstr] : [...padInstr];
    return (
        (isString(pad[0]) ? pad[0] : '\n'.repeat(+pad[0])) +
        str +
        (isString(pad[1]) ? pad[1] : '\n'.repeat(+pad[1]))
    );
}

/**
 * Escape snippets in a document.
 *
 * @param document - The document in which to escape the snippets.
 * @param snippets - The (escapable) snippets to escape.
 *
 */
export function escapeSnippets(
    document: string,
    snippets: EscapableSnippet[],
): {
    escapedDocument: string;
    escapedSnippets: [string, EscapedSnippet][];
} {
    const s = new MagicString(document);
    const ranges = outermostRanges([...snippets], 'original.loc');
    const escapedSnippets: [string, Snippet][] = ranges.map((range) => {
        const id = uuid();
        const paddedId = padString(id, range.escapeOptions?.pad ?? false);
        nodeAssert(paddedId, 'paddedId must be truthy');
        s.overwrite(range.original.loc.start, range.original.loc.end, paddedId);
        return [id, range];
    });
    const escapedDocument = s.toString();
    return { escapedDocument, escapedSnippets };
}

/**
 * Escape colons (in tag/component names) in a document.
 *
 * @param document - The document in which to escape the colons.
 * @returns The document with the colons escaped.
 */
export function escapeColons(document: string): string {
    const snippets = getColonES(document);
    const s = new MagicString(document);
    snippets.forEach((snippet) => {
        s.overwrite(
            snippet.original.loc.start,
            snippet.original.loc.end,
            colonUuid,
        );
    });
    return s.toString();
}

/**
 * Unescape colons (in tag/component names) in a document.
 *
 * @param document - The document in which to unescape the colons.
 * @returns The document with the colons unescaped.
 */
export function unescapeColons(document: string): string {
    return document.replaceAll(colonUuid, ':');
}

export function escape(
    document: string,
    verbatimTags: string[] = [],
    texSettings: TexEscapeSettings = { enabled: true },
) {
    // Escape colons inside special Svelte elements (e.g. <svelte:component>) so
    // that they don't confuse the markdown processor. We don't want to escape
    // the entire special Svelte element because we want the markdown processor
    // to be able to transform any markdown that it may find within it.
    const escapedDocument = escapeColons(document);

    // Escape other things using MDAST
    const ast = parseToMdast(
        escapedDocument,
        [
            ...verbatimTags,
            'script',
            'style',
            // `svelte${colonUuid}head`,
            `svelte${colonUuid}window`,
            `svelte${colonUuid}document`,
            `svelte${colonUuid}body`,
            `svelte${colonUuid}options`,
        ],
        texSettings,
    );
    const lines = escapedDocument.split(/\r\n?|\n/);
    return escapeSnippets(escapedDocument, [
        ...getMdastES({
            ast,
            document: escapedDocument,
            lines,
            texSettings,
        }),
        // Escape Svelte syntax
        ...getSvelteES(escapedDocument),
        // Escape math in \[...\] and \(...\)
        ...getMathInSpecialDelimsES(escapedDocument, texSettings),
        ...getVerbatimES(document, verbatimTags),
    ]);
}

/**
 * "Unescapes" content.
 *
 * @param document - Escaped content.
 * @param processedSnippets - An array of 2-tuples, with the first element being
 * the UUIDv4 and the second element being the processed snippet corresponding
 * to that UUIDv4.
 * @returns The original content, with the escaped matches restored.
 */
export function unescapeSnippets(
    document: string,
    processedSnippets: [string, ProcessedSnippet][],
): string {
    let unescaped = document;
    const keys: string[] = processedSnippets.map((v) => v[0]);
    const processedSnippetsRecord = Object.fromEntries(processedSnippets);
    if (keys.length === 0) return document;
    unescaped = XRegExp.replace(
        document,
        new RegExp(
            `(?:(<p>\\s*)(${keys.join('|')})(\\s*</p>))|(${keys.join('|')})`,
            'g',
        ),
        (...match) => {
            typeAssert(is<(string | undefined)[]>(match));
            const key = match[2] ?? match[4];
            nodeAssert(key, "RegExp must've matched an UUIDv4 key.");
            const processedSnippet = processedSnippetsRecord[key];
            if (!processedSnippet) return key;
            if (
                !processedSnippet.unescapeOptions?.removeParagraphTag &&
                match[2]
            ) {
                nodeAssert(
                    match[1] && match[3],
                    'Matched <p>...</p>, so <p> and </p> tags must be present.',
                );
                return match[1] + processedSnippet.processed + match[3];
            }
            return processedSnippet.processed;
        },
    );
    return unescaped;
}

/**
 * Parse a document into an MDAST.
 *
 * @param document - The document to parse.
 * @param texSettings - The settings for escaping TeX math.
 * @returns The MDAST of the document.
 *
 * @remarks This function uses the following modules and plugins to parse the
 * document:
 * - `mdast-util-from-markdown`: Its `fromMarkdown` method is the backbone of
 *   our `parseToMdast` method.
 * -
 */
export function parseToMdast(
    document: string,
    verbatimTags: string[] | undefined = undefined,
    texSettings: TexEscapeSettings = getDefaultSveltexConfig().general.tex,
): MdastRoot {
    return mdastFromMarkdown(document, {
        extensions: [
            micromarkMdxMd(),
            micromarkMdxJsx(),
            // micromarkSkip(verbatimTags),
            micromarkMath({
                singleDollarTextMath:
                    texSettings.enabled &&
                    (texSettings.delims?.inline?.singleDollar ?? true),
            }),
            micromarkMdxExpression(),
            micromarkSkip(verbatimTags),
        ],
        mdastExtensions: [
            mdastMathFromMarkdown(),
            mdastMdxExpressionFromMarkdown(),
        ],
    });
}
