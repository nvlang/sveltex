// File description: Names of supported TeX engines and related info.

/**
 * Supported TeX engines.
 */
export type SupportedTexEngine = (typeof texEngines)[number];

export const texEngines = [
    'pdflatexmk',
    'lualatex',
    'lualatexmk',
    'pdflatex',
    'xelatex',
] as const;

export const texBaseCommand: Record<SupportedTexEngine, string> = {
    lualatex: 'lualatex',
    pdflatex: 'pdflatex',
    xelatex: 'xelatex',
    pdflatexmk: 'latexmk',
    // A CLI flag will take care of making this actually use LuaLaTeX
    lualatexmk: 'latexmk',
    // A CLI flag will take care of making this actually use XeLaTeX
    // xelatexmk: 'latexmk',
} as const;

export const enginePrettyName: Record<SupportedTexEngine, string> = {
    lualatex: 'LuaLaTeX',
    pdflatex: 'pdfLaTeX',
    xelatex: 'XeLaTeX',
    pdflatexmk: 'LaTeXmk (pdfLaTeX)',
    lualatexmk: 'LaTeXmk (LuaLaTeX)',
} as const;

export const logSeverities = ['info', 'box', 'warn', 'error'] as const;
export type TexLogSeverity = (typeof logSeverities)[number];
