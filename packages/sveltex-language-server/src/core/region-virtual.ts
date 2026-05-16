// File description: Builds a per-region virtual document for a non-delegated
// region (a math region, or a LaTeX verbatim region) plus the `SourceMap` that
// ties it back to the `.sveltex` source.
//
// `virtual-svelte.ts` blanks these regions out of the ONE virtual `.svelte`
// document handed to `svelte-language-server`. To get language assistance for
// them instead, the SvelTeX server forwards requests to a dedicated child (the
// math language server, or TexLab). The region's syntactic wrapper — the
// `$`/`$$`/`\(`/`\[` math delimiters, or the `<tex>…</tex>` verbatim tags — is
// stripped, and positions are mapped across that strip.
//
// The math server wants bare TeX. TexLab, a full LaTeX language server, does
// not: its completion and hover are context-sensitive, and a bare fragment
// (`\alp`) yields almost nothing — TexLab does not see it as document-body
// content. So a LaTeX (verbatim) region's content is embedded in a minimal
// `\documentclass…\begin{document}…\end{document}` scaffold. The scaffold lines
// are synthetic — no `Mapping` covers them — so they never appear in a
// forwarded result. The same `SourceMap` / `Mapping` model the Svelte side
// uses is reused throughout.

import { identityMapping } from './mapping.js';
import { SourceMap } from './mapper.js';
import type { Region } from './regions.js';

/** A standalone virtual document for one region. */
export interface RegionVirtualDocument {
    /**
     * The virtual document text handed to the child server. For a math region
     * this is the bare inner text (delimiters stripped); for a LaTeX verbatim
     * region it is that inner text embedded in {@link latexRegionScaffold}.
     */
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

/**
 * The minimal LaTeX document a verbatim (LaTeX) region's content is embedded
 * into before being handed to TexLab.
 *
 * TexLab's completion and hover are context-sensitive: a bare command fragment
 * is not treated as document-body content and yields next to nothing. Putting
 * the fragment inside `\begin{document}…\end{document}` is what unlocks
 * TexLab's command completion. The preamble also loads `amsmath` and `tikz` —
 * the packages a SvelTeX `<tex>` block most often relies on — so their
 * commands complete too, where the user's TeX distribution provides them.
 *
 * Exported so the source-map geometry is verifiable and the preamble lives in
 * exactly one place.
 */
export const latexRegionScaffold = {
    /** Inserted before the region content. */
    prefix:
        '\\documentclass{article}\n' +
        '\\usepackage{amsmath}\n' +
        '\\usepackage{tikz}\n' +
        '\\begin{document}\n',
    /** Inserted after the region content. */
    suffix: '\n\\end{document}\n',
} as const;

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
 * A `math` region's virtual document is the bare inner text. A `verbatim`
 * region's is that inner text wrapped in {@link latexRegionScaffold}. Either
 * way the `SourceMap` holds one identity mapping covering the inner span —
 * `[innerStart … innerEnd) ↔ [prefixLength … prefixLength + innerLength)` — so
 * a caret in the inner text maps straight back to the right `.sveltex` offset,
 * while the synthetic scaffold lines are covered by no mapping at all.
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
    const innerText = source.slice(innerStart, innerEnd);

    // A `verbatim` region is forwarded to TexLab, which needs document-body
    // context; a `math` region goes to the bare-TeX math server, which does
    // not. Embed the former in a minimal LaTeX document.
    const scaffold =
        region.kind === 'verbatim'
            ? latexRegionScaffold
            : { prefix: '', suffix: '' };
    const text = `${scaffold.prefix}${innerText}${scaffold.suffix}`;

    const sourceMap = SourceMap.create(
        [
            identityMapping(
                innerStart,
                scaffold.prefix.length,
                innerText.length,
            ),
        ],
        source,
        text,
    );
    return { text, sourceMap, innerStart, innerEnd };
}
