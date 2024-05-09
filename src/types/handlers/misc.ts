import { RequiredNonNullable } from '$types/utils/utility-types.js';
import { highlightJsThemeNames, starryNightThemeNames } from 'src/data/code.js';

export interface CssConfiguration {
    /**
     * @defaultValue `'src/sveltex'`
     */
    dir?: string | undefined;

    /**
     * @defaultValue `true`
     */
    write?: boolean | undefined;

    /**
     * Whether to import the CSS file in the Svelte component.
     *
     * @defaultValue `true`
     */
    read?: boolean | undefined;
}

export interface CdnConfiguration {
    /**
     * What CDNs to use to fetch the stylesheet. If an array is provided, the
     * first CDN is queried, and if it fails, the next one is queried, and so
     * on.
     *
     * @defaultValue `['jsdelivr', 'esm.sh', 'unpkg']`
     */
    cdn?: SupportedCdn | SupportedCdn[] | undefined;

    /**
     * The timeout for fetching the stylesheet, in milliseconds.
     * If the timeout is reached, the next CDN is queried, if available.
     *
     * @defaultValue `1000`
     */
    timeout?: number | undefined;
}

export type SupportedCdn = 'jsdelivr' | 'esm.sh' | 'unpkg';

export type MathjaxCssConfiguration = CssConfiguration;
export type KatexCssConfiguration = CssConfiguration & CdnConfiguration;
export type FullMathjaxCssConfiguration =
    RequiredNonNullable<MathjaxCssConfiguration>;
export type FullKatexCssConfiguration =
    RequiredNonNullable<KatexCssConfiguration>;

export interface StarryNightTheme extends CdnConfiguration, CssConfiguration {
    /**
     * Name of the theme to use.
     */
    name: StarryNightThemeName;

    /**
     * - `'light'`: Fetch the light theme.
     * - `'dark'`: Fetch the dark theme.
     * - `'both'`: Fetch CSS file that uses
     *   [`prefers-color-scheme`](https://developer.mozilla.org/docs/Web/CSS/%40media/prefers-color-scheme)
     *   to dynamically pick the theme mode.
     *
     * @defaultValue `'both'`
     */
    mode?: 'light' | 'dark' | 'both';
}

export interface HighlightJsTheme extends CdnConfiguration, CssConfiguration {
    /**
     * Name of the theme to use.
     *
     * @defaultValue `'default'`
     */
    name?: HighlightJsThemeName | undefined;

    /**
     * Whether to fetch the minified version of the theme.
     *
     * @defaultValue `false`
     */
    min?: boolean | undefined;
}

export type StarryNightThemeName = (typeof starryNightThemeNames)[number];
export type HighlightJsThemeName = (typeof highlightJsThemeNames)[number];
