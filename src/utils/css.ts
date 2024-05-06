/**
 * - File: src/utils/css.ts
 * - Description: Contains utility functions for handling CSS color variables in
 *   advanced TeX content.
 * - Used by: src/utils/TexComponent.ts
 */

// Internal dependencies
import { sha256 } from '$utils/misc.js';

/**
 * Regular expression for matching CSS variables.
 *
 * @internal
 */
const cssVarRegex =
    /var\((--[-]*[_a-zA-Z\u00A1-\uFFFF][-\w\u00A1-\uFFFF]*)\)/gu;

/**
 * Overgeneralized type for a CSS variable, according to which any string that
 * starts with `--` would be considered a valid CSS variable.
 *
 * @internal
 */
type CssVar = `--${string}`;

/**
 * Type guard for {@link CssVar | `CssVar`}.
 *
 * @internal
 */
function isCssVar(str: string): str is CssVar {
    return str.startsWith('--');
}

/**
 * Define hex colors in TeX (using the `\definecolor` command from the
 * [`xcolor`](https://ctan.org/pkg/xcolor) package) for each CSS color
 * variable.
 *
 * @param cssColorVars - Map of the CSS color variables to their corresponding
 * hex colors.
 * @returns The TeX content defining the hex colors for each CSS color variable.
 *
 * @example
 * Calling this function with the map `cssColorVars` containing the entry
 * `'--red' => 'e4a6ed'` would return the following TeX content:
 *
 * ```tex
 * \definecolor{sveltexe4a6ed}{HTML}{e4a6ed}
 * ```
 *
 * @internal
 */
export function texDefineHexColors(cssColorVars: Map<CssVar, string>): string {
    return cssColorVars.size === 0
        ? ''
        : [...cssColorVars.values()]
              .map((color) => `\\definecolor{sveltex${color}}{HTML}{${color}}`)
              .join('\n') + '\n';
}

/**
 * Parse CSS color variables from TeX content.
 *
 * @param tex - TeX content to parse.
 * @returns A map of the CSS color variables to their corresponding hex colors.
 *
 * @example
 * Calling this function on the following TeX content...
 *
 * ```tex
 * \documentclass[tikz]{standalone}
 * \usepackage{microtype}
 * \begin{document}
 * \begin{tikzpicture}
 *    \draw[var(--red)] (0,0) rectangle (3, 3);
 * \end{tikzpicture}
 * \end{document}
 * ```
 *
 * ...would return a map with the entry `'--red' => 'e4a6ed'`.
 * @internal
 */
export function parseCssColorVarsFromTex(tex: string) {
    const cssColorVarMatches = tex.matchAll(cssVarRegex);
    const cssColorVars = new Map<CssVar, string>();
    for (const match of cssColorVarMatches) {
        // Generate a unique color for each CSS color variable by grabbing
        // the first 6 characters of the SHA-256 hash of the variable name.
        const cssColorVar = match[1];
        if (cssColorVar && isCssVar(cssColorVar)) {
            const color = sha256(cssColorVar, 'hex').slice(0, 6);
            cssColorVars.set(cssColorVar, color);
        }
    }
    return cssColorVars;
}

/**
 * Unescape CSS color variables in the SVG content by replacing the temporary
 * hex colors assigned to them with the corresponding CSS variable.
 *
 * @param svg - SVG content to unescape.
 * @param cssColorVars - Map of the CSS color variables to their corresponding
 * hex colors.
 * @returns The unescaped SVG content.
 *
 * @example
 * Calling this function on the following SVG content...
 *
 * ```svg
 * <svg viewBox="0 0 100 100">
 *    <rect fill="#e4a6ed" x="0" y="0" width="100" height="100"/>
 * </svg>
 * ```
 *
 * ...with the map `cssColorVars` containing the entry `'--red' => 'e4a6ed'`,
 * would return the following SVG content:
 *
 * ```svg
 * <svg viewBox="0 0 100 100">
 *   <rect fill="var(--red)" x="0" y="0" width="100" height="100"/>
 * </svg>
 * ```
 *
 * @internal
 */
export function unescapeCssColorVarsFromSvg(
    svg: string,
    cssColorVars: Map<CssVar, string>,
) {
    let unescaped = svg;
    cssColorVars.forEach((hexColor, cssColorVar) => {
        unescaped = unescaped.replaceAll(`#${hexColor}`, `var(${cssColorVar})`);
        const hexColorArray = hexColor.split('');
        if (
            hexColorArray[0] &&
            hexColorArray[2] &&
            hexColorArray[4] &&
            hexColorArray[0] === hexColorArray[1] &&
            hexColorArray[2] === hexColorArray[3] &&
            hexColorArray[4] === hexColorArray[5]
        ) {
            unescaped = unescaped.replaceAll(
                '#' + hexColorArray[0] + hexColorArray[2] + hexColorArray[4],
                `var(${cssColorVar})`,
            );
        }
    });
    return unescaped;
}

/**
 * Escape CSS color variables in the TeX content to named colors.
 *
 * @param tex - TeX content to escape.
 * @returns The escaped TeX content and a map of the CSS color variables to
 * their corresponding named colors.
 *
 * @example
 * Calling this function on the following TeX content...
 *
 * ```tex
 * \documentclass[tikz]{standalone}
 * \usepackage{microtype}
 * \begin{document}
 * \begin{tikzpicture}
 *     \draw[var(--red)] (0,0) rectangle (3, 3);
 * \end{tikzpicture}
 * \end{document}
 * ```
 *
 * ...would return a variable `escaped` containing...
 *
 * ```tex
 * \documentclass[tikz]{standalone}
 * \usepackage{microtype}
 * \makeatletter
 * \@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
 * \makeatother
 * \definecolor{sveltexe4a6ed}{HTML}{e4a6ed}
 * \begin{document}
 * \begin{tikzpicture}
 *     \draw[sveltexe4a6ed] (0,0) rectangle (3, 3);
 * \end{tikzpicture}
 * \end{document}
 * ```
 *
 * ...and a map `cssColorVars` with the entry `'--red' => 'e4a6ed'`.
 *
 * @internal
 */
export function escapeCssColorVarsToNamedColors(tex: string, preamble: string) {
    const cssColorVars = parseCssColorVarsFromTex(tex);
    let escaped = tex;
    cssColorVars.forEach((color, cssColorVar) => {
        escaped = escaped.replaceAll(`var(${cssColorVar})`, 'sveltex' + color);
    });
    escaped = escaped.replace(
        preamble,
        preamble +
            '\n' +
            // Ensure xcolor is loaded
            '\\makeatletter\n' +
            '\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n' +
            '\\makeatother\n' +
            // Append color definitions
            texDefineHexColors(cssColorVars),
    );
    return { escaped, cssColorVars };
}
