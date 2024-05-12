import type { CodeBackend } from '$types/handlers/Code.js';
import type { RequiredNonNullable } from '$types/utils/utility-types.js';
import { highlightJsThemeNames, starryNightThemeNames } from '$data/code.js';

export interface NoneConfiguration {
    /**
     * - `'cdn'`: Add a CDN link to `<svelte:head>` to load the resource.
     * - `'self-hosted'`: Fetch the resource from a CDN once, write it to the
     *   local filesystem, and then import it from there inside `<script>`.
     * - `'none'`: Do none of the above.
     *
     * @defaultValue `'cdn'`
     */
    type: 'none';
}

export interface CdnConfiguration {
    /**
     * - `'cdn'`: Add a CDN link to `<svelte:head>` to load the resource.
     * - `'self-hosted'`: Fetch the resource from a CDN once, write it to the
     *   local filesystem, and then import it from there inside `<script>`.
     * - `'none'`: Do none of the above.
     *
     * @defaultValue `'cdn'`
     */
    type?: 'cdn';

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

export type FullCssConfiguration<T extends CssApproach> = RequiredNonNullable<
    Pick<
        CssConfiguration<T>,
        T extends 'cdn'
            ? 'type' | 'cdn'
            : T extends 'self-hosted'
              ? 'type' | 'timeout' | 'dir'
              : 'type'
    >
>;

/**
 * @typeParam T - The type of configuration to use.
 * - `'cdn'`: Add a CDN link to `<svelte:head>` to load the resource.
 * - `'self-hosted'`: Fetch the resource from a CDN once, write it to the
 *   local filesystem, and then import it from there inside `<script>`.
 * - `'none'`: Do none of the above.
 */
export interface CssConfiguration<T extends CssApproach> {
    type: T;

    /**
     * #### `T extends 'cdn'`
     *
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
     *
     * ---
     * #### `T extends 'self-hosted'`
     *
     * What CDNs to use to fetch the stylesheet. If an array is provided, the
     * first CDN is queried, and if it fails, the next one is queried, and so
     * on.
     *
     * @defaultValue `['jsdelivr', 'esm.sh', 'unpkg']`
     */
    cdn?: T extends 'cdn'
        ? SupportedCdn | undefined
        : T extends 'self-hosted'
          ? SupportedCdn | SupportedCdn[] | undefined
          : never;

    /**
     * The timeout for fetching the stylesheet, in milliseconds.
     * If the timeout is reached, the next CDN is queried, if available.
     *
     * @defaultValue `1000`
     */
    timeout?: T extends 'self-hosted' ? number | undefined : never;

    /**
     * The directory to write the stylesheet to when fetching it from a CDN.
     * This is relative to the project root.
     *
     * @defaultValue `'src/sveltex'`
     */
    dir?: T extends 'self-hosted' ? string | undefined : never;
}

export type CssApproachLocal = 'self-hosted' | 'none';
export type CssApproach = 'cdn' | CssApproachLocal;

export type SupportedCdn = 'jsdelivr' | 'esm.sh' | 'unpkg';

export type MathjaxCssConfiguration<
    T extends CssApproachLocal = CssApproachLocal,
> = CssConfiguration<T>;
export type KatexCssConfiguration<T extends CssApproach = CssApproach> =
    CssConfiguration<T>;
export type FullMathjaxCssConfiguration<
    T extends CssApproachLocal = CssApproachLocal,
> = RequiredNonNullable<MathjaxCssConfiguration<T>>;
export type FullKatexCssConfiguration<T extends CssApproach = CssApproach> =
    RequiredNonNullable<KatexCssConfiguration<T>>;

export type FullCodeTheme<
    B extends CodeBackend,
    T extends CssApproach = CssApproach,
> = RequiredNonNullable<CodeTheme<B, T>>;

export interface CodeTheme<
    B extends CodeBackend,
    T extends CssApproach = CssApproach,
> extends CssConfiguration<T> {
    /**
     * Name of the theme to use.
     *
     * @defaultValue `'default'`
     */
    name?:
        | (B extends 'starry-night'
              ? StarryNightThemeName
              : B extends 'highlight.js'
                ? HighlightJsThemeName
                : never)
        | undefined;

    /**
     * - `'light'`: Fetch the light theme.
     * - `'dark'`: Fetch the dark theme.
     * - `'both'`: Fetch CSS file that uses
     *   [`prefers-color-scheme`](https://developer.mozilla.org/docs/Web/CSS/%40media/prefers-color-scheme)
     *   to dynamically pick the theme mode.
     *
     * @defaultValue `'both'`
     * @remarks Only applicable to `starry-night` themes.
     */
    mode?: B extends 'starry-night' ? 'light' | 'dark' | 'both' : never;

    /**
     * Whether to fetch the minified version of the theme.
     *
     * @defaultValue `true`
     */
    min?: B extends 'highlight.js' ? boolean | undefined : never;
}

export type StarryNightThemeName = (typeof starryNightThemeNames)[number];
export type HighlightJsThemeName = (typeof highlightJsThemeNames)[number];
