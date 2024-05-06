/**
 * WARNING: At the time of writing, Svelte ASTs are NOT part of the public API,
 * and are subject to change at any time. While the types for which these type
 * guards are written are defined locally, they're intended to generalize
 * Svelte's types. Accordingly, even minor updates to Svelte may break the
 * intended behavior of this module.
 */

// Types
import type {
    BaseNode,
    BaseNode_ESTree,
    BaseNode_v4,
    BaseNode_v5,
    Fragment_v5,
    LineColumn,
    StartEnd_LineColumn,
    StartEnd_Offset,
} from '$types';

/**
 * Type guard for `BaseNode`.
 *
 * @param node - The node to check.
 * @returns True if the node is of type `BaseNode`, and false otherwise.
 */
export function isBaseNode(node: unknown): node is BaseNode {
    return typeof node === 'object' && node !== null && 'type' in node;
}

/**
 * Checks that the given object has `start` and `end` properties, no matter
 * their types.
 */
export function hasStartEndUnknown(
    obj: unknown,
): obj is { start: unknown; end: unknown } {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'start' in obj &&
        'end' in obj
    );
}

/**
 * Checks that the given node has `start` and `end` properties, that both of them are
 * numbers, and that 0 ≤ `start` ≤ `end`.
 */
export function hasStartEnd(
    node: unknown,
): node is { start: number; end: number } {
    return (
        hasStartEndUnknown(node) &&
        typeof node.start === 'number' &&
        typeof node.end === 'number' &&
        node.start >= 0 &&
        node.end >= node.start
    );
}

/**
 * Type guard for {@link StartEnd_Offset | `StartEnd_Offset`}.
 */
export function hasStartEnd_Offset(node: unknown): node is StartEnd_Offset {
    return (
        hasStartEndUnknown(node) &&
        typeof node.start === 'object' &&
        typeof node.end === 'object' &&
        node.start !== null &&
        node.end !== null &&
        'offset' in node.start &&
        'offset' in node.end &&
        typeof node.start.offset === 'number' &&
        typeof node.end.offset === 'number' &&
        node.start.offset >= 0 &&
        node.end.offset >= node.start.offset
    );
}

/**
 * Type guard for {@link LineColumn | `LineColumn`}.
 */
export function isLineColumn(obj: unknown): obj is LineColumn {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'line' in obj &&
        'column' in obj &&
        typeof obj.line === 'number' &&
        typeof obj.column === 'number' &&
        obj.line >= 1 &&
        obj.column >= 0
    );
}

/**
 * ESTree-compliant nodes may have a `loc` property, which is an object with
 * `start` and `end` properties, both of which are objects with `line` and
 * `column` properties. This type guard checks for the presence of such `start`
 * and `end` properties (so the value of the `loc` property would be expected to
 * pass this type guard).
 *
 * This type guard also checks that the `end` position is not before the `start`
 * position, and that both `line` values are ≥ 1 and both `column` values are ≥
 * 0.
 */
export function hasStartEnd_LineColumn(
    node: unknown,
): node is StartEnd_LineColumn {
    return (
        hasStartEndUnknown(node) &&
        isLineColumn(node.start) &&
        isLineColumn(node.end) &&
        node.end.line >= node.start.line &&
        (node.end.line > node.start.line ||
            node.end.column >= node.start.column)
    );
}

/**
 * ESTree-compliant nodes may have a `range` property, which is an array of two
 * numbers. This type guard checks for the presence of that property.
 */
export function hasRange(node: unknown): node is { range: [number, number] } {
    return (
        typeof node === 'object' &&
        node !== null &&
        'range' in node &&
        node.range instanceof Array &&
        node.range.length === 2 &&
        typeof node.range[0] === 'number' &&
        typeof node.range[1] === 'number' &&
        node.range[0] <= node.range[1]
    );
}

/**
 * Type guard for `BaseNode`.
 *
 * @param node - The node to check.
 * @returns True if the node is of type `BaseNode`, and false otherwise.
 */
export function isBaseNode_v5(node: unknown): node is BaseNode_v5 {
    return isBaseNode(node) && hasStartEnd(node);
}

/**
 * Type guard for `BaseNode_v4`.
 *
 * @param node - The node to check.
 * @returns True if the node is of type `BaseNode_v4`, and false otherwise.
 */
export function isBaseNode_v4(node: unknown): node is BaseNode_v4 {
    return isBaseNode(node) && hasStartEnd(node);
}

/**
 * Type guard for {@link Fragment_v5 | `Fragment_v5`}.
 *
 * @param node - The node to check.
 * @returns True if the node is of type `Fragment_v5`, and false otherwise.
 */
export function isFragment_v5(node: unknown): node is Fragment_v5 {
    return (
        isBaseNode_v5(node) &&
        node.type === 'Fragment' &&
        'nodes' in node &&
        (node['nodes'] === null ||
            node['nodes'] === undefined ||
            (typeof node['nodes'] === 'object' &&
                Array.isArray(node['nodes']) &&
                node['nodes'].every(isBaseNode_v5)))
    );
}

/**
 *
 */
export function isBaseNode_ESTree(node: unknown): node is BaseNode_ESTree {
    return (
        isBaseNode(node) &&
        (hasRange(node) ||
            ('loc' in node && hasStartEnd_LineColumn(node['loc'])))
    );
}
