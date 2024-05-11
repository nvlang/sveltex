/**
 * WARNING: At the time of writing, Svelte ASTs are NOT part of the public API,
 * and are subject to change at any time. Accordingly, even minor updates to
 * Svelte may break the functionality of this module.
 */

// Types
import type {
    Ast_v4,
    BaseNode,
    BaseNode_v5,
    LineColumn,
    Location,
} from '$types/utils/Ast.js';

// Internal dependencies
import { SVELTE_MAJOR_VERSION } from '$utils/globals.js';
import { escapeWhitespace } from '$utils/debug.js';
import {
    hasRange,
    hasStartEnd,
    hasStartEnd_LineColumn,
    hasStartEnd_Offset,
    isBaseNode,
    isBaseNode_ESTree,
    isBaseNode_v4,
    isBaseNode_v5,
    isFragment_v5,
} from '$type-guards/ast.js';

// External dependencies
import { svelteParse } from '$deps.js';

/**
 * One of the differences between the parser from Svelte 5 (when the `modern`
 * option is set to `true`) and the parser from Svelte 4 is that, with the
 * latter, there are some nodes which may contain children nodes in properties
 * other than `children`. This is the case the nodes of type `IfBlock`,
 * `EachBlock`, and `AwaitBlock`.
 */
const otherChildrenProps_v4: Record<string, string[]> = {
    IfBlock: ['else'],
    // ElseBlock: [],
    EachBlock: ['else'],
    // KeyBlock: [],
    AwaitBlock: ['pending', 'then', 'catch'],
    // PendingBlock: [], ThenBlock: [], CatchBlock: [],
};

/**
 * Keys which either never point to children nodes, or which point to children
 * nodes which we are not interested in.
 */
const notRelevantChildrenKeys = new Set([
    'type',
    'expression',
    'attributes',
    'start',
    'end',
    'loc',
    'name',
]);

/**
 * Utility function to push the start and end positions of a node to an array
 * of ranges if the node is of a certain type. Useful as a callback for the
 * {@link walk | `walk`} function.
 */
export function pushRangeIf(type: string, ranges: Location[], content: string) {
    /**
     * Pushes the start and end positions of `node` to
     * {@link textRanges | `textRanges`} iff `node.type === type`.
     *
     * @param node - The node to process.
     */
    return (node: BaseNode) => {
        if (node.type === type) {
            ranges.push(getLocation(node, content));
        }
    };
}

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
    source: string | string[],
): Location {
    const lines = Array.isArray(source) ? source : source.split('\n');
    const startOffset = lines
        .slice(0, start.line - 1)
        .reduce((sum, line) => sum + line.length, 0);
    const endOffset = lines
        .slice(0, end.line - 1)
        .reduce((sum, line) => sum + line.length, 0);
    return { start: startOffset + start.column, end: endOffset + end.column };
}

/**
 * Get the location of a node in the source code.
 *
 * @param node - The node for which to get the location.
 * @param source - The source code of the file in which the node is located.
 * @param version - The major version of the Svelte compiler used to parse the
 * source code.
 * @returns The location of the node in the source code.
 * @throws If the location of the node could not be determined.
 */
export function getLocation(
    node: BaseNode,
    source?: string | string[],
    version: number | undefined = SVELTE_MAJOR_VERSION,
): Location {
    if (version === 5 && isBaseNode_v5(node)) {
        return {
            start: node.start,
            end: node.end,
        };
    }

    if (version === 4 && isBaseNode_v4(node)) {
        return {
            start: node.start,
            end: node.end,
        };
    }

    if (hasStartEnd(node)) {
        return {
            start: node.start,
            end: node.end,
        };
    }

    if (isBaseNode_ESTree(node)) {
        if (hasRange(node)) {
            return {
                start: node.range[0],
                end: node.range[1],
            };
        }

        if ('loc' in node && hasStartEnd_LineColumn(node.loc)) {
            if (source) {
                return lineColToLocation(node.loc.start, node.loc.end, source);
            }
        }
    }

    if (hasStartEnd_Offset(node)) {
        return {
            start: node.start.offset,
            end: node.end.offset,
        };
    }

    if (hasStartEnd_LineColumn(node)) {
        if (source) {
            return lineColToLocation(node.start, node.end, source);
        }
    }

    if ('loc' in node && hasStartEnd_Offset(node['loc'])) {
        return {
            start: node['loc'].start.offset,
            end: node['loc'].end.offset,
        };
    }

    throw new Error(
        'Could not determine location of node: ' + JSON.stringify(node),
    );
}

/**
 * Get the children of a node.
 */
export function getChildren(
    node: BaseNode,
    version: number | undefined = SVELTE_MAJOR_VERSION,
): BaseNode[] {
    if (version === 5 && isFragment_v5(node)) {
        return [...node.nodes];
    }

    if (version === 4 && isBaseNode_v4(node)) {
        const children = [...(node.children ?? [])];
        if (node.type in otherChildrenProps_v4) {
            otherChildrenProps_v4[node.type]?.forEach((prop) => {
                const candidate = node[prop];
                if (candidate && isBaseNode_v4(candidate)) {
                    children.push(candidate);
                } else if (Array.isArray(candidate)) {
                    children.push(...candidate.filter(isBaseNode_v4));
                }
            });
        }
        return children;
    }

    const children: BaseNode[] = [];

    for (const key in node) {
        if (!notRelevantChildrenKeys.has(key)) {
            const candidate: unknown = node[key];
            if (isBaseNode(candidate)) {
                children.push(candidate);
            } else if (Array.isArray(candidate)) {
                children.push(...candidate.filter(isBaseNode));
            }
        }
    }

    return children;
}

/**
 * Recursively walks
 * ({@link https://en.wikipedia.org/wiki/Depth-first_search | depth-first})
 * through a Svelte
 * {@link https://en.wikipedia.org/wiki/Abstract_syntax_tree | AST} and performs
 * an action on each node.
 *
 * @param node - The current node to process.
 * @param action - The action to perform on each node.
 * @param depth - The depth of the current node in the AST. This parameter is
 * passed to the action function, and should generally not be set by the user.
 * @param version - The major version of the Svelte compiler used to parse the
 * source code. This parameter should generally not be set by the user.
 */
export function walk(
    node: BaseNode,
    action: (
        node: BaseNode,
        depth: number,
        version: number | undefined,
    ) => void,
    depth: number = 0,
    version: number | undefined = SVELTE_MAJOR_VERSION,
): void {
    action(node, depth, version);
    getChildren(node).forEach((child) => {
        walk(child, action, depth + 1, version);
    });
}

/**
 * Stringify a Svelte 5 AST (only the types of the nodes are printed).
 *
 * @param node - The Svelte 5 AST to stringify.
 * @param indentSize - The number of spaces to use for indentation. Default: 2.
 * @returns A string representation of the AST.
 *
 * @example
 * ```ts
 * const ast = parse('<div>hello, world!</div>');
 * console.log(stringifyAst(ast));
 * ```
 * The above snippet would print the following:
 * ```
 * Fragment
 *   Element (div)
 *     Text (hello, world!)
 * ```
 */
export function stringifyAst(node: BaseNode, indent: number = 2): string {
    const lines: string[] = [];
    walk(node, (node, depth) => {
        let info = '';
        if (node['name'] && typeof node['name'] === 'string') {
            info = ` (${node['name']})`;
        } else if (node['data']) {
            let data: string | object = node['data'];
            if (typeof data !== 'string') data = '[data]';
            info = escapeWhitespace(data);
            if (info.length > 25) {
                info = info.slice(0, 20) + '[...]';
            }
            info = ` (${info})`;
        }
        lines.push(' '.repeat(depth * indent) + node.type + info);
    });
    return lines.join('\n');
}

/**
 * Parse a Svelte file and return its AST.
 * @param content - The content of the Svelte file.
 * @param filename - The name of the file.
 * @returns The AST of the Svelte file.
 * @throws If the content could not be parsed.
 * @remarks This function is a wrapper around the `parse` function from the
 * Svelte compiler. It is used to ensure that the correct version of the AST is
 * returned, regardless of the version of the Svelte compiler used.
 * @see https://svelte.dev/docs#svelte_compile
 */
// We use type assertions here because we can only have one version of Svelte
// installed at a time as our `svelte` dev dependency, so that either this or
// the other call to `parse` would throw a type error otherwise. This is also
// why we exclude this from coverage.
/* eslint-disable */
/* v8 ignore next 35 */
export function parse(
    content: string,
    filename?: string,
): {
    ast: BaseNode;
    scriptPresent?: boolean | undefined;
    stylePresent?: boolean | undefined;
} {
    if (SVELTE_MAJOR_VERSION >= 5 && SVELTE_MAJOR_VERSION < 7) {
        return {
            ast: svelteParse(content, {
                filename,
                modern: true,
            } as any) as unknown as BaseNode_v5,
        };
    } else {
        const opts = filename ? { filename } : {};
        if (SVELTE_MAJOR_VERSION <= 4) {
            const ast_v4 = svelteParse(content, {
                ...opts,
            }) as unknown as Ast_v4;
            return {
                ast: ast_v4.html,
                scriptPresent: ast_v4['instance'] !== undefined,
                stylePresent: ast_v4['css'] !== undefined,
            };
        } else {
            return {
                ast: svelteParse(content, {
                    ...opts,
                }) as unknown as BaseNode,
            };
        }
    }
}
/* eslint-enable */
