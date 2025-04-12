// File description: Escape CSS color variables in TeX content for compilation,
// and unescape them in the rendered SVG afterwards.

// Internal dependencies
import {
    hexOfNamedColor,
    isNamedColor,
    isReservedHexColor,
    nameOfHexColor,
} from '../data/css.js';
import { is, typeAssert } from '../deps.js';
import { sha256 } from './misc.js';

/**
 * Regular expression for matching CSS variables.
 */
const cssVarRegex: RegExp =
    /var\((--[-]*[_a-zA-Z\u00A1-\uFFFF][-\w\u00A1-\uFFFF]*)\)/gu;

/**
 * Overgeneralized type for a CSS variable, according to which any string that
 * starts with `--` would be considered a valid CSS variable.
 */
type CssVar = `--${string}`;

/**
 * Type guard for {@link CssVar | `CssVar`}.
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
 */
function texDefineHexColors(cssColorVars: Map<CssVar, string>): string {
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
 */
export function parseCssColorVarsFromTex(tex: string): Map<CssVar, string> {
    const cssColorVarMatches = tex.matchAll(cssVarRegex);
    const cssColorVars = new Map<CssVar, string>();
    const hashes: string[] = [];
    for (const match of cssColorVarMatches) {
        // Generate a unique color for each CSS color variable by grabbing
        // the first 6 characters of the SHA-256 hash of the variable name.
        const cssColorVar = match[1];
        if (
            cssColorVar &&
            isCssVar(cssColorVar) &&
            !cssColorVars.has(cssColorVar)
        ) {
            let color = sha256(cssColorVar, 'hex').slice(0, 6);
            // Collision detection. Kinda over-the-top; the probability of two
            // random 6-character hex strings being the same is 1 in 16^6, i.e.,
            // 1 / 16,777,216, or about 0.00000596%. But alas, it's also not
            // that difficult to implement, nor is it particularly expensive in
            // terms of performance.
            while (isReservedHexColor(color) || hashes.includes(color)) {
                color = sha256(color, 'hex').slice(0, 6);
            }
            hashes.push(color);
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
 */
export function unescapeCssColorVars(
    svg: string,
    cssColorVars: Map<CssVar, string>,
): string {
    let unescaped = svg;
    cssColorVars.forEach((hexColor, cssColorVar) => {
        const regExp = getHexRegExp(hexColor);
        if (!regExp) return;
        unescaped = unescaped.replaceAll(regExp, `var(${cssColorVar})`);
    });
    return unescaped;
}

export function getHexRegExp(hex: string): RegExp | undefined {
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (!/^[0-9A-Fa-f]+$/i.test(hex)) {
        const name = hex.toLowerCase();
        if (!isNamedColor(name)) return undefined;
        hex = hexOfNamedColor[name];
    }
    if (![3, 4, 6, 8].includes(hex.length)) return undefined;
    hex = hex.toLowerCase();
    const hexArray: string[] = hex.split('');
    const names: string[] = [`#${hex}`];
    let longHex: string;
    if (hexArray.length <= 4) {
        longHex = hexArray.map((c) => c + c).join('');
        names.push('#' + longHex);
    } else {
        typeAssert(
            is<[string, string, string, string, string, string, ...string[]]>(
                hexArray,
            ),
        );
        longHex = hex;
        if (
            hexArray[0] === hexArray[1] &&
            hexArray[2] === hexArray[3] &&
            hexArray[4] === hexArray[5] &&
            (hexArray.length === 6 || hexArray[6] === hexArray[7])
        ) {
            names.push(
                '#' +
                    hexArray[0] +
                    hexArray[2] +
                    hexArray[4] +
                    (hexArray[6] ?? ''),
            );
        }
    }
    if (longHex.length === 6 && isReservedHexColor(longHex))
        names.push(...nameOfHexColor[longHex]);
    return new RegExp(
        `(?<=(?:[="'&;:<>(){}\\[\\]\\s]|^))` + // Positive lookbehind
            `[ ]?` + // Optional space
            `(${names.join('|')})` + // Color (e.g., (#000|#000000|black))
            `[ ]?` + // Optional space
            `(?=(?:[="'&;:<>(){}\\[\\]\\s]|$))`, // Positive lookahead
        'gi',
    );
}

/**
 * Escape CSS color variables in the TeX content to named colors.
 *
 * @param tex - TeX content to escape.
 * @param preamble - Optional preamble to append the color definitions to. If no
 * preamble is provided, we assume that we're escaping CSS variables for KaTeX,
 * meaning that we'll escape them directly to hex colors (which KaTeX supports
 * natively). If a preamble is provided, we assume that we're escaping CSS
 * variables for TeX, meaning that we'll escape them to named colors
 * and define these colors using the `\definecolor` command from the `xcolor`
 * package.
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
 * ...(and preamble `'\usepackage{microtype}'`) would return a variable
 * `escaped` containing...
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
 */
export function escapeCssColorVars(
    tex: string,
    preamble?: string,
): {
    escaped: string;
    cssColorVars: Map<CssVar, string>;
} {
    const cssColorVars = parseCssColorVarsFromTex(tex);
    let escaped = tex;
    cssColorVars.forEach((color, cssColorVar) => {
        escaped = escaped.replaceAll(
            `var(${cssColorVar})`,
            `${preamble ? 'sveltex' : '#'}${color}`,
        );
    });
    if (preamble) {
        escaped = escaped.replace(
            preamble,
            preamble +
                '\n' +
                // Ensure xcolor is loaded
                // '\\makeatletter\n' +
                // '\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n' +
                // '\\makeatother\n' +
                // Append color definitions
                texDefineHexColors(cssColorVars),
        );
    }
    return { escaped, cssColorVars };
}
