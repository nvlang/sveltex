// File description: Human-readable descriptions for TeX commands, used in both
// completion-item documentation and hover.
//
// A description is built from two parts: a generic, category-driven sentence
// (always available, so EVERY supported command gets *some* documentation) and,
// for the commands users reach for most, a specific hand-written gloss. The
// hand-written set is intentionally small — it covers the high-frequency
// commands where a generic sentence is unhelpful; everything else falls back to
// the category sentence. Nothing here claims a command exists: the command set
// itself is sourced from the backend in `data/commands.generated.ts`.

import type {
    CommandCategory,
    MathCommand,
    MathLspBackend,
} from './commands.js';

/**
 * A small, curated map of bare command name → one-line gloss, for the commands
 * a description sentence alone would not usefully explain.
 */
const GLOSSES: Readonly<Record<string, string>> = {
    frac: 'Typesets a fraction with the given numerator and denominator.',
    dfrac: 'Display-style fraction (always full size).',
    tfrac: 'Text-style fraction (always small).',
    sqrt: 'Square root; an optional argument gives the index (e.g. cube root).',
    sum: 'Summation operator (∑), commonly used with sub/superscript limits.',
    prod: 'Product operator (∏).',
    int: 'Integral operator (∫).',
    iint: 'Double integral operator (∬).',
    iiint: 'Triple integral operator (∭).',
    oint: 'Contour integral operator (∮).',
    lim: 'Limit operator, typically with an underscript (e.g. x → 0).',
    text: 'Typesets its argument as upright text inside math mode.',
    mathrm: 'Upright (roman) math font.',
    mathbf: 'Bold math font.',
    mathit: 'Italic math font.',
    mathsf: 'Sans-serif math font.',
    mathtt: 'Monospace (typewriter) math font.',
    mathcal: 'Calligraphic math font (uppercase letters).',
    mathbb: 'Blackboard-bold math font (e.g. ℝ, ℕ, ℤ).',
    mathfrak: 'Fraktur math font.',
    boldsymbol: 'Bold version of its argument, including symbols.',
    hat: 'Places a hat accent over its argument.',
    bar: 'Places a bar accent over its argument.',
    vec: 'Places a vector arrow over its argument.',
    dot: 'Places a single dot accent over its argument.',
    ddot: 'Places a double dot accent over its argument.',
    tilde: 'Places a tilde accent over its argument.',
    overline: 'Draws a line over its argument.',
    underline: 'Draws a line under its argument.',
    overbrace: 'Draws a horizontal brace over its argument.',
    underbrace: 'Draws a horizontal brace under its argument.',
    left: 'Opens an auto-sized delimiter; pair with \\right.',
    right: 'Closes an auto-sized delimiter; pair with \\left.',
    begin: 'Opens an environment, e.g. \\begin{matrix}.',
    end: 'Closes an environment opened with \\begin.',
    binom: 'Typesets a binomial coefficient.',
    cdot: 'Centred multiplication dot (⋅).',
    times: 'Multiplication cross (×).',
    div: 'Division sign (÷).',
    pm: 'Plus-or-minus sign (±).',
    mp: 'Minus-or-plus sign (∓).',
    leq: 'Less-than-or-equal sign (≤).',
    geq: 'Greater-than-or-equal sign (≥).',
    neq: 'Not-equal sign (≠).',
    approx: 'Approximately-equal sign (≈).',
    equiv: 'Equivalence / identity sign (≡).',
    infty: 'Infinity symbol (∞).',
    partial: 'Partial-derivative symbol (∂).',
    nabla: 'Nabla / del operator (∇).',
    forall: 'Universal quantifier (∀).',
    exists: 'Existential quantifier (∃).',
    in: 'Set-membership sign (∈).',
    subset: 'Subset sign (⊂).',
    cup: 'Set union (∪).',
    cap: 'Set intersection (∩).',
    rightarrow: 'Rightward arrow (→).',
    leftarrow: 'Leftward arrow (←).',
    Rightarrow: 'Rightward double arrow (⇒).',
    Leftarrow: 'Leftward double arrow (⇐).',
    operatorname: 'Typesets its argument as a named operator (upright).',
    color: 'Sets the colour of the following material.',
    textcolor: 'Typesets its argument in the given colour.',
    ce: 'mhchem: typesets a chemical equation or formula.',
    pu: 'mhchem: typesets a physical unit.',
};

/** Category-driven fallback sentences. */
const CATEGORY_SENTENCE: Readonly<Record<CommandCategory, string>> = {
    function: 'A TeX command that takes one or more arguments.',
    symbol: 'A TeX symbol command (produces a single glyph).',
    macro: 'A TeX macro (defined in terms of other commands).',
    environment: 'A TeX environment, used with \\begin{...} and \\end{...}.',
};

/** Human-readable backend names for hover text. */
const BACKEND_LABEL: Readonly<Record<MathLspBackend, string>> = {
    katex: 'KaTeX',
    mathjax: 'MathJax',
};

/**
 * Returns the one-line description of a command (curated gloss if available,
 * otherwise the category sentence).
 *
 * @param command - The command to describe.
 */
export function describeCommand(command: MathCommand): string {
    return GLOSSES[command.name] ?? CATEGORY_SENTENCE[command.category];
}

/**
 * Builds the Markdown body shown on hover for a command.
 *
 * @param command - The command being hovered.
 * @param backend - The active backend, named in the text so the user knows
 * which engine's support they are seeing.
 * @returns A Markdown string: a fenced `\command` line, the description, and a
 * note of the backend and category.
 */
export function hoverMarkdown(
    command: MathCommand,
    backend: MathLspBackend,
): string {
    const usage =
        command.category === 'environment'
            ? `\\begin{${command.name}} … \\end{${command.name}}`
            : `\\${command.name}`;
    return [
        '```latex',
        usage,
        '```',
        '',
        describeCommand(command),
        '',
        `_${BACKEND_LABEL[backend]} ${command.category}._`,
    ].join('\n');
}
