// File description: Computes LSP `textDocument/semanticTokens` for a
// `.sveltex` document.
//
// Scope (deliberately narrow): one flat `string` token per body line of a
// custom `escape`- or `code`-typed verbatim region — nothing else. The
// goal is to give editors that can't dynamically extend their static
// grammar (Zed, Helix, Neovim, …) a uniform colour for `<MyEscape>` /
// `<MyCode>` bodies declared in the user's `sveltex.config.js`.
//
// Why nothing else:
//
//   - `tex`-typed envs: VS Code regenerates its TM grammar to inject
//     `text.tex.latex` for custom tags; Zed can't, but trying to mimic
//     LaTeX through the LSP's small semantic-token vocabulary just
//     produces a coarser version of what TextMate would (we tried, the
//     loss was visible — see history). Better not to paint at all than
//     to mis-paint.
//   - `noop`-typed envs: their body is treated as Svelte — the LSP
//     relabels those regions to `svelte` so `svelte-language-server`
//     sees them. Editor-side coloring then comes from the static
//     Svelte grammar (in VS Code via the TM regen, in Zed not at all
//     for custom tags).
//   - Standard `verb` / `verbatim`: the tree-sitter grammar (Zed) and
//     the TM grammar (VS Code) both recognise these natively; painting
//     a `string` token over them would just replace richer styling
//     with our coarse one.
//
// Why gated on the client: VS Code regenerates its TM grammar from the
// `sveltex/resolvedTags` notification, so it already covers custom
// escape/code tags via `markup.fenced_code.block.markdown`. Adding a
// `string` semantic token on top would *override* the TM colouring
// with a different (and theme-dependent) one. The VS Code extension
// signals its identity through `initializationOptions.client` and the
// server skips advertising the provider in that case.

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokensBuilder } from 'vscode-languageserver';
import type { SemanticTokens } from 'vscode-languageserver-protocol';
import { verbatimBodyOffsets, type Region } from './regions.js';

/**
 * Tag names every shipping SvelTeX editor grammar handles natively (the
 * tree-sitter grammar's hardcoded `TEX_VERBATIM_TAGS` /
 * `PLAIN_VERBATIM_TAGS`, the TextMate grammar's `tex|latex|tikz` and
 * `verb|verbatim` patterns). Skipping these here keeps us from
 * overwriting the editor grammar's richer colouring.
 */
const NATIVELY_HIGHLIGHTED_TAGS: ReadonlySet<string> = new Set([
    'tex',
    'latex',
    'tikz',
    'verb',
    'verbatim',
]);

/**
 * Token-type vocabulary the SvelTeX LSP advertises in its `semanticTokens`
 * legend. `string` is the only one we emit — every theme has a colour for
 * it, and "this is literal text" is exactly what we mean.
 */
export const SEMANTIC_TOKEN_TYPES = ['string'] as const;

/** Token-modifier vocabulary. Empty; reserved for future use. */
export const SEMANTIC_TOKEN_MODIFIERS: readonly string[] = [];

const TOKEN_TYPE_STRING = SEMANTIC_TOKEN_TYPES.indexOf('string');

/**
 * Extracts the lowercased tag name from a verbatim region, or `null` if
 * the region's slice doesn't start with a recognisable `<tag>` opener.
 */
function tagNameOf(source: string, region: Region): string | null {
    if (region.kind !== 'verbatim') return null;
    const slice = source.slice(region.sourceStart, region.sourceEnd);
    const tagMatch = /^<\s*([a-zA-Z][-.:0-9_a-zA-Z]*)/u.exec(slice);
    return tagMatch ? (tagMatch[1] ?? '').toLowerCase() : null;
}

/**
 * Computes the encoded `SemanticTokens` for `text`.
 *
 * @param text - Full text of the `.sveltex` document.
 * @param regions - Pre-computed regions (output of `computeRegions`).
 * @param escapeTags - The config's `escapeTags` list (lower-cased
 * comparison).
 * @param codeTags - The config's `codeTags` list (lower-cased comparison).
 */
export function computeSemanticTokens(
    text: string,
    regions: readonly Region[],
    escapeTags: readonly string[],
    codeTags: readonly string[],
): SemanticTokens {
    const doc = TextDocument.create('mem://sveltex', 'sveltex', 0, text);
    const builder = new SemanticTokensBuilder();
    const targets = new Set([
        ...escapeTags.map((t) => t.toLowerCase()),
        ...codeTags.map((t) => t.toLowerCase()),
    ]);
    // Exclude the standard tags the editor grammar already paints.
    for (const tag of NATIVELY_HIGHLIGHTED_TAGS) targets.delete(tag);

    if (targets.size === 0) return builder.build();

    for (const region of regions) {
        if (region.kind !== 'verbatim') continue;
        const tag = tagNameOf(text, region);
        if (!tag || !targets.has(tag)) continue;
        const body = verbatimBodyOffsets(text, region.sourceStart, region.sourceEnd);
        if (!body) continue;
        pushLineSplitTokens(builder, doc, text, body[0], body[1]);
    }

    return builder.build();
}

/**
 * Pushes one `string` token per line of `[start, end)`. LSP requires
 * single-line tokens; trailing CR/LF are trimmed so the colour doesn't
 * bleed onto the next line.
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
