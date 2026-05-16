// File description: Splits a `.sveltex` document into a flat, gap-free array of
// `Region`s by reusing SvelTeX's own region-detection building blocks.
//
// SvelTeX's preprocessor produces no usable source map for markup (see the
// package README), so the LSP must reconstruct the region structure itself.
// Fortunately `@nvl/sveltex` exports the precise, offset-bearing detectors it
// uses internally. We call those and classify each detected snippet as either
// "delegated" (handed to the embedded Svelte language server) or "non-delegated"
// (verbatim / code / math / frontmatter — blanked out before delegation).
//
// TODO: upstream a public `getRegions()` into `@nvl/sveltex` so that this file
// can stop importing from the `dist/` deep path below.

import {
    getColonES,
    getMathInSpecialDelimsES,
    getMdastES,
    getSvelteES,
    outermostRanges,
    parseToMdast,
} from '@nvl/sveltex/dist/utils/escape.js';
import type { SveltexConfigSnapshot } from './config.js';

/**
 * The kind of a {@link Region}.
 *
 * - `markdown`: Plain Markdown / HTML. Delegated to the Svelte language server
 *   (which understands the HTML subset) and additionally analyzed natively for
 *   Markdown-specific features (folding, symbols, selection ranges).
 * - `svelte`: Svelte markup that is _not_ a mustache tag — `<script>`,
 *   `<style>`, `<svelte:*>` elements, logic blocks (`{#if}`/`{/if}`/...) and
 *   special tags (`{@const}`, `{@debug}`, ...). Delegated verbatim.
 * - `mustacheTag`: A Svelte mustache tag, e.g. `{name}`. Delegated verbatim.
 * - `code`: A fenced code block or inline code span. _Not_ delegated.
 * - `math`: Inline or display math (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`).
 *   _Not_ delegated.
 * - `verbatim`: A SvelTeX verbatim environment (`<tex>`, `<verbatim>`, ...).
 *   _Not_ delegated.
 * - `frontmatter`: A YAML / TOML / JSON frontmatter block. _Not_ delegated.
 */
export type RegionKind =
    | 'markdown'
    | 'svelte'
    | 'mustacheTag'
    | 'code'
    | 'math'
    | 'verbatim'
    | 'frontmatter';

/**
 * A contiguous slice of a `.sveltex` document, classified by {@link RegionKind}.
 *
 * `Region`s returned by {@link computeRegions} tile the entire document
 * gap-free: `regions[i].sourceEnd === regions[i + 1].sourceStart`, the first
 * region starts at offset `0`, and the last ends at `document.length`.
 */
export interface Region {
    /** What kind of content this region holds. */
    kind: RegionKind;
    /** Offset of the first character of the region (inclusive). */
    sourceStart: number;
    /** Offset one past the last character of the region (exclusive). */
    sourceEnd: number;
}

/**
 * `RegionKind`s whose contents are forwarded verbatim to the embedded Svelte
 * language server. Everything else is blanked out in the virtual document.
 */
const DELEGATED_KINDS: ReadonlySet<RegionKind> = new Set<RegionKind>([
    'markdown',
    'svelte',
    'mustacheTag',
]);

/**
 * Returns whether a region of the given kind should be delegated to the
 * embedded Svelte language server.
 */
export function isDelegated(kind: RegionKind): boolean {
    return DELEGATED_KINDS.has(kind);
}

/**
 * A half-open `[start, end)` offset range tagged with a {@link RegionKind}.
 * Internal intermediate representation before gaps are filled with `markdown`.
 */
interface TaggedRange {
    kind: RegionKind;
    start: number;
    end: number;
}

/**
 * Maps a SvelTeX snippet `type` to the LSP's {@link RegionKind}.
 *
 * SvelTeX snippet types are `code | math | svelte | mustacheTag | verbatim |
 * frontmatter`, which line up one-to-one with our region kinds (none of them is
 * `markdown` — plain Markdown is whatever is left over).
 */
function snippetTypeToRegionKind(type: string): RegionKind {
    switch (type) {
        case 'code':
        case 'math':
        case 'svelte':
        case 'mustacheTag':
        case 'verbatim':
        case 'frontmatter':
            return type;
        default:
            // Defensive: an unknown snippet type is treated as opaque verbatim
            // so that it is never mistakenly delegated.
            return 'verbatim';
    }
}

/**
 * Detects SvelTeX verbatim environments (`<tex>...</tex>`, `<verbatim/>`, ...).
 *
 * SvelTeX's `getVerbatimES` is _not_ part of the package's public surface, so
 * we re-derive the (simple) detection here: a verbatim environment is just an
 * HTML-like element whose tag name is one of the configured verbatim tags. This
 * intentionally mirrors the regexes in `@nvl/sveltex`'s `escape.ts`.
 *
 * TODO: replace with `getVerbatimES` once `@nvl/sveltex` exports it.
 */
function detectVerbatimRanges(
    document: string,
    verbatimTags: readonly string[],
): TaggedRange[] {
    const ranges: TaggedRange[] = [];
    if (verbatimTags.length === 0) return ranges;
    const alternation = verbatimTags
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('|');
    // Matches `<tag ...>...</tag>` (with lazy inner content) or `<tag ... />`.
    // `s` flag: `.` spans newlines. `u` flag is required by the repo's lint.
    const re = new RegExp(
        `<(${alternation})(?:\\s[^>]*?)?(?:/>|>.*?</\\s*\\1\\s*>)`,
        'gisu',
    );
    for (const match of document.matchAll(re)) {
        const start = match.index;
        ranges.push({
            kind: 'verbatim',
            start,
            end: start + match[0].length,
        });
    }
    return ranges;
}

/**
 * Returns a copy of `document` with every character inside one of `ranges`
 * replaced by a space; newline characters are kept, so offsets _and_ line
 * numbers are preserved.
 *
 * It is used to hide already-classified snippets from the verbatim-tag scan:
 * a `<tex>` written inside an inline-code span (`` `<tex>` ``), a string in a
 * `<script>`, etc. must not be mistaken for the opening of a verbatim
 * environment — otherwise its match runs greedily to the next, unrelated
 * `</tex>` and swallows the real block in between.
 */
function maskRanges(
    document: string,
    ranges: readonly TaggedRange[],
): string {
    if (ranges.length === 0) return document;
    const chars = document.split('');
    for (const range of ranges) {
        const end = Math.min(range.end, chars.length);
        for (let i = Math.max(0, range.start); i < end; i += 1) {
            const ch = chars[i];
            if (ch !== '\n' && ch !== '\r') chars[i] = ' ';
        }
    }
    return chars.join('');
}

/**
 * Parses a `.sveltex` document and returns a gap-free, sorted list of
 * {@link Region}s.
 *
 * @param document - The full text of the `.sveltex` file.
 * @param config - A snapshot of the resolved `sveltex.config.*` (verbatim tags,
 * math delimiters, directive settings).
 * @returns The document's regions, tiling `[0, document.length)` with no gaps
 * and no overlaps.
 *
 * @remarks
 * The heavy lifting is done by SvelTeX's own exported detectors
 * (`parseToMdast`, `getMdastES`, `getSvelteES`, `getMathInSpecialDelimsES`,
 * `getColonES`) plus `outermostRanges` to discard nested matches. Anything not
 * covered by a detected snippet is emitted as a `markdown` region.
 */
export function computeRegions(
    document: string,
    config: SveltexConfigSnapshot,
): Region[] {
    const tagged: TaggedRange[] = [];

    try {
        const verbatimTags = config.verbatimTags;
        const mdastTags = [...verbatimTags, 'script', 'style'];
        const ast = parseToMdast(
            document,
            mdastTags,
            config.mathDelims,
            config.directives,
        );
        const lines = document.split(/\r\n?|\n/u);

        const snippets = [
            ...getMdastES({
                ast,
                document,
                lines,
                texSettings: config.mathDelims,
                directiveSettings: config.directives,
            }),
            ...getSvelteES(document),
            ...getMathInSpecialDelimsES(document, config.mathDelims),
        ];

        // `getColonES` reports the individual `:` characters inside special
        // Svelte elements (`<svelte:head>` etc.). Those colons live inside
        // `svelte`/`markdown` regions already, so they need no separate region;
        // we only consult `getColonES` to stay forward-compatible and ignore
        // its output here.
        void getColonES;

        for (const snippet of outermostRanges([...snippets], 'original.loc')) {
            tagged.push({
                kind: snippetTypeToRegionKind(snippet.type),
                start: snippet.original.loc.start,
                end: snippet.original.loc.end,
            });
        }

        // Scan for verbatim environments over a copy of the document with
        // every snippet found above blanked out. A bare regex scan of the raw
        // document would anchor on a `<tex>` that is really inside an
        // inline-code span and pair it with a *later*, unrelated `</tex>` —
        // swallowing the genuine verbatim block in between.
        tagged.push(
            ...detectVerbatimRanges(
                maskRanges(document, tagged),
                verbatimTags,
            ),
        );
    } catch {
        // If SvelTeX's parser throws (malformed input mid-edit is common), fall
        // back to treating the whole document as delegated Markdown. The Svelte
        // language server is itself resilient to partial input.
        return [
            { kind: 'markdown', sourceStart: 0, sourceEnd: document.length },
        ];
    }

    return fillGaps(tagged, document.length);
}

/**
 * Sorts tagged ranges, drops overlaps, and fills the holes between them with
 * `markdown` regions so that the result tiles `[0, length)` exactly.
 */
function fillGaps(tagged: TaggedRange[], length: number): Region[] {
    // `outermostRanges` already removed nesting among the mdast/svelte snippets,
    // but verbatim ranges were appended afterwards and could overlap a snippet
    // (e.g. a verbatim tag that also looks like an HTML element). Re-run the
    // outermost filter over the combined set, sorted by start offset.
    const sorted = [...tagged].sort((a, b) =>
        a.start !== b.start ? a.start - b.start : b.end - a.end,
    );

    const regions: Region[] = [];
    let cursor = 0;

    for (const range of sorted) {
        // Skip ranges that overlap something we already emitted.
        if (range.start < cursor) continue;
        if (range.start >= length) break;
        const end = Math.min(range.end, length);
        if (end <= range.start) continue;
        // Fill the gap before this range with plain Markdown.
        if (range.start > cursor) {
            regions.push({
                kind: 'markdown',
                sourceStart: cursor,
                sourceEnd: range.start,
            });
        }
        regions.push({
            kind: range.kind,
            sourceStart: range.start,
            sourceEnd: end,
        });
        cursor = end;
    }

    // Trailing Markdown.
    if (cursor < length) {
        regions.push({
            kind: 'markdown',
            sourceStart: cursor,
            sourceEnd: length,
        });
    }

    // An empty document still yields one (empty) Markdown region so that
    // downstream consumers never have to special-case `regions.length === 0`.
    if (regions.length === 0) {
        regions.push({ kind: 'markdown', sourceStart: 0, sourceEnd: length });
    }

    return regions;
}
