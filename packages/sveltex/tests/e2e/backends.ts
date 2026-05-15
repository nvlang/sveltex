/**
 * Single source of truth for all backend combinations used in e2e tests.
 *
 * This file is intentionally kept free of any SvelteKit / Vite imports so
 * that it can be consumed by:
 *   - the generator script (generate.ts)
 *   - playwright.config.ts
 *   - individual per-project sveltex.config.js files (via the generator)
 *
 * Run with `tsx` (no build step required).
 */

// ─── Backend dimension types ──────────────────────────────────────────────────

export type MarkdownBackend = 'unified' | 'markdown-it' | 'micromark' | 'marked';

export type CodeBackend = 'shiki' | 'starry-night' | 'highlight.js' | 'escape';

/**
 * Math backend key as used in file-system paths / Playwright project names.
 * The format is `<engine>` for KaTeX and `<engine>-<output>-<font>` for MathJax.
 */
export type MathBackendKey =
    | 'katex'
    | 'mathjax-svg-newcm'
    | 'mathjax-svg-fira'
    | 'mathjax-chtml-newcm'
    | 'mathjax-chtml-fira';

export type BackendCombo = [MarkdownBackend, CodeBackend, MathBackendKey];

// ─── Dimension values ─────────────────────────────────────────────────────────

export const MARKDOWN_BACKENDS: MarkdownBackend[] = [
    'unified',
    'markdown-it',
    'micromark',
    'marked',
];

export const CODE_BACKENDS: CodeBackend[] = [
    'shiki',
    'starry-night',
    'highlight.js',
    'escape',
];

export const MATH_BACKEND_KEYS: MathBackendKey[] = [
    'katex',
    'mathjax-svg-newcm',
    'mathjax-svg-fira',
    'mathjax-chtml-newcm',
    'mathjax-chtml-fira',
];

// ─── Cartesian product helper ─────────────────────────────────────────────────

export function cartesianProduct<X1>(x1: X1[]): [X1][];
export function cartesianProduct<X1, X2>(x1: X1[], x2: X2[]): [X1, X2][];
export function cartesianProduct<X1, X2, X3>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
): [X1, X2, X3][];
export function cartesianProduct<X1, X2, X3, X4>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
): [X1, X2, X3, X4][];
export function cartesianProduct(...arrays: unknown[][]): unknown[][] {
    return arrays.reduce<unknown[][]>(
        (acc, arr) => acc.flatMap((prefix) => arr.map((item) => [...(prefix as unknown[]), item])),
        [[]],
    );
}

// ─── All backend combinations ─────────────────────────────────────────────────

/**
 * Returns every [markdownBackend, codeBackend, mathBackendKey] triple.
 * 4 × 4 × 5 = 80 combinations.
 */
export function backendCombos(): BackendCombo[] {
    return cartesianProduct(
        MARKDOWN_BACKENDS,
        CODE_BACKENDS,
        MATH_BACKEND_KEYS,
    ) as BackendCombo[];
}

// ─── Combo ID helpers ─────────────────────────────────────────────────────────

/**
 * Canonical string identifier for a combo, used as:
 *   - the Playwright project name
 *   - the generated project directory name
 *   - the webServer port discriminator
 *
 * Example: `"unified-shiki-katex"`
 */
export function comboId([md, code, math]: BackendCombo): string {
    return `${md}-${code}-${math}`;
}

/**
 * The `.sveltex`-like file extension used as the Svelte preprocessor
 * discriminator for this combo (dashes stripped to avoid ambiguity in
 * SvelteKit's routing, which splits on dots).
 *
 * Example: `"unifiedANDshikiANDkatexANDsveltex"`
 */
export function comboExtension([md, code, math]: BackendCombo): string {
    const strip = (s: string) => s.replace(/[-_.]/g, '');
    return `${strip(md)}AND${strip(code)}AND${strip(math)}ANDsveltex`;
}

// ─── Math backend decomposition ───────────────────────────────────────────────

export type MathEngineKey = 'mathjax' | 'katex';
export type MathJaxOutput = 'svg' | 'chtml';
export type MathJaxFont = 'newcm' | 'fira';

export interface MathConfig {
    engine: MathEngineKey;
    outputFormat?: MathJaxOutput;
    font?: MathJaxFont;
}

/**
 * Decomposes a {@link MathBackendKey} into its constituent parts for use in
 * the sveltex() configuration object.
 */
export function parseMathBackendKey(key: MathBackendKey): MathConfig {
    if (key === 'katex') {
        return { engine: 'katex' };
    }
    // e.g. "mathjax-svg-newcm"
    const [, output, font] = key.split('-') as ['mathjax', MathJaxOutput, MathJaxFont];
    return { engine: 'mathjax', outputFormat: output, font };
}

// ─── Port allocation ──────────────────────────────────────────────────────────

/**
 * Base port for the preview servers. Each combo gets its own port:
 *   `BASE_PORT + comboIndex`.
 *
 * Starting at 3100 to avoid clashing with the legacy monolithic app (3033).
 */
export const BASE_PORT = 3100;

export function comboPort(index: number): number {
    return BASE_PORT + index;
}

/**
 * Port for the preview server of the hand-written showcase site
 * (`tests/e2e/showcase/`). Chosen well above the combo range
 * (`BASE_PORT … BASE_PORT + 79`) so it can never collide with a combo.
 */
export const SHOWCASE_PORT = 3200;

// ─── Page filtering helpers ───────────────────────────────────────────────────

/**
 * Returns `true` if the given page file path should be included for the given
 * combo.  Currently the only filter is that commutative-diagram tests only run
 * with MathJax (they test a MathJax-specific rendering feature).
 */
export function pageIncludedForCombo(pageRelPath: string, [, , math]: BackendCombo): boolean {
    if (pageRelPath.includes('commutative-diagrams') && !math.startsWith('mathjax')) {
        return false;
    }
    return true;
}
