/* eslint-disable tsdoc/syntax */
import type { RequiredNonNullable } from '$types/utils/utility-types.js';

/**
 * A string transformation, where the first element is a regex or string to
 * match, and the second element is the replacement string. The replacement
 * string can contain `$1`, `$2`, etc. to refer to capture groups in the regex.
 * In particular, the transformation will be performed by calling
 * `.replaceAll()` on the string with the regex and replacement string as first
 * and second arguments, respectively, so any features that the `.replaceAll()`
 * method supports can be used here too.
 */
export type Transformation<Options extends object = object> =
    | [RegExp | string, string]
    | ((str: string, opts: Options) => string);

export interface PreAndPostTransformations<Options extends object> {
    /**
     * Transformations to apply to the tex content before passing it to the TeX
     * backend for processing.
     *
     * @remarks Each transformation may be a function `(str: string, opts:
     * Options) => string`, or a 2-tuple `[string | RegExp, string]`. The
     * transformations are called in the order they are listed on the output of
     * the previous transformation (or on the original content if it's the first
     * transformation). Each transformation `transformation` is applied as
     * follows, depending on its type:
     * - 2-tuple: `transformed = content.replaceAll(...transformation)`
     * - Function: `transformed = transformation(content, opts)`
     */
    pre?:
        | Transformation<Options>
        | Transformation<Options>[]
        | undefined
        | null;

    /**
     * Transformations to apply to the output produced by Sveltex.
     *
     * @remarks Each transformation may be a function `(str: string, opts:
     * Options) => string`, or a 2-tuple `[string | RegExp, string]`. The
     * transformations are called in the order they are listed on the output of
     * the previous transformation (or on the original content if it's the first
     * transformation). Each transformation `transformation` is applied as
     * follows, depending on its type:
     * - 2-tuple: `transformed = content.replaceAll(...transformation)`
     * - Function: `transformed = transformation(content, opts)`
     */
    post?:
        | Transformation<Options>
        | Transformation<Options>[]
        | undefined
        | null;
}

export interface NoneConfiguration {
    type: 'none';
}

export interface CdnConfiguration {
    type?: 'cdn' | undefined;

    /**
     * What CDN to use for the `href` attribute of the `link` tag.
     *
     * @defaultValue `'jsdelivr'`
     *
     * @example
     * If `cdn` is `'jsdelivr'`, the following code may be generated for, say,
     * `highlight.js`:
     *
     * ```html
     * <svelte:head>
     * <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/default.min.css" />
     * </svelte:head>
     * ```
     */
    cdn?: SupportedCdn | undefined;
}

export interface HybridCssConfiguration extends HasTimeout, HasDir {
    type: 'hybrid';

    /**
     * What CDN or CDNs to use to fetch the stylesheet. If an array is provided,
     * the first CDN is queried, and if it fails, the next one is queried, and
     * so on.
     *
     * The stylesheet will be modified to ensure that all its URLs use the first
     * CDN in the array instead of a relative path.
     *
     * @defaultValue `['jsdelivr', 'esm.sh', 'unpkg']`
     */
    cdn?: SupportedCdn | [SupportedCdn, ...SupportedCdn[]] | undefined;
}

export interface SelfHostedCssConfiguration extends HasTimeout, HasDir {
    type: 'self-hosted';

    /**
     * What CDN or CDNs to use to fetch the stylesheet. If an array is provided,
     * the first CDN is queried, and if it fails, the next one is queried, and
     * so on.
     *
     * @defaultValue `['jsdelivr', 'esm.sh', 'unpkg']`
     */
    cdn?: SupportedCdn | [SupportedCdn, ...SupportedCdn[]] | undefined;
}

interface HasTimeout {
    /**
     * The timeout for fetching the stylesheet, in milliseconds.
     */
    timeout?: number | undefined;
}

interface HasDir {
    /**
     * The directory to write the stylesheet to after fetching it from a CDN.
     * This is relative to the project root.
     *
     * @defaultValue `'src/sveltex'`
     */
    dir?: string | undefined;
}

export type FullCssConfiguration<T extends CssApproach = CssApproach> =
    RequiredNonNullable<CssConfiguration<T>>;

export type CssConfiguration<T extends CssApproach = CssApproach> = {
    /**
     * - `'cdn'`: Load the resource from a CDN with a `<link>` element in
     *   `<svelte:head>`.
     * - `'self-hosted'`: Fetch the resource from a CDN once, write it to the
     *   local filesystem, and then import it with a `<link>` tag in
     *   `<svelte:head>`.
     * - `'hybrid'`: For MathJax and KaTeX; self-host the CSS, but use a CDN for
     *   the fonts.
     * - `'none'`: Do none of the above.
     *
     * @defaultValue `'cdn'`
     */
    type?: T | undefined;
} & (
    | CdnConfiguration
    | HybridCssConfiguration
    | SelfHostedCssConfiguration
    | NoneConfiguration
);

type CssApproach = 'cdn' | 'hybrid' | 'self-hosted' | 'none';

export type SupportedCdn = 'jsdelivr' | 'esm.sh' | 'unpkg';

export type MathjaxCssConfiguration<
    T extends 'hybrid' | 'none' = 'hybrid' | 'none',
> = CssConfiguration<T>;

export type FullMathjaxCssConfiguration<
    T extends 'hybrid' | 'none' = 'hybrid' | 'none',
> = RequiredNonNullable<MathjaxCssConfiguration<T>>;

export type KatexCssConfiguration<
    T extends 'cdn' | 'hybrid' | 'none' = 'cdn' | 'hybrid' | 'none',
> = CssConfiguration<T>;

export type FullKatexCssConfiguration<
    T extends 'cdn' | 'hybrid' | 'none' = 'cdn' | 'hybrid' | 'none',
> = RequiredNonNullable<KatexCssConfiguration<T>>;
