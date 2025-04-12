// File description: Types related to the `Handler` class.

/* eslint-disable tsdoc/syntax */
import type { ProcessedSnippet } from '../utils/Escape.js';

/**
 * A transformer. Two types of transformers are supported:
 *
 * - `[RegExp | string, string]`: the first element is a regex or string to
 *   match, and the second element is the replacement string. The replacement
 *   string can contain `$1`, `$2`, etc. to refer to capture groups in the
 *   regex. In particular, the transformation will be performed by calling
 *   `.replaceAll()` on the string on which the transformation is being applied,
 *   with the regex and replacement string as first and second arguments,
 *   respectively; accordingly, any features that the `.replaceAll()` method
 *   supports can be used here too.
 * - `(str: string, opts: Options) => string`: a function that takes the string
 *   to which the transformation is being applied and an `Options` object (which
 *   may contain additional information about the contents of the string or the
 *   context in which it was found), and returns the transformed string.
 *
 * @typeParam Options - The type of the options object that may be passed to the
 * transformation functions. Generally speaking, this should be or extend the
 * `ProcessOptions` type parameter of the `Handler` class in which the
 * transformer is being called.
 */
export type Transformer<Options extends object = object> =
    | [RegExp | string, string]
    | ((str: string, opts: Options) => string);

export interface Transformers<Options extends object> {
    /**
     * Transformations to apply to the content before passing it to the backend
     * for processing.
     *
     * @remarks Each transformation may be a function `(str: string, opts:
     * Options) => string`, or a 2-tuple `[string | RegExp, string]`. The
     * transformers are called in the order they are listed on the output of the
     * previous transformation (or on the original content if it's the first
     * transformation). Each transformation `transformation` is applied as
     * follows, depending on its type:
     * - 2-tuple: `transformed = content.replaceAll(...transformation)`
     * - Function: `transformed = transformation(content, opts)`
     */
    pre?: Transformer<Options> | Transformer<Options>[] | undefined | null;

    /**
     * Transformations to apply to the output produced by the backend.
     *
     * @remarks Each transformation may be a function `(str: string, opts:
     * Options) => string`, or a 2-tuple `[string | RegExp, string]`. The
     * transformers are called in the order they are listed on the output of
     * the previous transformation (or on the original content if it's the first
     * transformation). Each transformation `transformation` is applied as
     * follows, depending on its type:
     * - 2-tuple: `transformed = content.replaceAll(...transformation)`
     * - Function: `transformed = transformation(content, opts)`
     */
    post?:
        | Transformer<Options & WithOriginal>
        | Transformer<Options & WithOriginal>[]
        | undefined
        | null;
}

interface WithOriginal {
    /**
     * The original content that was passed to the backend for processing. This
     * is before pre-transformations were applied, too.
     */
    original: string;
}

/**
 * Generic type for the a handler's `process` function, as returned by the
 * handler's getter for the function.
 *
 * @typeParam ProcessOptions - The type of the options object that the handler
 * accepts for processing.
 */
export type SimplerProcessFn<ProcessOptions extends object> = (
    content: string,
    options: ProcessOptions,
) => ProcessedSnippet | Promise<ProcessedSnippet>;

/**
 * Generic type for the a handler's `process` function, as stored internally and
 * set during the handler's initialization.
 *
 * @typeParam ProcessOptions - The type of the options object that the handler
 * accepts for processing.
 * @typeParam H - The type of the handler that the function is associated with.
 */
export type ProcessFn<ProcessOptions extends object, H> = (
    content: string,
    options: ProcessOptions,
    handler: H,
) => string | ProcessedSnippet | Promise<string | ProcessedSnippet>;
