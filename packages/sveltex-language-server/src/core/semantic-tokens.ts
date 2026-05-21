// File description: Computes LSP `textDocument/semanticTokens` for a
// `.sveltex` document.
//
// Motivating problem: the editor-side grammars (TextMate in VS Code, the
// tree-sitter grammar in Zed) hardcode a fixed list of verbatim tag names
// (`tex|latex|tikz|verb|verbatim`). A user who adds a custom verbatim env
// to their `sveltex.config.js` (`MyVerb: { type: 'escape', ... }`) gets
// build + LSP support immediately, but the editor leaves the body of
// `<MyVerb>…</MyVerb>` un-coloured because the static grammar doesn't know
// about it. The LSP, on the other hand, already reads the verbatim tag
// list from the user's actual config (see `regions.ts`), so it can emit
// semantic tokens marking each region's body — and the editor lays those
// on top of whatever its static grammar produced.
//
// What this DOES:
//   - One `string` token per line of every verbatim region's body. That is
//     enough to visually distinguish a `<MyVerb>` body from the surrounding
//     prose in any LSP-supporting editor (VS Code, Zed, Helix, Neovim, …).
//
// What this DOESN'T do (yet):
//   - Fine-grained tokenisation of the body. A `<tex>` body still needs
//     TexLab — forwarded via `region-forwarding.ts` — for hover/completion
//     semantics; emitting token streams for `\command{arg}` would duplicate
//     that work and is left to a future iteration.
//   - Tokens for `math` / `code` / `frontmatter` regions. Those are handled
//     by the editor's own grammar (Markdown's fenced-code injection for
//     code, tree-sitter / TextMate math handling for math, the markdown
//     frontmatter rule for frontmatter) and do not need LSP refinement.

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokensBuilder } from 'vscode-languageserver';
import type { SemanticTokens } from 'vscode-languageserver-protocol';
import type { Region } from './regions.js';
import { verbatimBodyOffsets } from './region-virtual.js';

/**
 * Token-type vocabulary the SvelTeX LSP advertises in its `semanticTokens`
 * legend. Indices into this array appear in the wire-format token data.
 *
 * `string` is chosen because every theme has a colour for it — the goal is
 * visible distinction from surrounding prose, not domain-specific colouring
 * (which the editor's static grammar already provides for known tags).
 */
export const SEMANTIC_TOKEN_TYPES = ['string'] as const;

/**
 * Token-modifier vocabulary. None for v1 — the bench uses a single token
 * type. Reserved as an extension point: a future iteration could add
 * `verbatim` / `tex` modifiers so themes that want to colour TeX bodies
 * differently from plain verbatim bodies can target them.
 */
export const SEMANTIC_TOKEN_MODIFIERS: readonly string[] = [];

/** Index of the `string` token type in {@link SEMANTIC_TOKEN_TYPES}. */
const TOKEN_TYPE_STRING = SEMANTIC_TOKEN_TYPES.indexOf('string');

/**
 * Computes the encoded `SemanticTokens` for `text`.
 *
 * @param text - Full text of the `.sveltex` document.
 * @param regions - Pre-computed regions (output of `computeRegions`). Passed
 * in rather than recomputed so the caller — which has them on hand for every
 * other request — pays the parse cost only once per `didChange`.
 *
 * @remarks
 * Tokens are pushed in document order through {@link SemanticTokensBuilder},
 * which delta-encodes them per the LSP 3.16+ wire format. Multi-line
 * verbatim bodies are split into one token per line: the LSP spec disallows
 * multi-line tokens and editors that accept them anyway tend to mis-render
 * the second line onwards.
 */
export function computeSemanticTokens(
    text: string,
    regions: readonly Region[],
): SemanticTokens {
    const doc = TextDocument.create('mem://sveltex', 'sveltex', 0, text);
    const builder = new SemanticTokensBuilder();

    for (const region of regions) {
        if (region.kind !== 'verbatim') continue;
        const body = verbatimBodyOffsets(text, region);
        if (!body) continue;
        pushLineSplitTokens(builder, doc, text, body[0], body[1]);
    }

    return builder.build();
}

/**
 * Pushes one token per line in the half-open offset range `[start, end)`,
 * splitting a multi-line range so each token stays on a single line.
 *
 * Trailing `\r` and `\n` characters of each line are excluded from the
 * token — the LSP spec says nothing about how an editor renders a token
 * that overlaps a line break, and empirically VS Code paints the entire
 * next line if the trailing newline is included.
 */
function pushLineSplitTokens(
    builder: SemanticTokensBuilder,
    doc: TextDocument,
    text: string,
    start: number,
    end: number,
): void {
    if (end <= start) return;
    const startPos = doc.positionAt(start);
    const endPos = doc.positionAt(end);
    for (let line = startPos.line; line <= endPos.line; line++) {
        const lineStart = doc.offsetAt({ line, character: 0 });
        const nextLineStart = doc.offsetAt({ line: line + 1, character: 0 });
        const tokenStart = Math.max(start, lineStart);
        let tokenEnd = Math.min(end, nextLineStart);
        // Trim trailing CR / LF: not visible content, and including them
        // makes some editors paint the following line too.
        if (tokenEnd > tokenStart && text.charCodeAt(tokenEnd - 1) === 0x0a) {
            tokenEnd--;
        }
        if (tokenEnd > tokenStart && text.charCodeAt(tokenEnd - 1) === 0x0d) {
            tokenEnd--;
        }
        const length = tokenEnd - tokenStart;
        if (length <= 0) continue;
        const startChar = tokenStart - lineStart;
        builder.push(line, startChar, length, TOKEN_TYPE_STRING, 0);
    }
}
