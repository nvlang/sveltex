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
// CRITICAL: semantic tokens *replace* whatever colour the static grammar
// would give a range, they don't refine it. Emitting a `string` token over
// the entire body of `<tex>…</tex>` therefore *kills* the LaTeX
// highlighting the editor grammar would otherwise paint — bare uniform
// colour instead of `\begin`-as-keyword, `\draw`-as-function, etc.
//
// What this DOES:
//   - One `string` token per body line of every *non-standard* verbatim
//     region — those whose tag is NOT in {tex, latex, tikz, verb, verbatim}.
//     For non-standard tags the editor grammar produces nothing, so the
//     uniform colour is strictly an improvement.
//
// What this DOESN'T do:
//   - Touch standard verbatim tags. Their bodies are handled by the editor
//     grammars (`text.tex.latex` injection for `<tex>` / `<latex>` /
//     `<tikz>` and the `markup.fenced_code` styling for `<verb>` /
//     `<verbatim>`), and any token we'd emit would overwrite that work.
//   - Fine-grained tokenisation of the body. A future iteration could
//     emit `\command` → `keyword`, `% comment` → `comment`, etc. for
//     custom TeX-typed envs; for now they get the same flat `string`
//     colour as escape envs.
//   - Tokens for `math` / `code` / `frontmatter` regions. The editor's own
//     grammar handles them (Markdown's fenced-code injection for code,
//     tree-sitter / TextMate math handling for math, the markdown
//     frontmatter rule for frontmatter); no LSP refinement is needed.

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokensBuilder } from 'vscode-languageserver';
import type { SemanticTokens } from 'vscode-languageserver-protocol';
import type { Region } from './regions.js';
import { verbatimBodyOffsets } from './region-virtual.js';

/**
 * Tag names every shipping SvelTeX editor grammar handles natively:
 *
 *   - VS Code TextMate (`packages/vscode-sveltex/syntaxes/sveltex.
 *     tmLanguage.yaml`) — `tex`/`latex`/`tikz` open a
 *     `meta.embedded.block.latex` region with a `text.tex.latex` injection,
 *     `verb`/`verbatim` open a `meta.embedded.block.plain` region with
 *     `markup.fenced_code` content styling.
 *   - Zed tree-sitter (`packages/tree-sitter-sveltex/grammar.js`) —
 *     `TEX_VERBATIM_TAGS` / `PLAIN_VERBATIM_TAGS` produce
 *     `tex_verbatim_body` / `plain_verbatim_body` nodes, with the LaTeX
 *     injection wired in `editors/zed/languages/sveltex/injections.scm`.
 *
 * Semantic tokens are skipped for these because the editor grammar's
 * colouring is strictly richer than the flat `string` colour this module
 * can produce, and emitting tokens would *replace* the grammar's work
 * with the uniform colour.
 *
 * Custom tags from the user's `sveltex.config.js` are not in this set, so
 * they DO get tokens — there the editor grammar produces nothing and the
 * uniform colour is strictly better than no colouring at all.
 *
 * Comparisons are case-insensitive, mirroring the case handling in the
 * editor grammars (`(?i)` in TextMate, the `TeX`/`LaTeX`/`TikZ` aliases
 * in the tree-sitter grammar).
 */
const NATIVELY_HIGHLIGHTED_TAGS: ReadonlySet<string> = new Set([
    'tex',
    'latex',
    'tikz',
    'verb',
    'verbatim',
]);

/**
 * Returns whether the opening tag of `region` is one of the
 * {@link NATIVELY_HIGHLIGHTED_TAGS}. A `verbatim` region whose tag isn't
 * recognised (or whose slice is malformed) returns `false`, so the LSP
 * defaults to emitting tokens for it (safer to over-colour an exotic edge
 * case than to silently drop a real user-configured tag).
 */
function isNativelyHighlighted(source: string, region: Region): boolean {
    if (region.kind !== 'verbatim') return false;
    const slice = source.slice(region.sourceStart, region.sourceEnd);
    const tagMatch = /^<\s*([a-zA-Z][-.:0-9_a-zA-Z]*)/u.exec(slice);
    if (!tagMatch) return false;
    return NATIVELY_HIGHLIGHTED_TAGS.has((tagMatch[1] ?? '').toLowerCase());
}

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
        // Editor grammars already paint `<tex>` etc. better than we can —
        // skip them to avoid overwriting their colouring with our uniform
        // `string`.
        if (isNativelyHighlighted(text, region)) continue;
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
