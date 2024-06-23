/**
 * WARNING: At the time of writing, Svelte ASTs are NOT part of the public API,
 * and are subject to change at any time. While the types for which these type
 * guards are written are defined locally, they're intended to generalize
 * Svelte's types. Accordingly, even minor updates to Svelte may break the
 * intended behavior of this module.
 */

// Types
import type {
    LineColumn,
    StartEnd_LineColumn,
    StartEnd_Offset,
} from '$types/utils/Ast.js';

/**
 * Checks that the given object has `start` and `end` properties, no matter
 * their types.
 */
function hasStartEndUnknown(
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
function isLineColumn(obj: unknown): obj is LineColumn {
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
