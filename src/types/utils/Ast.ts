/**
 * This interface is a generalization of the `BaseNode` type from the API of
 * Svelte 4, Svelte 5, and ESTree. It's just about the most general type that
 * we can use to represent a node in a Svelte AST.
 */
export interface BaseNode extends Record<string, unknown> {
    type: string;
}

/**
 * This interface describes the location of a node in an AST. It's used by
 * SvelTeX internally, and is not trying to extend any type from the Svelte API
 * or the `@types/estree` package.
 *
 * @remarks
 * The `start` property is understood to be inclusive, whereas the `end`
 * property is understood to be exclusive. In other words, given a string
 * `'0123'` and a `Location` object `{ start: 0, end: 2 }`, the `Location` would
 * refer to the substring `'01'`.
 */
export interface Location {
    /**
     * The index of the first character of the substring to which this
     * `Location` object refers.
     */
    start: number;
    /**
     * The index of the character immediately following the last character of
     * the substring to which this `Location` object refers.
     */
    end: number;
}

/**
 * This is a generalization of the `BaseNode` type from the API of Svelte 5,
 * with only the properties that are relevant to us being required.
 *
 * @see
 * https://github.com/sveltejs/svelte/blob/3196077b5d3baf80dd7e17c06a9dd0aebdd51431/packages/svelte/types/index.d.ts#L1075-L1081
 */
export interface BaseNode_v5 extends BaseNode {
    start: number;
    end: number;
}

/**
 * This is a generalization of the `Fragment` type from the API of Svelte 5,
 * with only the properties that are relevant to us being required.
 *
 * @see
 * https://github.com/sveltejs/svelte/blob/3196077b5d3baf80dd7e17c06a9dd0aebdd51431/packages/svelte/types/index.d.ts#L1083-L1092
 */
export interface Fragment_v5 extends BaseNode {
    type: 'Fragment';
    nodes: BaseNode_v5[];
}

/**
 * This is a generalization of the `Ast` type from the API of Svelte 4, with
 * only the properties that are relevant to us being required.
 *
 * @remarks
 * The definition of the `Ast` type in Svelte 4.2.12:
 * ```ts
 * export interface Ast {
 *     html: TemplateNode;
 *     css?: Style;
 *     instance?: Script;
 *     module?: Script;
 * }
 * ```
 * Note that the `TemplateNode` type above is defined as the union of a bunch of
 * other types, each of which extends the `BaseNode` interface (from Svelte 4).
 * Since our `BaseNode_v4` type is a generalization of that interface, there
 * should be no type incompatibility issues here.
 */
export interface Ast_v4 extends Record<string, unknown> {
    html: BaseNode_v4;
}

/**
 * This is a generalization of the `BaseNode` type from the API of Svelte 4,
 * with only the properties that are relevant to us being required.
 *
 * @remarks
 * The definition of the `BaseNode` type in Svelte 4.2.12:
 * ```ts
 * interface BaseNode {
 *     start: number;
 *     end: number;
 *     type: string;
 *     children?: TemplateNode[];
 *     [prop_name: string]: any;
 * }
 * ```
 * Note that the `TemplateNode` type above is defined as the union of a bunch of
 * other types, each of which extends the `BaseNode` interface (from Svelte 4).
 * Since our `BaseNode_v4` type is a generalization of that interface, there
 * should be no type incompatibility issues here.
 */
export interface BaseNode_v4 extends BaseNode {
    type: string;
    start: number;
    end: number;
    children?: BaseNode_v4[];
}

/**
 * This is a generalization of the `BaseNode` type from the `@types/estree`
 * package.
 */
export interface BaseNode_ESTree extends BaseNode {
    /**
     * The location of the node in the source code. This is a zero-based index
     * that refers to the character offset at which the node begins and ends.
     * The first element of the tuple is the start position, and the second
     * element is the end position.
     */
    range?: [number, number];
    /**
     *
     */
    loc?: StartEnd_LineColumn;
}

export type BaseNode_Weird =
    | { loc: StartEnd_Offset | StartEnd_LineColumn }
    | StartEnd_Offset
    | StartEnd_LineColumn;

export interface StartEnd_Offset {
    start: {
        offset: number;
    };
    end: {
        offset: number;
    };
}

/**
 * This interface describes the location of a node in an AST. It
 */
export interface StartEnd_LineColumn {
    start: LineColumn;
    end: LineColumn;
}

export interface LineColumn {
    /**
     * The line number of the start of the node in the source code. This is
     * a 1-based index, i.e., we must always have `line >= 1`.
     */
    line: number;
    /**
     * The column number of the start of the node in the source code. This is
     * a 0-based index, i.e., we must always have `column >= 0`.
     */
    column: number;
}
