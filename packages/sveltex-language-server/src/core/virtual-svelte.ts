// File description: Builds the virtual `.svelte` document that is handed to the
// embedded Svelte language server, together with the `Mapping[]` that links it
// back to the source `.sveltex` file.
//
// Strategy (v1): delegated regions (plain Markdown/HTML, Svelte markup, mustache
// tags) are copied byte-for-byte and get an identity `Mapping`; non-delegated
// regions (verbatim / code / math / frontmatter) are replaced by an equal-length
// run of whitespace — newlines preserved so line numbers stay aligned — and get
// NO mapping. Because every region keeps its exact length, the virtual document
// is the same length as the source, which keeps the geometry trivially correct.

import { isDelegated, type Region } from './regions.js';
import { identityMapping, type Mapping } from './mapping.js';
import { SourceMap } from './mapper.js';

/** The result of {@link buildVirtualSvelte}. */
export interface VirtualSvelteDocument {
    /** Full text of the generated `.svelte` document. */
    text: string;
    /** Span pairs linking the generated document to the source document. */
    mappings: Mapping[];
    /** A ready-to-use bidirectional mapper over {@link mappings}. */
    sourceMap: SourceMap;
}

/**
 * Replaces every non-whitespace character of `slice` with a space, leaving
 * `\r` and `\n` untouched.
 *
 * Keeping the line breaks means a caret on line N of the source sits on line N
 * of the virtual document too, so even the (unmapped) blanked regions do not
 * shift anything below them.
 */
function blankOut(slice: string): string {
    return slice.replace(/[^\r\n]/gu, ' ');
}

/**
 * Builds the virtual `.svelte` document for a `.sveltex` source file.
 *
 * @param source - Full text of the `.sveltex` document.
 * @param regions - The document's regions, as returned by `computeRegions`.
 * Must tile `[0, source.length)` gap-free (which `computeRegions` guarantees).
 * @returns The generated text, the mappings, and a {@link SourceMap}.
 *
 * @remarks
 * Delegated content reaches the Svelte language server unchanged, so Svelte /
 * HTML / TypeScript / CSS diagnostics and IntelliSense work exactly as they
 * would in a real `.svelte` file. Non-delegated content is invisible to that
 * server (it sees only blanks), which is what stops it from, say, reporting
 * "unexpected token" inside a block of LaTeX.
 *
 * TODO (phase 2): expand Markdown regions to the HTML the Svelte compiler will
 * actually see, emitting non-identity mappings; the `Mapping` model and
 * {@link SourceMap} already support differing span lengths.
 */
export function buildVirtualSvelte(
    source: string,
    regions: Region[],
): VirtualSvelteDocument {
    const chunks: string[] = [];
    const mappings: Mapping[] = [];
    let generatedOffset = 0;

    for (const region of regions) {
        const slice = source.slice(region.sourceStart, region.sourceEnd);
        if (isDelegated(region.kind)) {
            // Copy verbatim and record an identity mapping.
            chunks.push(slice);
            mappings.push(
                identityMapping(
                    region.sourceStart,
                    generatedOffset,
                    slice.length,
                ),
            );
        } else {
            // Blank out; emit no mapping so requests here are dropped.
            chunks.push(blankOut(slice));
        }
        generatedOffset += slice.length;
    }

    const text = chunks.join('');
    return {
        text,
        mappings,
        sourceMap: SourceMap.create(mappings, source, text),
    };
}
