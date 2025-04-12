// File description: Escape and unescape different kinds of content in a Sveltex
// file.

// Types
import type { Offsets } from '../types/utils/Ast.js';
import type {
    DirectiveEscapeSettings,
    EscapableSnippet,
    EscapeOptions,
    EscapedSnippet,
    PaddingInstruction,
    ProcessedSnippet,
    Snippet,
} from '../types/utils/Escape.js';

// Internal dependencies
import { isArray, isOneOf, isString } from '../typeGuards/utils.js';
import { getLocationUnist, walkUnist } from './ast.js';
import { parseComponent } from './parseComponent.js';

// External dependencies
import {
    MagicString,
    type MdastCodeNode,
    type MdastInlineCodeNode,
    type MdastInlineMathNode,
    type MdastMathNode,
    type MdastMdxFlowExpressionNode,
    type MdastMdxTextExpressionNode,
    type MdastRoot,
    XRegExp,
    typeAssert,
    getProperty,
    is,
    mdastFromMarkdown,
    mdastMathFromMarkdown,
    mdastMdxExpressionFromMarkdown,
    micromarkMath,
    micromarkMdxExpression,
    micromarkMdxMd,
    nodeAssert,
    micromarkFrontmatter,
    micromarkDirective,
    mdastFrontmatterFromMarkdown,
    type MdastYaml,
    inspect,
    type UnistPosition,
    directiveFromMarkdown,
    uuid,
} from '../deps.js';
import { micromarkSkip } from './micromark/syntax.js';
import type { MdastJson, MdastToml } from '../types/utils/Frontmatter.js';
import type { VerbatimHandler } from '../handlers/VerbatimHandler.js';
import { type CodeBackend, getDefaultMathConfig } from '../mod.js';
import { log, prettifyError } from './debug.js';
import type { WithFullDelims } from '../types/handlers/Math.js';

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
        positionProperty
            ? getProperty(range, positionProperty)
            : (range as Offsets);
    const sortedRanges = ranges.sort((a, b) => {
        const startDiff = getLoc(a).start - getLoc(b).start;
        if (startDiff !== 0) return startDiff;
        return getLoc(b).end - getLoc(a).end; // Prefer larger ranges
    });
    const outermostRanges_: Range[] = [];
    let currentPos = 0;
    for (const range of sortedRanges) {
        if (getLoc(range).start >= currentPos) {
            outermostRanges_.push(range);
            currentPos = getLoc(range).end;
        }
    }
    return outermostRanges_;
}

/**
 *
 */
export function escapeBraces(content: string): string {
    return content.replaceAll('{', '&lbrace;').replaceAll('}', '&rbrace;');
}

export const uniqueEscapeSequences = {
    '<': generateId(),
    '>': generateId(),
    '{': generateId(),
    '}': generateId(),
} as const;

/**
 * Replace custom escape sequences with their HTML equivalents.
 *
 * TODO: Make this safer (see https://npmjs.com/package/html-escaper)
 */
export function customEscapeSequencesToHtml(escapedContent: string): string {
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
//     - 'math' -> process with MathHandler
//     - 'inlineMath' -> process with MathHandler
//     - 'code' -> process with CodeHandler
//     - 'inlineCode' -> process with CodeHandler
//     - 'mdxTextExpression' -> unescape later, no processing required (however,
//       check if it's a mustache tag, and, if not, remove surrounding
//       <p>...</p> tag, if present, after unescaping)
//     - 'mdxFlowExpression' -> unescape later, no processing required (however,
//       check if it's a mustache tag, and, if not, remove surrounding
//       <p>...</p> tag, if present, after unescaping)

export function escapeStringForRegExp(str: string): string {
    return str.replace(/([.*+?^${}()|[\]\\-])/gu, '\\$1');
}

function normalComponentsRegExp(rawTags: string[]): RegExp {
    nodeAssert(
        rawTags.length !== 0,
        'Empty tags array passed to regularTagsRegExp',
    );
    const tags = rawTags.map(escapeStringForRegExp).map((s) => s.trim());
    // eslint-disable-next-line new-cap
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
    // eslint-disable-next-line new-cap
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
    verbEnvs?: VerbatimHandler<CodeBackend>['verbEnvs'],
): EscapableSnippet<'verbatim'>[] {
    const es: EscapableSnippet<'verbatim'>[] = [];
    if (verbatimTags.length === 0) return es;
    const escapedVerbatimTags = verbatimTags.map((t) =>
        t.replaceAll(':', colonId),
    );
    const verbatimTagsRegExp =
        normalAndSelfClosingComponentsRegExp(escapedVerbatimTags);
    for (const match of content.matchAll(verbatimTagsRegExp)) {
        const outerContent = match[0];
        const parsedComponent = parseComponent(outerContent);
        let { innerContent } = parsedComponent;
        const { tag, attributes, selfClosing } = parsedComponent;

        const start = match.index;
        const end = start + outerContent.length;

        // Get line at which match starts
        const lineOffset: number = content
            .slice(0, content.lastIndexOf(innerContent, end))
            .split(/\r\n?|\n/u).length;

        const loc: Offsets = { start, end, lineOffset };

        const config = verbEnvs?.get(tag);
        let inline = config?.defaultAttributes['inline'] === true;
        if (attributes['inline'] === true) inline = true;
        if (inline) {
            innerContent = innerContent.replace(
                /^(?:\r\n?|\n| )(.*)(?:\r\n?|\n| )$/su,
                '$1',
            );
        }
        const escapeOptions: EscapeOptions = { pad: inline ? 0 : 2 };
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
                    lineOffset,
                },
            },
            escapeOptions,
        });
    }
    return es;
}

export function getMathInSpecialDelimsES(
    document: string,
    texSettings: WithFullDelims['delims'],
): EscapableSnippet<'math'>[] {
    const es: EscapableSnippet<'math'>[] = [];
    const { display, inline } = texSettings;
    (
        [
            [!!display.escapedSquareBrackets, '\\\\\\[', '\\\\\\]', false],
            [!!inline.escapedParentheses, '\\\\\\(', '\\\\\\)', true],
        ] as const
    ).forEach(([enabled, ldelim, rdelim, inline_]) => {
        if (enabled) {
            es.push(
                ...XRegExp.matchRecursive(document, ldelim, rdelim, 'gmu', {
                    unbalanced: 'skip',
                    valueNames: [null, null, 'math', null],
                }).map((match) => {
                    const pad = inline_ ? 0 : 2;
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
                            optionsForProcessor: { inline: inline_ },
                        },
                        escapeOptions: { pad },
                        unescapeOptions: { removeParagraphTag: !inline_ },
                        type: 'math',
                    } as EscapableSnippet<'math'>;
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
        normalComponentsRegExp(['script', 'style', `svelte${colonId}head`]),
        normalAndSelfClosingComponentsRegExp([
            `svelte${colonId}window`,
            `svelte${colonId}document`,
            `svelte${colonId}body`,
            `svelte${colonId}options`,
        ]),
    ].forEach((regExp) => {
        for (const match of document.matchAll(regExp)) {
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

export const colonId: string = generateId();

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
            const firstColonIdx = outerContent.indexOf(':');
            const locFirst = {
                start: index + firstColonIdx,
                end: index + firstColonIdx + 1,
            };
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
    directiveSettings,
}: {
    ast: MdastRoot;
    document: string;
    lines: string[];
    texSettings: WithFullDelims['delims'];
    directiveSettings: DirectiveEscapeSettings;
}): EscapableSnippet[] {
    const escapableSnippets: EscapableSnippet[] = [];
    walkUnist(ast, (node) => {
        // If the node is not one of the interesting types, we don't need to
        // analyze it any further; instead, we just keep walking this branch
        // of the tree.
        if (
            !isOneOf(node.type, [
                // Math ($...$, $$...$$, etc.)
                'math',
                'inlineMath',
                // Code (`...`, ```...```, etc.)
                'code',
                'inlineCode',
                // Mustache tags ({...})
                'mdxTextExpression',
                'mdxFlowExpression',
                // Directives
                'containerDirective',
                'leafDirective',
                'textDirective',
                // Frontmatter
                'yaml',
                'toml',
                'json',
            ])
        ) {
            return true;
        }
        nodeAssert(
            node.position,
            `Expected Node to have positional information: ${inspect(node)}`,
        );
        const loc = getLocationUnist(node, lines);
        // Inline math and display math
        if (isOneOf(node.type, ['inlineMath', 'math'])) {
            typeAssert(is<MdastMathNode | MdastInlineMathNode>(node));
            const isDisplayMath = texSettings.doubleDollarSignsDisplay;
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
                if (/^\s*\$\$.*\$\$\s*$/su.test(outerContent)) {
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
                type: 'math',
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
            const inline = node.type === 'inlineCode';
            const s: EscapableSnippet<'code'> = {
                type: 'code',
                original: { loc, outerContent: undefined },
                processable: {
                    innerContent: node.value,
                    optionsForProcessor: inline
                        ? { inline: inline }
                        : {
                              lang: node.lang ?? undefined,
                              inline,
                              metaString: node.meta ?? undefined,
                          },
                },
                escapeOptions: {
                    pad: calcPadding(lines, node.position, inline),
                },
                unescapeOptions: { removeParagraphTag: !inline },
            };
            escapableSnippets.push(s);
        } else if (
            isOneOf(node.type, ['mdxTextExpression', 'mdxFlowExpression'])
        ) {
            typeAssert(
                is<MdastMdxTextExpressionNode | MdastMdxFlowExpressionNode>(
                    node,
                ),
            );
            const outerContent = document.slice(loc.start, loc.end);
            // const innerContent = node.value; If the expression starts with
            // `#if`, `:else`, `/if`, etc., it's a Svelte logic block. In this
            // case, we want to remove any <p>...</p> tags with which the
            // markdown processor may wrap the escaped string. If the expression
            // starts with `@html`, it's a raw HTML block. In this case, it
            // should be treated as plain text, just like mustache tags, and so
            // we don't remove any <p>...</p> tags or add any padding.
            if (
                /^\s*[#/](?:if|each|await|key)/u.test(node.value) ||
                /^\s*[:](?:else|then|catch)/u.test(node.value) ||
                /^\s*[@](?!html)/u.test(node.value)
            ) {
                // We don't want a logic block to be caught within a paragraph
                // tag with other content, so we pad the escape string with
                // newlines if necessary.
                const pad: PaddingInstruction = [
                    // `node.position.start.line - 1` = 0-based line number
                    1 + +!lines[node.position.start.line - 1 - 1]?.trim(),
                    // `node.position.end.line - 1` = 0-based line number
                    1 + +!lines[node.position.end.line - 1 + 1]?.trim(),
                ];
                // pad = false;
                escapableSnippets.push({
                    original: { loc, outerContent },
                    processable: undefined,
                    escapeOptions: { pad },
                    type: 'svelte',
                    unescapeOptions: { removeParagraphTag: true },
                });
            } else if (
                directiveSettings.enabled &&
                directiveSettings.bracesArePartOfDirective?.({
                    document,
                    loc,
                    innerContent: node.value,
                })
            ) {
                // If we reached this branch, it means that the user loosened
                // the directive syntax, and doesn't want this pair of braces to
                // be escaped. Accordingly, we don't push anything to
                // `escapableSnippets` here.
            } else {
                escapableSnippets.push({
                    type: 'mustacheTag',
                    original: { loc, outerContent },
                    processable: undefined,
                    escapeOptions: { pad: false },
                    unescapeOptions: { removeParagraphTag: false },
                });
            }
        } else if (isOneOf(node.type, ['yaml', 'toml', 'json'])) {
            typeAssert(is<MdastYaml | MdastToml | MdastJson>(node));
            escapableSnippets.push({
                type: 'frontmatter',
                original: { loc, outerContent: undefined },
                processable: {
                    innerContent: node.value,
                    optionsForProcessor: { type: node.type },
                },
                escapeOptions: { pad: calcPadding(lines, node.position) },
                unescapeOptions: { removeParagraphTag: true },
            });
        }
        return false;
    });

    return escapableSnippets;
}

function calcPadding(
    lines: string[],
    loc: UnistPosition,
    inline: boolean = false,
): PaddingInstruction {
    if (inline) return false;
    const padding: PaddingInstruction = [2, 2];
    // 0-based line and column numbers
    const start = { line: loc.start.line - 1, column: loc.start.column - 1 };
    const end = { line: loc.end.line - 1, column: loc.end.column - 1 };
    // first and last lines of the snippet
    const lineStart = lines[start.line];
    const lineEnd = lines[end.line];
    nodeAssert(lineStart !== undefined, 'expected starting line to be defined');
    nodeAssert(lineEnd !== undefined, 'expected ending line to be defined');
    const leadingStart = lineStart.slice(0, start.column);
    // Padding before
    if (/^\s*$/u.test(leadingStart)) {
        // /^\s*START/m
        padding[0] = '\n' + leadingStart;
        const lineBefore = lines[start.line - 1];
        if (!lineBefore || lineBefore.trim().length === 0) {
            // /^\s*\n\s*START/m
            padding[0] = leadingStart;
        }
    }
    if (/^\s*(>|- |\d+. )/u.test(lineStart)) {
        padding[0] = 0;
    }
    // Padding after
    if (lineEnd.slice(end.column + 1).trim().length === 0) {
        // /END\s*$/m
        padding[1] = 1;
        const lineAfter = lines[end.line + 1];
        if (!lineAfter || /^\s*(>|- |\d+. |$)/u.test(lineAfter)) {
            padding[1] = 0;
        }
    }
    return padding;
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
        const id = generateId();
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
function escapeColons(document: string): string {
    const snippets = getColonES(document);
    const s = new MagicString(document);
    snippets.forEach((snippet) => {
        s.overwrite(
            snippet.original.loc.start,
            snippet.original.loc.end,
            colonId,
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
    return document.replaceAll(colonId, ':');
}

export function escape(
    document: string,
    verbatimTags: string[],
    texSettings: WithFullDelims['delims'],
    verbEnvs?: VerbatimHandler<CodeBackend>['verbEnvs'],
    directiveSettings: DirectiveEscapeSettings = {},
): { escapedDocument: string; escapedSnippets: [string, EscapedSnippet][] } {
    // Escape colons inside special Svelte elements (e.g. <svelte:component>) so
    // that they don't confuse the markdown processor. We don't want to escape
    // the entire special Svelte element because we want the markdown processor
    // to be able to transform any markdown that it may find within it.
    const escapedDocument = escapeColons(document);

    let ast: MdastRoot;
    try {
        // Escape other things using MDAST
        ast = parseToMdast(
            escapedDocument,
            [
                ...verbatimTags,
                'script',
                'style',
                // `svelte${colonUuid}head`,
                `svelte${colonId}window`,
                `svelte${colonId}document`,
                `svelte${colonId}body`,
                `svelte${colonId}options`,
            ],
            texSettings,
            directiveSettings,
        );

        const lines = escapedDocument.split(/\r\n?|\n/u);
        return escapeSnippets(escapedDocument, [
            ...getMdastES({
                ast,
                document: escapedDocument,
                lines,
                texSettings,
                directiveSettings,
            }),
            // Escape Svelte syntax
            ...getSvelteES(escapedDocument),
            // Escape math in \[...\] and \(...\)
            ...getMathInSpecialDelimsES(escapedDocument, texSettings),
            ...getVerbatimES(escapedDocument, verbatimTags, verbEnvs),
        ]);
    } catch (err) {
        log('error', prettifyError(err));
        return { escapedDocument, escapedSnippets: [] };
    }
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
    const keys: string[] = processedSnippets.map((v) => v[0]);
    const processedSnippetsRecord = Object.fromEntries(processedSnippets);
    if (keys.length === 0) return document;
    const unescaped = XRegExp.replace(
        document,
        new RegExp(
            `(?:(<p>\\s*)(${keys.join('|')})(\\s*</p>))|(${keys.join('|')})`,
            'gu',
        ),
        (...match) => {
            typeAssert(is<(string | undefined)[]>(match));
            const key = match[2] ?? match[4];
            nodeAssert(key, "RegExp must've matched an UUIDv4 key.");
            const processedSnippet = processedSnippetsRecord[key];
            if (!processedSnippet) return key;
            if (
                !processedSnippet.unescapeOptions.removeParagraphTag &&
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
 * @param mathDelims - The settings for escaping TeX math.
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
    mathDelims: WithFullDelims['delims'] = getDefaultMathConfig('custom')
        .delims,
    directiveSettings: DirectiveEscapeSettings = {},
): MdastRoot {
    return mdastFromMarkdown(document, {
        extensions: [
            micromarkFrontmatter([
                'yaml',
                'toml',
                { type: 'yaml', fence: { open: '---yaml', close: '---' } },
                { type: 'toml', fence: { open: '---toml', close: '---' } },
                { type: 'json', fence: { open: '---json', close: '---' } },
            ]),
            ...(directiveSettings.enabled ? [micromarkDirective()] : []),
            micromarkMdxMd(),
            micromarkSkip(verbatimTags),
            ...(mathDelims.dollars
                ? [
                      micromarkMath({
                          singleDollarTextMath: mathDelims.inline.singleDollar,
                      }),
                  ]
                : []),
            micromarkMdxExpression(),
            // micromarkMdxJsx(),
        ],
        mdastExtensions: [
            mdastFrontmatterFromMarkdown([
                'yaml',
                'toml',
                { type: 'yaml', fence: { open: '---yaml', close: '---' } },
                { type: 'toml', fence: { open: '---toml', close: '---' } },
                { type: 'json', fence: { open: '---json', close: '---' } },
            ]),
            mdastMathFromMarkdown(),
            // mdastMdxJsxFromMarkdown(),
            mdastMdxExpressionFromMarkdown(),
            ...(directiveSettings.enabled ? [directiveFromMarkdown()] : []),
        ],
    });
}

export function generateId(): `id${string}` {
    return `id${uuid().replaceAll('-', '')}`;
}
