import type { SupportedCdn } from '$data/cdn.js';
import type { RequiredNotNullOrUndefined } from '$types/utils/utility-types.js';

export type { SupportedCdn } from '$data/cdn.js';

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
     * @defaultValue
     * ```ts
     * 'jsdelivr'
     * ```
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
     * @defaultValue
     * ```ts
     * 'jsdelivr'
     * ```
     */
    cdn?: SupportedCdn | [SupportedCdn, ...SupportedCdn[]] | undefined;
}

interface HasTimeout {
    /**
     * The timeout for fetching the stylesheet, in milliseconds.
     *
     * @defaultValue `2000`
     */
    timeout?: number | undefined;
}

interface HasDir {
    /**
     * The directory to write the stylesheet to after fetching it from a CDN.
     * This is relative to the `static` folder.
     *
     * @defaultValue `'sveltex'`
     */
    dir?: string | undefined;

    /**
     * The `static` directory of the project, relative to the project root.
     *
     * @defaultValue `'static'`
     */
    staticDir?: string | undefined;
}

export type FullCssConfiguration<T extends CssApproach = CssApproach> =
    RequiredNotNullOrUndefined<CssConfiguration<T>>;

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

export type MathjaxCssConfiguration<
    T extends 'hybrid' | 'none' = 'hybrid' | 'none',
> = CssConfiguration<T>;

export type FullMathjaxCssConfiguration<
    T extends 'hybrid' | 'none' = 'hybrid' | 'none',
> = RequiredNotNullOrUndefined<MathjaxCssConfiguration<T>>;

export type KatexCssConfiguration<
    T extends 'cdn' | 'hybrid' | 'none' = 'cdn' | 'hybrid' | 'none',
> = CssConfiguration<T>;

export type FullKatexCssConfiguration<
    T extends 'cdn' | 'hybrid' | 'none' = 'cdn' | 'hybrid' | 'none',
> = RequiredNotNullOrUndefined<KatexCssConfiguration<T>>;
