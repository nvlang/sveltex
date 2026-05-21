// File description: Computes LSP `textDocument/semanticTokens` for a
// `.sveltex` document.
//
// Motivating problem: the editor-side grammars (TextMate in VS Code, the
// tree-sitter grammar in Zed) hardcode a fixed list of verbatim tag names
// (`tex|latex|tikz|verb|verbatim`). A user who adds a custom verbatim env
// to their `sveltex.config.js` (`MyTex: { type: 'tex', ... }`) gets build
// + LSP support immediately, but the editor leaves the body of
// `<MyTex>…</MyTex>` un-coloured because the static grammar doesn't know
// about it. The LSP, on the other hand, already reads the verbatim tag
// list from the user's actual config (see `regions.ts`), so it can emit
// semantic tokens marking each region's body — and the editor lays those
// on top of whatever its static grammar produced.
//
// CRITICAL: semantic tokens *replace* whatever colour the static grammar
// would give a range, they don't refine it. So:
//
//   - Standard tags (`tex` / `latex` / `tikz` / `verb` / `verbatim`) are
//     skipped entirely — the editor grammars already paint their bodies
//     with rich LaTeX / fenced-code colouring, and any token we emitted
//     would replace that with something coarser.
//   - Custom TeX-typed tags (those in the user's `latexTags`) are
//     tokenised through the vendored `text.tex.latex` TextMate grammar
//     (see `../grammars/`). The token's scope chain is mapped onto a
//     small LSP token-type vocabulary (`comment`, `function`, `keyword`,
//     `string`, `number`, `operator`, `variable`) and emitted. This gives
//     Zed proper LaTeX colouring for `<MyTex>` etc., and matches what
//     VS Code's TextMate path would have produced once
//     `sveltex.tmLanguage.json` is regenerated for the same tag.
//   - Custom non-TeX-typed tags (escape / code / noop) get one flat
//     `string` token per body line — a uniform colour is the right look
//     for "literal text" and the easiest signal that something is
//     special here.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokensBuilder } from 'vscode-languageserver';
import type { SemanticTokens } from 'vscode-languageserver-protocol';
// `vscode-textmate` and `vscode-oniguruma` are CommonJS packages — `import
// *` gives `{ default, module.exports, … }` and not the actual surface.
// Default-import gives `module.exports` directly, which is what we want.
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';
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
 * colouring is strictly richer than anything this module can produce, and
 * emitting tokens would *replace* the grammar's work with something
 * coarser. Comparisons are case-insensitive, mirroring the case handling
 * in the editor grammars.
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
 * legend. Indices into this array appear in the wire-format token data.
 *
 * The set is the intersection of the standard LSP types most themes have
 * colours for and the TextMate scope categories the LaTeX grammar emits.
 */
export const SEMANTIC_TOKEN_TYPES = [
    'comment',
    'function',
    'keyword',
    'string',
    'number',
    'operator',
    'variable',
] as const;

/** Token-modifier vocabulary. Empty; reserved for future use. */
export const SEMANTIC_TOKEN_MODIFIERS: readonly string[] = [];

type TokenTypeName = (typeof SEMANTIC_TOKEN_TYPES)[number];

const TOKEN_TYPE_INDEX: Record<TokenTypeName, number> = Object.fromEntries(
    SEMANTIC_TOKEN_TYPES.map((t, i) => [t, i]),
) as Record<TokenTypeName, number>;

/**
 * Returns whether the opening tag of `region` is one of the
 * {@link NATIVELY_HIGHLIGHTED_TAGS}. A `verbatim` region whose tag isn't
 * recognised (or whose slice is malformed) returns `false`, so the LSP
 * defaults to emitting tokens for it.
 */
function extractTagName(source: string, region: Region): string | null {
    if (region.kind !== 'verbatim') return null;
    const slice = source.slice(region.sourceStart, region.sourceEnd);
    const tagMatch = /^<\s*([a-zA-Z][-.:0-9_a-zA-Z]*)/u.exec(slice);
    return tagMatch ? (tagMatch[1] ?? null) : null;
}

/**
 * Maps a TextMate scope chain to an LSP semantic token type, or `null` if
 * the chain doesn't carry one of our advertised types. The first match
 * wins, scanned from the most-specific (innermost) scope outwards.
 *
 * Scope categories the LaTeX grammar emits, paired with the LSP type
 * they're most commonly themed as:
 *
 *   - `comment.*` → `comment`
 *   - `support.function.*` / `entity.name.function.*` → `function`
 *   - `keyword.*` / `storage.*` → `keyword`
 *   - `string.*` → `string`
 *   - `constant.numeric.*` → `number`
 *   - `punctuation.definition.constant.*` / similar operator-y scopes → `operator`
 *   - `variable.*` → `variable`
 *
 * Anything else is left un-tokenised — the editor's static grammar
 * colouring shines through for those ranges (in VS Code), and Zed just
 * shows them plain (which is consistent with how it treats unrecognised
 * text generally).
 */
function classifyScope(scopes: readonly string[]): TokenTypeName | null {
    // Most-specific scope is last; scan in reverse so finer-grained
    // categorisation wins (`entity.name.function.parameter.latex` is more
    // informative than the outer `support.function.…`).
    for (let i = scopes.length - 1; i >= 0; i--) {
        const s = scopes[i];
        if (!s) continue;
        if (s.startsWith('comment.')) return 'comment';
        if (s.startsWith('constant.numeric.')) return 'number';
        if (s.startsWith('string.')) return 'string';
        if (s.startsWith('variable.')) return 'variable';
        if (
            s.startsWith('support.function.') ||
            s.startsWith('entity.name.function.') ||
            s.startsWith('support.class.') ||
            s.startsWith('entity.name.section.')
        ) {
            return 'function';
        }
        if (s.startsWith('keyword.') || s.startsWith('storage.')) {
            return 'keyword';
        }
        if (
            s.startsWith('punctuation.definition.constant.') ||
            s.startsWith('keyword.operator.')
        ) {
            return 'operator';
        }
    }
    return null;
}

/**
 * Lazily-built tokenizer that loads the vendored LaTeX + base-TeX
 * grammars. Singleton: the registry holds onig WASM that's expensive to
 * initialise, and the grammars themselves can be reused across requests.
 *
 * Returns `null` when grammar loading fails — semantic tokens for custom
 * LaTeX bodies then fall back to a flat `string` per line, the same as
 * non-LaTeX verbatim bodies.
 */
type LatexTokenizer = (lines: readonly string[]) => readonly {
    readonly tokens: { startIndex: number; endIndex: number; scopes: string[] }[];
}[];

let latexTokenizerPromise: Promise<LatexTokenizer | null> | undefined;

const GRAMMARS_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'grammars',
);

async function loadLatexTokenizer(): Promise<LatexTokenizer | null> {
    try {
        // `require.resolve` isn't a built-in in ESM; synthesise one via
        // `createRequire` keyed to this module's URL so the `vscode-
        // oniguruma` lookup uses the standard Node resolution algorithm
        // from this package's location.
        const requireFromHere = createRequire(import.meta.url);
        const wasmPath = requireFromHere.resolve(
            'vscode-oniguruma/release/onig.wasm',
        );
        const wasm = readFileSync(wasmPath);
        await oniguruma.loadWASM(wasm);

        const registry = new vsctm.Registry({
            onigLib: Promise.resolve({
                createOnigScanner: (sources) =>
                    new oniguruma.OnigScanner(sources),
                createOnigString: (s) => new oniguruma.OnigString(s),
            }),
            // `vsctm.Registry`'s `loadGrammar` is typed as
            // `(scopeName) => Promise<RawGrammar | null>`, but our reads
            // are synchronous (`readFileSync` of a small JSON shipped in
            // `dist/grammars/`). Wrapping in `Promise.resolve` satisfies
            // the type without imposing an `async` we'd then have no
            // `await` for — pick your rule poison.
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            loadGrammar: (scopeName) => {
                if (scopeName === 'text.tex.latex') {
                    return Promise.resolve(
                        vsctm.parseRawGrammar(
                            readFileSync(
                                join(GRAMMARS_DIR, 'LaTeX.tmLanguage.json'),
                                'utf-8',
                            ),
                            'LaTeX.tmLanguage.json',
                        ),
                    );
                }
                if (scopeName === 'text.tex') {
                    return Promise.resolve(
                        vsctm.parseRawGrammar(
                            readFileSync(
                                join(GRAMMARS_DIR, 'TeX.tmLanguage.json'),
                                'utf-8',
                            ),
                            'TeX.tmLanguage.json',
                        ),
                    );
                }
                // Stub everything else — the LaTeX grammar references
                // many embedded languages (source.python, source.cpp, …)
                // we don't care about for verbatim-body highlighting.
                return Promise.resolve(
                    vsctm.parseRawGrammar(
                        JSON.stringify({ scopeName, patterns: [] }),
                        `${scopeName}.stub.json`,
                    ),
                );
            },
        });
        const grammar = await registry.loadGrammar('text.tex.latex');
        if (!grammar) return null;
        return (lines) => {
            let stack = vsctm.INITIAL;
            const out: { tokens: vsctm.IToken[] }[] = [];
            for (const line of lines) {
                const { tokens, ruleStack } = grammar.tokenizeLine(line, stack);
                out.push({ tokens });
                stack = ruleStack;
            }
            return out;
        };
    } catch {
        return null;
    }
}

/**
 * Computes the encoded `SemanticTokens` for `text`.
 *
 * @param text - Full text of the `.sveltex` document.
 * @param regions - Pre-computed regions (output of `computeRegions`). Passed
 * in rather than recomputed so the caller — which has them on hand for every
 * other request — pays the parse cost only once per `didChange`.
 * @param latexTags - The `latexTags` array from the live config snapshot.
 * A verbatim region whose tag is in here is tokenised as LaTeX; otherwise
 * it's treated as plain literal text.
 */
export async function computeSemanticTokens(
    text: string,
    regions: readonly Region[],
    latexTags: readonly string[] = [],
): Promise<SemanticTokens> {
    const doc = TextDocument.create('mem://sveltex', 'sveltex', 0, text);
    const builder = new SemanticTokensBuilder();
    const latexLowercase = new Set(latexTags.map((t) => t.toLowerCase()));

    // Group regions by whether they need LaTeX tokenisation, then load the
    // grammar at most once per request.
    interface Pending {
        region: Region;
        body: readonly [number, number];
        kind: 'latex' | 'plain';
    }
    const pending: Pending[] = [];
    for (const region of regions) {
        if (region.kind !== 'verbatim') continue;
        const tag = extractTagName(text, region);
        if (!tag) continue;
        const tagLower = tag.toLowerCase();
        // Standard tags: editor grammar handles them better — skip.
        if (NATIVELY_HIGHLIGHTED_TAGS.has(tagLower)) continue;
        const body = verbatimBodyOffsets(text, region);
        if (!body) continue;
        pending.push({
            region,
            body,
            kind: latexLowercase.has(tagLower) ? 'latex' : 'plain',
        });
    }

    if (pending.length === 0) return builder.build();

    const needsLatex = pending.some((p) => p.kind === 'latex');
    const tokenizer = needsLatex
        ? ((latexTokenizerPromise ??= loadLatexTokenizer()), await latexTokenizerPromise)
        : null;

    for (const p of pending) {
        if (p.kind === 'latex' && tokenizer) {
            tokenizeLatexBody(builder, doc, text, p.body[0], p.body[1], tokenizer);
        } else {
            pushFlatStringTokens(builder, doc, text, p.body[0], p.body[1]);
        }
    }

    return builder.build();
}

/**
 * Tokenises `[start, end)` as LaTeX via `tokenizer`, emitting one LSP
 * semantic token per TextMate token whose scope chain maps to one of our
 * advertised token types ({@link classifyScope}). TextMate tokens that
 * don't map are silently skipped — the editor grammar (in VS Code) keeps
 * its colour there; in Zed they appear plain.
 */
function tokenizeLatexBody(
    builder: SemanticTokensBuilder,
    doc: TextDocument,
    text: string,
    start: number,
    end: number,
    tokenizer: LatexTokenizer,
): void {
    if (end <= start) return;
    // Split the body into lines, preserving newlines so the TM tokenizer
    // sees `\n`-terminated input the way it expects.
    const body = text.slice(start, end);
    const startPos = doc.positionAt(start);
    const lines = body.split(/(?<=\n)/u);
    const tokenized = tokenizer(lines);
    let lineOffset = start;
    for (let i = 0; i < tokenized.length; i++) {
        const lineNumber = startPos.line + i;
        const lineStart = lineOffset;
        const lineEntry = tokenized[i];
        if (!lineEntry) {
            lineOffset += lines[i]?.length ?? 0;
            continue;
        }
        const startChar = lineNumber === startPos.line ? startPos.character : 0;
        for (const tok of lineEntry.tokens) {
            const type = classifyScope(tok.scopes);
            if (!type) continue;
            // Token offsets are line-relative; convert to source-relative
            // by shifting in the per-line origin column.
            const localStart = tok.startIndex;
            // Trim trailing CR/LF so the token doesn't bleed into next line.
            const absoluteStart = lineStart + localStart;
            let absoluteEnd = lineStart + tok.endIndex;
            if (
                absoluteEnd > absoluteStart &&
                text.charCodeAt(absoluteEnd - 1) === 0x0a
            ) {
                absoluteEnd--;
            }
            if (
                absoluteEnd > absoluteStart &&
                text.charCodeAt(absoluteEnd - 1) === 0x0d
            ) {
                absoluteEnd--;
            }
            const length = absoluteEnd - absoluteStart;
            if (length <= 0) continue;
            // The first body line starts at column `startPos.character`
            // (because the open tag occupies the columns before it), but
            // subsequent lines start at column 0. The tokenizer was fed
            // bare lines, so its `startIndex` is column-0-relative — for
            // line 0 we have to add the open tag's width back.
            const column =
                lineNumber === startPos.line
                    ? startChar + localStart
                    : localStart;
            builder.push(
                lineNumber,
                column,
                length,
                TOKEN_TYPE_INDEX[type],
                0,
            );
        }
        lineOffset += lines[i]?.length ?? 0;
    }
}

/**
 * Pushes one `string` token per line in the half-open offset range
 * `[start, end)`. Used for non-LaTeX custom verbatim tags where a uniform
 * `string` colour is the right look — there's no syntax to tokenise, the
 * body is literal text.
 */
function pushFlatStringTokens(
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
        builder.push(
            line,
            startChar,
            length,
            TOKEN_TYPE_INDEX.string,
            0,
        );
    }
}
