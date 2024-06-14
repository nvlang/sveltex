// Types
import type { LineColumn, Offsets } from '$types/utils/Ast.js';
import type { UnistNode } from '$deps.js';

// Internal dependencies
import { hasStartEnd_LineColumn, hasStartEnd_Offset } from '$typeGuards/ast.js';

// External dependencies
import { inspect } from '$deps.js';

/**
 * Converts a range given with line-column numbers to a location object.
 * @param start - The starting line and column numbers.
 * @param end - The ending line and column numbers.
 * @param source - The source code as a string or an array of strings.
 * @returns The location object with start and end offsets.
 */
export function lineColToLocation(
    start: LineColumn,
    end: LineColumn,
    lines: string[],
    columnIsOneBased: boolean = false,
): Offsets {
    const startOffset = lines
        .slice(0, start.line - 1)
        .reduce((sum, line) => sum + line.length + 1, 0);
    const endOffset = lines
        .slice(0, end.line - 1)
        .reduce((sum, line) => sum + line.length + 1, 0);
    return {
        start: startOffset + start.column - +columnIsOneBased,
        end: endOffset + end.column - +columnIsOneBased,
    };
}

export function getLocationUnist(node: UnistNode, lines: string[]): Offsets {
    if (hasStartEnd_Offset(node.position)) {
        return {
            start: node.position.start.offset,
            end: node.position.end.offset,
        };
    }
    // Technically, the offset values are optional in the UNIST spec, but
    // micromark always includes them, so the code below won't ever run during
    // normal Sveltex operation (we still cover it with unit tests, though).
    if (hasStartEnd_LineColumn(node.position)) {
        const { start, end } = lineColToLocation(
            node.position.start,
            node.position.end,
            lines,
            true,
        );
        return { start, end };
    }
    throw new Error(`Could not determine location of node: ${inspect(node)}`);
}

/**
 * Recursively walks
 * ({@link https://en.wikipedia.org/wiki/Depth-first_search | depth-first})
 * through an {@link https://github.com/syntax-tree/mdast | MDAST} and performs
 * an action on each node.
 *
 * @param node - The current node to process.
 * @param action - The action to perform on each node. It should return `true`
 * to continue walking the tree, or `false` to stop with this specific branch.
 * @param depth - The depth of the current node in the MDAST. This parameter is
 * passed to the action function, and should generally not be set by the user.
 */
export function walkMdast(
    node: UnistNode & { children?: UnistNode[] },
    action: (
        node: UnistNode & { children?: UnistNode[] },
        depth: number,
    ) => boolean,
    depth: number = 0,
): void {
    if (action(node, depth)) {
        node.children?.forEach((child) => {
            walkMdast(child, action, depth + 1);
        });
    }
}
