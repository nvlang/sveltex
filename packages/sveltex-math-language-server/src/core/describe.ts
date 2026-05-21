// File description: Human-readable descriptions and hover text for TeX
// commands, used in both completion-item documentation and hover.
//
// A command's one-line description is the first available of three sources:
// the documentation metadata merged into `data/commands.generated.ts` from
// each engine's reference docs (the richest, but not exhaustive); a small
// curated map of hand-written glosses for high-frequency commands; and finally
// a generic, category-driven sentence, so EVERY supported command gets *some*
// description. Hover additionally shows the command's signature, the Unicode
// glyph it stands for (when any), and a backend/package/category footer.
// Nothing here claims a command exists: the command set itself is sourced from
// the backend in `data/commands.generated.ts`.

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
 * Returns the one-line description of a command: the documentation-sourced
 * description when the generator merged one in, else a curated gloss, else the
 * generic category sentence (which is always available).
 *
 * @param command - The command to describe.
 */
export function describeCommand(command: MathCommand): string {
    return (
        command.description ??
        GLOSSES[command.name] ??
        CATEGORY_SENTENCE[command.category]
    );
}

/**
 * Builds the Markdown body shown on hover for a command.
 *
 * The body is, in order: a fenced `latex` block with the command's signature
 * (its arguments spelled out when it takes any); for a command that stands for
 * a Unicode glyph, that glyph and its Unicode standard name; the one-line
 * description; and a dimmed footer naming the backend, the providing package
 * (when known) and the category.
 *
 * @param command - The command being hovered.
 * @param backend - The active backend, named in the footer so the user knows
 * which engine's support they are seeing.
 * @returns A Markdown string.
 */
export function hoverMarkdown(
    command: MathCommand,
    backend: MathLspBackend,
): string {
    const lines: string[] = [];

    // The signature comes first: how the command is actually used. A merged-in
    // `signature` spells out the arguments; otherwise the bare `\name` (or a
    // `\begin…\end` pair for an environment) stands in.
    const usage =
        command.signature ??
        (command.category === 'environment'
            ? `\\begin{${command.name}} … \\end{${command.name}}`
            : `\\${command.name}`);
    lines.push('```latex', usage, '```', '');

    // For a command that denotes a Unicode glyph, show the glyph and its
    // Unicode standard name — e.g. `∮ (contour integral)`.
    if (command.unicode) {
        const named = command.unicodeName ? ` (${command.unicodeName})` : '';
        lines.push(`**${command.unicode}**${named}`, '');
    }

    lines.push(describeCommand(command), '');

    // A dimmed footer: backend · package (when known) · category.
    const footer = [BACKEND_LABEL[backend], command.package, command.category]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
    lines.push(`_${footer}_`);

    return lines.join('\n');
}
