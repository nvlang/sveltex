// File description: Native Markdown language features derived from the mdast.
//
// The embedded Svelte language server understands the HTML subset of a
// `.sveltex` file but nothing of its Markdown structure. This module fills that
// gap by parsing the document with SvelTeX's own `parseToMdast` and walking the
// resulting tree to produce document symbols, folding ranges and selection
// ranges. These features need no position mapping: the mdast carries offsets on
// the original `.sveltex` source directly.

import {
    FoldingRangeKind,
    SymbolKind,
    type DocumentSymbol,
    type FoldingRange,
    type Position,
    type Range,
    type SelectionRange,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseToMdast } from '@nvl/sveltex/dist/utils/escape.js';
import type { SveltexConfigSnapshot } from './config.js';

/**
 * A minimal structural view of a unist/mdast node. SvelTeX's `parseToMdast`
 * returns full mdast types, but the Markdown features here touch only a handful
 * of fields, so this local interface keeps the module free of an mdast type
 * dependency.
 */
interface MdNode {
    type: string;
    /** Heading level, present on `heading` nodes. */
    depth?: number;
    /** Child nodes, present on container nodes. */
    children?: MdNode[];
    /** Text payload, present on literal nodes (`text`, `code`, ...). */
    value?: string;
    /** Source position; always present on parsed nodes. */
    position?: {
        start: { offset: number };
        end: { offset: number };
    };
}

/**
 * Parses a `.sveltex` document into an mdast root.
 *
 * @returns The mdast root, or `undefined` if parsing throws.
 */
function parse(
    document: string,
    config: SveltexConfigSnapshot,
): MdNode | undefined {
    try {
        return parseToMdast(
            document,
            [...config.verbatimTags, 'script', 'style'],
            config.mathDelims,
            config.directives,
        ) as unknown as MdNode;
    } catch {
        return undefined;
    }
}

/** Depth-first pre-order walk over an mdast tree. */
function walk(node: MdNode, visit: (n: MdNode) => void): void {
    visit(node);
    for (const child of node.children ?? []) {
        walk(child, visit);
    }
}

/** Extracts the concatenated plain text of a node's literal descendants. */
function textOf(node: MdNode): string {
    let text = '';
    walk(node, (n) => {
        if (typeof n.value === 'string') text += n.value;
    });
    return text.trim();
}

/**
 * Computes document symbols for a `.sveltex` file: a nested outline built from
 * its Markdown headings.
 *
 * @param document - Full text of the `.sveltex` document.
 * @param config - Resolved SvelTeX config snapshot.
 * @returns A hierarchical list of {@link DocumentSymbol}s. Headings nest by
 * level (an `##` becomes a child of the preceding `#`).
 */
export function computeDocumentSymbols(
    document: string,
    config: SveltexConfigSnapshot,
): DocumentSymbol[] {
    const root = parse(document, config);
    if (!root) return [];
    const doc = TextDocument.create('mem://md', 'sveltex', 0, document);

    // A symbol plus the heading level that produced it, used while nesting.
    interface Pending {
        depth: number;
        symbol: DocumentSymbol;
    }
    const roots: DocumentSymbol[] = [];
    const stack: Pending[] = [];

    walk(root, (node) => {
        if (node.type !== 'heading' || !node.position) return;
        /* v8 ignore next -- parseToMdast always sets `depth` on headings */
        const depth = node.depth ?? 1;
        const range: Range = {
            start: doc.positionAt(node.position.start.offset),
            end: doc.positionAt(node.position.end.offset),
        };
        const symbol: DocumentSymbol = {
            name: textOf(node) || `H${String(depth)}`,
            kind: SymbolKind.String,
            range,
            selectionRange: range,
            children: [],
        };
        // Pop headings of equal or deeper level; the remaining top of stack,
        // if any, is this heading's parent.
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top && top.depth >= depth) {
                stack.pop();
            } else {
                break;
            }
        }
        const parent = stack[stack.length - 1];
        if (parent) {
            parent.symbol.children?.push(symbol);
        } else {
            roots.push(symbol);
        }
        stack.push({ depth, symbol });
    });

    return roots;
}

/**
 * Computes folding ranges for a `.sveltex` file.
 *
 * @param document - Full text of the `.sveltex` document.
 * @param config - Resolved SvelTeX config snapshot.
 * @returns Folding ranges for multi-line block constructs: headings (folding
 * down to the next same-or-higher heading), fenced code blocks, lists and
 * blockquotes.
 */
export function computeFoldingRanges(
    document: string,
    config: SveltexConfigSnapshot,
): FoldingRange[] {
    const root = parse(document, config);
    if (!root) return [];
    const doc = TextDocument.create('mem://md', 'sveltex', 0, document);
    const ranges: FoldingRange[] = [];

    /** Adds a folding range spanning `[startOffset, endOffset)` if multi-line. */
    const add = (
        startOffset: number,
        endOffset: number,
        kind?: FoldingRangeKind,
    ): void => {
        const startLine = doc.positionAt(startOffset).line;
        const endLine = doc.positionAt(endOffset).line;
        if (endLine > startLine) {
            ranges.push(
                kind === undefined
                    ? { startLine, endLine }
                    : { startLine, endLine, kind },
            );
        }
    };

    // Block-level constructs fold as a whole.
    walk(root, (node) => {
        /* v8 ignore next -- every parseToMdast node carries a position */
        if (!node.position) return;
        switch (node.type) {
            case 'code':
                add(
                    node.position.start.offset,
                    node.position.end.offset,
                    FoldingRangeKind.Region,
                );
                break;
            case 'list':
            case 'blockquote':
            case 'table':
                add(node.position.start.offset, node.position.end.offset);
                break;
            default:
                break;
        }
    });

    // Headings fold from their own line down to the line before the next
    // heading of the same or higher level (or end of document).
    interface HeadingMark {
        depth: number;
        startOffset: number;
    }
    const headings: HeadingMark[] = [];
    walk(root, (node) => {
        if (node.type === 'heading' && node.position) {
            headings.push({
                /* v8 ignore next -- parseToMdast always sets heading `depth` */
                depth: node.depth ?? 1,
                startOffset: node.position.start.offset,
            });
        }
    });
    for (let i = 0; i < headings.length; i++) {
        const current = headings[i];
        /* v8 ignore next -- `i` is bounded by `headings.length`, so `current` is defined */
        if (!current) continue;
        let endOffset = document.length;
        for (let j = i + 1; j < headings.length; j++) {
            const next = headings[j];
            if (next && next.depth <= current.depth) {
                endOffset = next.startOffset;
                break;
            }
        }
        // End the fold at the end of the previous line, not the next heading.
        const endLine = Math.max(
            doc.positionAt(current.startOffset).line,
            doc.positionAt(endOffset).line - 1,
        );
        const startLine = doc.positionAt(current.startOffset).line;
        if (endLine > startLine) {
            ranges.push({ startLine, endLine });
        }
    }

    return ranges;
}

/**
 * Computes selection ranges for a `.sveltex` file: for each requested
 * {@link Position}, the chain of progressively larger mdast nodes that contain
 * it.
 *
 * @param document - Full text of the `.sveltex` document.
 * @param positions - The caret positions to expand.
 * @param config - Resolved SvelTeX config snapshot.
 * @returns One {@link SelectionRange} per input position (index-aligned). A
 * position with no enclosing node yields a degenerate empty range.
 */
export function computeSelectionRanges(
    document: string,
    positions: Position[],
    config: SveltexConfigSnapshot,
): SelectionRange[] {
    const root = parse(document, config);
    const doc = TextDocument.create('mem://md', 'sveltex', 0, document);

    return positions.map((position) => {
        const offset = doc.offsetAt(position);
        // Collect every node whose span contains `offset`, smallest last.
        const containing: MdNode[] = [];
        if (root) {
            walk(root, (node) => {
                /* v8 ignore next -- every parseToMdast node carries a position */
                if (!node.position) return;
                const start = node.position.start.offset;
                const end = node.position.end.offset;
                if (offset >= start && offset <= end) {
                    containing.push(node);
                }
            });
        }
        containing.sort((a, b) => {
            // The `?? 0` fallbacks never fire: only positioned nodes reach
            // `containing` (the walk above pushes them under `node.position`).
            /* v8 ignore start */
            const aLen =
                (a.position?.end.offset ?? 0) - (a.position?.start.offset ?? 0);
            const bLen =
                (b.position?.end.offset ?? 0) - (b.position?.start.offset ?? 0);
            /* v8 ignore stop */
            return bLen - aLen; // widest first
        });

        // Build the nested chain from widest to narrowest.
        let selectionRange: SelectionRange | undefined;
        for (const node of containing) {
            /* v8 ignore next -- `containing` holds only positioned nodes */
            if (!node.position) continue;
            const range: Range = {
                start: doc.positionAt(node.position.start.offset),
                end: doc.positionAt(node.position.end.offset),
            };
            selectionRange = selectionRange
                ? { range, parent: selectionRange }
                : { range };
        }
        return selectionRange ?? { range: { start: position, end: position } };
    });
}
