// File description: TeX-aware caret-context analysis.
//
// Completion and hover both need to know what TeX construct the caret sits in:
// the command being typed (for completion) or the command under the cursor
// (for hover), and whether that command is the environment name slot of a
// `\begin{...}` / `\end{...}`. This module isolates that small bit of TeX
// lexing so the completion and hover handlers stay declarative.

/**
 * The command-typing context at a caret, as needed for completion.
 */
export interface CompletionContext {
    /**
     * The command prefix already typed after the backslash, WITHOUT the
     * backslash itself (e.g. for `\fra|` the prefix is `fra`). Empty when the
     * caret sits immediately after a lone backslash.
     */
    prefix: string;
    /**
     * Offset of the backslash that opens the command being typed. The
     * completion's replace range runs from here to the caret.
     */
    backslashOffset: number;
    /**
     * `true` when the command is the environment-name argument of a `\begin{`
     * or `\end{` — i.e. the caret is inside the braces of `\begin{...}`. In
     * that case there is no backslash; completion offers environment names.
     */
    isEnvironmentName: boolean;
}

/**
 * The command found under (or immediately after) a caret, as needed for hover.
 */
export interface CommandAtCaret {
    /** The command name without its leading backslash (e.g. `frac`). */
    name: string;
    /** Offset of the opening backslash. */
    start: number;
    /** Offset one past the last character of the command. */
    end: number;
}

/** Whether `ch` may appear in a multi-letter TeX control word. */
function isControlWordChar(ch: string): boolean {
    return /^[a-zA-Z]$/u.test(ch);
}

/**
 * Analyses the command-typing context at `offset` within `text`.
 *
 * Two shapes are recognised:
 *
 *  1. **Ordinary command** — the caret follows `\` and zero or more letters
 *     (`\`, `\al`, `\alpha`). The nearest preceding backslash that is not
 *     itself escaped opens the command.
 *  2. **Environment name** — the caret is inside the braces of a `\begin{...}`
 *     or `\end{...}`; the partial environment name is returned with
 *     `isEnvironmentName: true`.
 *
 * @param text - The full TeX (math) document text.
 * @param offset - The caret offset.
 * @returns The {@link CompletionContext}, or `undefined` if the caret is not in
 * a position where command completion makes sense.
 */
export function completionContextAt(
    text: string,
    offset: number,
): CompletionContext | undefined {
    if (offset < 0 || offset > text.length) return undefined;

    // --- environment-name slot: `\begin{<here>` or `\end{<here>` -----------
    const beforeCaret = text.slice(0, offset);
    const envMatch = /\\(?:begin|end)\{([a-zA-Z*]*)$/u.exec(beforeCaret);
    if (envMatch) {
        // Capture group 1 (`[a-zA-Z*]*`) always participates when the regex
        // matches, so `envMatch[1]` is always a string; the `?? ''` is
        // unreachable defence and excluded from coverage.
        /* v8 ignore next */
        const envName = envMatch[1] ?? '';
        return {
            prefix: envName,
            backslashOffset: offset - envName.length,
            isEnvironmentName: true,
        };
    }

    // --- ordinary command: scan back over letters to a backslash -----------
    let i = offset;
    while (i > 0 && isControlWordChar(text.charAt(i - 1))) {
        i -= 1;
    }
    // `i` now points just after the run of letters; the char before must be a
    // backslash for this to be a command.
    if (i === 0 || text.charAt(i - 1) !== '\\') return undefined;
    const backslashOffset = i - 1;
    // A backslash is only a command opener if it is not itself escaped: count
    // the unbroken run of backslashes ending here; an even count means the
    // last one is escaped (`\\`), so it is line-break/literal, not a command.
    let backslashes = 0;
    let j = backslashOffset;
    while (j >= 0 && text.charAt(j) === '\\') {
        backslashes += 1;
        j -= 1;
    }
    if (backslashes % 2 === 0) return undefined;

    return {
        prefix: text.slice(i, offset),
        backslashOffset,
        isEnvironmentName: false,
    };
}

/**
 * Finds the TeX command that the caret at `offset` sits within or directly
 * after — used to answer hover.
 *
 * A command is a backslash followed by either a run of letters (`\alpha`) or a
 * single non-letter character (`\,`, `\#`). The caret matches if it lies
 * anywhere from the backslash up to and including the position just past the
 * command's last character.
 *
 * @param text - The full TeX (math) document text.
 * @param offset - The caret offset.
 * @returns The {@link CommandAtCaret}, or `undefined` if the caret is not on a
 * command.
 */
export function commandAtCaret(
    text: string,
    offset: number,
): CommandAtCaret | undefined {
    if (offset < 0 || offset > text.length) return undefined;

    // Find the backslash at or before the caret that could open the command.
    // Scan left over letters first (the caret may be in the middle of a word),
    // then expect a backslash.
    let left = offset;
    while (left > 0 && isControlWordChar(text.charAt(left - 1))) {
        left -= 1;
    }

    let backslashOffset: number | undefined;
    if (left > 0 && text.charAt(left - 1) === '\\') {
        backslashOffset = left - 1;
    } else if (
        // Single-character command: caret right after `\` + one non-letter,
        // e.g. hovering `\,`.
        offset >= 2 &&
        text.charAt(offset - 2) === '\\' &&
        !isControlWordChar(text.charAt(offset - 1))
    ) {
        backslashOffset = offset - 2;
    }
    // Caret sits on the backslash itself or just before a single-char command.
    // This arm is unreachable: when `charAt(offset - 1)` is a backslash the
    // left-scan stops at `offset` (a backslash is not a control-word char), so
    // `left === offset` and the very first arm above
    // (`left > 0 && charAt(left - 1) === '\\'`) always fires first. The
    // caret-on-the-backslash case is handled by the *next* arm instead. It is
    // kept as defence in depth, and ignored for coverage because no input can
    // reach it.
    /* v8 ignore start */
    else if (offset >= 1 && text.charAt(offset - 1) === '\\') {
        backslashOffset = offset - 1;
    }
    /* v8 ignore stop */
    else if (offset < text.length && text.charAt(offset) === '\\') {
        backslashOffset = offset;
    }

    if (backslashOffset === undefined) return undefined;

    // Reject an escaped backslash (`\\`).
    let backslashes = 0;
    let j = backslashOffset;
    while (j >= 0 && text.charAt(j) === '\\') {
        backslashes += 1;
        j -= 1;
    }
    if (backslashes % 2 === 0) return undefined;

    // Read the command name after the backslash.
    let end = backslashOffset + 1;
    if (end < text.length && isControlWordChar(text.charAt(end))) {
        while (end < text.length && isControlWordChar(text.charAt(end))) {
            end += 1;
        }
        // An optional trailing `*` is part of starred command/environment names
        // (it is not, however, part of a control word the caret is hovering —
        // keep it simple and exclude it here; starred names are matched by the
        // environment-name path of completion instead).
    } else if (
        end < text.length &&
        !isControlWordChar(text.charAt(end)) &&
        !/\s/u.test(text.charAt(end)) &&
        // A backslash here would make the pair `\\` — an escaped backslash,
        // not a `\<char>` command — so it is not a single-character command.
        text.charAt(end) !== '\\'
    ) {
        // Single-character command (`\,`).
        end += 1;
    }

    const name = text.slice(backslashOffset + 1, end);
    if (name.length === 0) return undefined;
    // The caret must actually be within `[backslashOffset, end]`. This guard is
    // unreachable in practice — every arm that sets `backslashOffset` does so at
    // or before `offset`, and `end` is always grown to at least `offset` — but
    // it is kept as a self-documenting invariant and excluded from coverage.
    /* v8 ignore next 2 */
    if (offset < backslashOffset || offset > end) return undefined;
    return { name, start: backslashOffset, end };
}
