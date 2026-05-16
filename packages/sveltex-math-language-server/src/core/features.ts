// File description: The pure language-feature layer — turning a TeX document +
// caret position into LSP completion and hover results.
//
// Everything here is deterministic and side-effect-free: it takes the document
// text, a caret offset, and the active backend's `CommandTable`, and returns
// plain LSP payloads. The transport/connection wiring lives in `server.ts`;
// keeping the features pure makes them trivial to unit-test.

import {
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind,
    type CompletionItem,
    type CompletionList,
    type Hover,
    type Position,
    type Range,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type {
    CommandCategory,
    CommandTable,
    MathCommand,
    MathLspBackend,
} from './commands.js';
import { commandAtCaret, completionContextAt } from './context.js';
import { describeCommand, hoverMarkdown } from './describe.js';

/** Maps a {@link CommandCategory} to the LSP completion-item icon. */
function completionKind(category: CommandCategory): CompletionItemKind {
    switch (category) {
        case 'function':
            return CompletionItemKind.Function;
        case 'macro':
            return CompletionItemKind.Method;
        case 'environment':
            return CompletionItemKind.Module;
        case 'symbol':
            return CompletionItemKind.Constant;
        default:
            return CompletionItemKind.Text;
    }
}

/** A short, fixed sort prefix so functions/symbols rank above rare macros. */
function sortPrefix(category: CommandCategory): string {
    switch (category) {
        case 'function':
            return '0';
        case 'symbol':
            return '1';
        case 'environment':
            return '2';
        case 'macro':
            return '3';
        default:
            return '4';
    }
}

/**
 * Builds the {@link CompletionItem} for one command.
 *
 * @param command - The command to offer.
 * @param replaceRange - The source range the inserted text replaces (from the
 * opening backslash, or the start of the environment name, to the caret).
 * @param isEnvironmentName - When `true` the caret is inside `\begin{...}`, so
 * the inserted text is the bare environment name; otherwise it is
 * `\command`.
 */
function buildCompletionItem(
    command: MathCommand,
    replaceRange: Range,
    isEnvironmentName: boolean,
): CompletionItem {
    // Inside `\begin{...}` the slot holds a bare environment name; everywhere
    // else a command is `\name`. The label mirrors what is inserted.
    const insertText = isEnvironmentName
        ? command.name
        : `\\${command.name}`;
    const label = insertText;
    return {
        label,
        kind: completionKind(command.category),
        detail: command.category,
        documentation: {
            kind: MarkupKind.Markdown,
            value: describeCommand(command),
        },
        // A fixed sort group keeps categories clustered; the name disambiguates
        // within a group, so completion order is stable and predictable.
        sortText: `${sortPrefix(command.category)}${command.name}`,
        // No `filterText` — it defaults to `label`. `textEdit.range` starts at
        // the `\`, so the editor's filter query is the typed text *including*
        // that `\` (`\alp`); it must be matched against `\alpha` (the label),
        // not the bare `alpha`, or the item is filtered out and never shown.
        insertTextFormat: InsertTextFormat.PlainText,
        textEdit: { range: replaceRange, newText: insertText },
    };
}

/** Upper bound on how many completion items are returned in one response. */
const MAX_COMPLETION_ITEMS = 500;

/**
 * Computes the completion result for a caret in a TeX math document.
 *
 * @param text - Full text of the (virtual) TeX math document.
 * @param position - The caret position.
 * @param table - The active backend's command table.
 * @returns A {@link CompletionList}. The list is empty (but never `null`) when
 * the caret is not in a command-typing context, so the editor caches the
 * "nothing here" answer rather than re-asking on every keystroke.
 */
export function computeCompletion(
    text: string,
    position: Position,
    table: CommandTable,
): CompletionList {
    const doc = TextDocument.create('mem://tex', 'latex', 0, text);
    const offset = doc.offsetAt(position);
    const context = completionContextAt(text, offset);
    if (!context) {
        return { isIncomplete: false, items: [] };
    }

    const matches = table.withPrefix(
        context.prefix,
        context.isEnvironmentName,
    );
    const replaceRange: Range = {
        start: doc.positionAt(context.backslashOffset),
        end: position,
    };
    const limited = matches.slice(0, MAX_COMPLETION_ITEMS);
    return {
        // `isIncomplete` is set when the list was truncated, so the editor
        // re-queries as the user narrows the prefix.
        isIncomplete: matches.length > limited.length,
        items: limited.map((command) =>
            buildCompletionItem(
                command,
                replaceRange,
                context.isEnvironmentName,
            ),
        ),
    };
}

/**
 * Computes the hover result for a caret in a TeX math document.
 *
 * @param text - Full text of the (virtual) TeX math document.
 * @param position - The caret position.
 * @param table - The active backend's command table.
 * @param backend - The active backend (named in the hover text).
 * @returns A {@link Hover}, or `null` when the caret is not on a command the
 * backend supports.
 */
export function computeHover(
    text: string,
    position: Position,
    table: CommandTable,
    backend: MathLspBackend,
): Hover | null {
    const doc = TextDocument.create('mem://tex', 'latex', 0, text);
    const offset = doc.offsetAt(position);
    const found = commandAtCaret(text, offset);
    if (!found) return null;

    // A hovered control word might be an environment name without the
    // surrounding `\begin{}`; try the command form first, then accept an
    // environment of the same name.
    const command = table.get(found.name);
    if (!command) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: hoverMarkdown(command, backend),
        },
        range: {
            start: doc.positionAt(found.start),
            end: doc.positionAt(found.end),
        },
    };
}
