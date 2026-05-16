// File description: Diagnostic merging. Combines diagnostics produced by the
// embedded Svelte language server (which run against the generated virtual
// `.svelte` document and must be mapped back to source coordinates) with any
// native diagnostics the LSP itself produces, and discards anything that lands
// outside a delegated region.

import type { Diagnostic } from 'vscode-languageserver-protocol';
import type { SourceMap } from './mapper.js';

/**
 * Maps a batch of diagnostics from the generated virtual document back to the
 * source `.sveltex` document, dropping any that fall in a non-delegated region.
 *
 * @param diagnostics - Diagnostics as reported by the child Svelte server,
 * with ranges in generated-document coordinates.
 * @param sourceMap - The source map for the document the diagnostics belong to.
 * @returns The subset of diagnostics whose range maps cleanly to source
 * coordinates, with their ranges (and any related-information ranges) rewritten
 * to the source document.
 *
 * @remarks
 * A diagnostic is kept only when _both_ ends of its range map. This drops
 * "unexpected token" style errors the Svelte compiler would otherwise raise
 * over the whitespace that replaced a verbatim/code/math region — those regions
 * are the LSP's own responsibility (stubbed for v1) and must not leak the
 * embedded server's confusion to the user.
 */
export function mapProxiedDiagnostics(
    diagnostics: Diagnostic[],
    sourceMap: SourceMap,
): Diagnostic[] {
    const mapped: Diagnostic[] = [];
    for (const diagnostic of diagnostics) {
        const range = sourceMap.generatedRangeToSource(diagnostic.range);
        if (!range) continue;

        // `relatedInformation` may point into other locations of the same
        // document; map those that can be mapped and drop those that cannot.
        const related = diagnostic.relatedInformation
            ?.map((info) => {
                const infoRange = sourceMap.generatedRangeToSource(
                    info.location.range,
                );
                if (!infoRange) return undefined;
                return {
                    ...info,
                    location: { ...info.location, range: infoRange },
                };
            })
            .filter((info): info is NonNullable<typeof info> => Boolean(info));

        mapped.push({
            ...diagnostic,
            range,
            ...(related && related.length > 0
                ? { relatedInformation: related }
                : {}),
        });
    }
    return mapped;
}

/**
 * Merges proxied (already source-mapped) diagnostics with native diagnostics.
 *
 * @param proxied - Source-mapped diagnostics from {@link mapProxiedDiagnostics}.
 * @param native - Diagnostics produced directly by the LSP (currently none;
 * reserved for future LaTeX/math diagnostics).
 * @returns The concatenated list.
 *
 * @remarks
 * Kept as a separate seam so that, when native LaTeX/math diagnostics arrive,
 * the publish path does not change.
 */
export function mergeDiagnostics(
    proxied: Diagnostic[],
    native: Diagnostic[],
): Diagnostic[] {
    return [...proxied, ...native];
}
