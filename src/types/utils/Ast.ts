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
export interface Offsets {
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

    /**
     * Used for LaTeX verbatim environments, to shift the line numbers from
     * error messages. Should correspond to line number of the first line of the
     * inner content of the verbatim environment.
     */
    lineOffset?: number;
}

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
