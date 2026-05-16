// File description: Builds a per-region virtual document for a non-delegated
// region (a math region, or a LaTeX verbatim region) plus the `SourceMap` that
// ties it back to the `.sveltex` source.
//
// `virtual-svelte.ts` blanks these regions out of the ONE virtual `.svelte`
// document handed to `svelte-language-server`. To get language assistance for
// them instead, the SvelTeX server forwards requests to a dedicated child (the
// math language server, or TexLab). Those children expect a clean, standalone
// document — bare TeX for the math server, bare LaTeX for TexLab — so the
// region's syntactic wrapper (the `$`/`$$`/`\(`/`\[` math delimiters, or the
// `<tex>…</tex>` verbatim tags) must be stripped, and positions mapped across
// that strip. This module does exactly that, reusing the same `SourceMap` /
// `Mapping` model the Svelte side uses.

import { identityMapping } from './mapping.js';
import { SourceMap } from './mapper.js';
import type { Region } from './regions.js';

/** A standalone virtual document for one region. */
export interface RegionVirtualDocument {
    /** The bare inner text (math delimiters / verbatim tags stripped). */
    text: string;
    /**
     * Bidirectional mapper between the `.sveltex` source and {@link text}.
     * Built over a single identity mapping covering the region's inner span.
     */
    sourceMap: SourceMap;
    /** Offset in the `.sveltex` source where the inner text begins. */
    innerStart: number;
    /** Offset one past the end of the inner text in the `.sveltex` source. */
    innerEnd: number;
}

/** A `[prefixLength, suffixLength]` pair describing a wrapper to strip. */
type Wrapper = readonly [prefix: number, suffix: number];

/**
 * Determines the math delimiter wrapper of a math-region slice.
 *
 * SvelTeX math regions are delimited by `$$…$$`, `$…$`, `\[…\]` or `\(…\)`.
 * The slice always _includes_ the delimiters (verified against
 * `computeRegions`' output).
 *
 * @param slice - The full text of the math region.
 * @returns The prefix/suffix lengths to strip. An unrecognised slice yields
 * `[0, 0]` (nothing stripped — better to over-include than to mis-map).
 */
function mathWrapper(slice: string): Wrapper {
    if (slice.startsWith('$$') && slice.endsWith('$$') && slice.length >= 4) {
        return [2, 2];
    }
    if (slice.startsWith('$') && slice.endsWith('$') && slice.length >= 2) {
        return [1, 1];
    }
    if (slice.startsWith('\\[') && slice.endsWith('\\]')) return [2, 2];
    if (slice.startsWith('\\(') && slice.endsWith('\\)')) return [2, 2];
    return [0, 0];
}

/**
 * Determines the verbatim-tag wrapper of a verbatim-region slice.
 *
 * A SvelTeX verbatim region is an HTML-like element, `<tag …>…</tag>` or the
 * self-closing `<tag …/>`. For a self-closing element there is no inner
 * content, so the whole slice is "wrapper".
 *
 * @param slice - The full text of the verbatim region.
 * @returns The prefix/suffix lengths to strip.
 */
function verbatimWrapper(slice: string): Wrapper {
    // Self-closing `<tag … />`: no inner content.
    if (/\/\s*>\s*$/u.test(slice) && !/<\/\s*[a-zA-Z]/u.test(slice)) {
        return [slice.length, 0];
    }
    // Opening tag: `<tag …>` — match up to the first unescaped `>`.
    const open = /^<[a-zA-Z][^>]*>/u.exec(slice);
    // Closing tag: `</tag …>` at the very end.
    const close = /<\/\s*[a-zA-Z][^>]*>\s*$/u.exec(slice);
    if (!open || !close) return [0, 0];
    return [open[0].length, close[0].length];
}

/**
 * Builds a {@link RegionVirtualDocument} for a math or verbatim region.
 *
 * @param source - Full text of the `.sveltex` document.
 * @param region - The region to extract. Its `kind` must be `math` or
 * `verbatim`; for any other kind the whole slice is treated as inner content.
 * @returns The standalone virtual document and its source map.
 *
 * @remarks
 * The virtual document is the region's _inner_ text only; the `SourceMap`
 * holds one identity mapping `[innerStart … innerEnd) ↔ [0 … innerLength)`, so
 * a caret anywhere in the bare document maps straight back to the right
 * `.sveltex` offset.
 */
export function buildRegionVirtualDocument(
    source: string,
    region: Region,
): RegionVirtualDocument {
    const slice = source.slice(region.sourceStart, region.sourceEnd);
    const [prefix, suffix] =
        region.kind === 'math'
            ? mathWrapper(slice)
            : region.kind === 'verbatim'
              ? verbatimWrapper(slice)
              : ([0, 0] as Wrapper);

    const innerStart = region.sourceStart + prefix;
    const innerEnd = Math.max(innerStart, region.sourceEnd - suffix);
    const text = source.slice(innerStart, innerEnd);

    const sourceMap = SourceMap.create(
        [identityMapping(innerStart, 0, text.length)],
        source,
        text,
    );
    return { text, sourceMap, innerStart, innerEnd };
}
