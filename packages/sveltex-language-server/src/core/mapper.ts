// File description: `SourceMap` — a bidirectional, offset-based mapper between
// the source `.sveltex` document and the generated virtual `.svelte` document.
//
// Geometry is expressed with `Mapping` offset-triples (see `mapping.ts`). LSP
// requests, however, speak in line/character `Position`s, so the mapper also
// holds a `TextDocument` view of each side purely to convert offsets <-> LSP
// positions. The two concerns are kept separate: all mapping math is done on
// integer offsets, and line/character conversion is a thin shell on top.

import {
    TextDocument,
    type Position,
    type Range,
} from 'vscode-languageserver-textdocument';
import type { Mapping, MappingFeatures } from './mapping.js';

/** A which-way-round selector for {@link SourceMap}'s feature queries. */
export type MapDirection = 'toGenerated' | 'toSource';

/**
 * Bidirectional mapper between a source document and its generated counterpart.
 *
 * Construct one per open `.sveltex` file (rebuilt on every debounced re-parse).
 * The mappings must be sorted by `sourceOffset`; {@link SourceMap.create}
 * enforces this so callers need not.
 */
export class SourceMap {
    /** Mappings sorted ascending by `sourceOffset`. */
    readonly #bySource: Mapping[];
    /** The same mappings sorted ascending by `generatedOffset`. */
    readonly #byGenerated: Mapping[];
    /** Text-document view of the source `.sveltex` file. */
    readonly #sourceDoc: TextDocument;
    /** Text-document view of the generated virtual `.svelte` file. */
    readonly #generatedDoc: TextDocument;

    private constructor(
        mappings: Mapping[],
        sourceText: string,
        generatedText: string,
    ) {
        this.#bySource = [...mappings].sort(
            (a, b) => a.sourceOffset - b.sourceOffset,
        );
        this.#byGenerated = [...mappings].sort(
            (a, b) => a.generatedOffset - b.generatedOffset,
        );
        // The language id is irrelevant; these documents are used only for
        // offset <-> position arithmetic.
        this.#sourceDoc = TextDocument.create(
            'mem://source',
            'sveltex',
            0,
            sourceText,
        );
        this.#generatedDoc = TextDocument.create(
            'mem://generated',
            'svelte',
            0,
            generatedText,
        );
    }

    /**
     * Builds a {@link SourceMap}.
     *
     * @param mappings - The span pairs linking the two documents. Order does
     * not matter; they are sorted internally.
     * @param sourceText - Full text of the source `.sveltex` document.
     * @param generatedText - Full text of the generated `.svelte` document.
     */
    public static create(
        mappings: Mapping[],
        sourceText: string,
        generatedText: string,
    ): SourceMap {
        return new SourceMap(mappings, sourceText, generatedText);
    }

    /** The generated virtual document's full text. */
    public get generatedText(): string {
        return this.#generatedDoc.getText();
    }

    /** The source document's full text. */
    public get sourceText(): string {
        return this.#sourceDoc.getText();
    }

    // ----- offset translation ------------------------------------------------

    /**
     * Translates a source-document offset to a generated-document offset.
     *
     * @param sourceOffset - Offset in the `.sveltex` document.
     * @returns The corresponding generated offset, or `undefined` if the offset
     * falls outside every mapped span (i.e. inside a non-delegated region).
     */
    public sourceOffsetToGenerated(sourceOffset: number): number | undefined {
        const m = findContaining(
            this.#bySource,
            sourceOffset,
            (x) => x.sourceOffset,
            (x) => x.sourceLength,
        );
        if (!m) return undefined;
        return translate(
            sourceOffset,
            m.sourceOffset,
            m.sourceLength,
            m.generatedOffset,
            m.generatedLength,
        );
    }

    /**
     * Translates a generated-document offset to a source-document offset.
     *
     * @param generatedOffset - Offset in the virtual `.svelte` document.
     * @returns The corresponding source offset, or `undefined` if the offset
     * falls outside every mapped span.
     */
    public generatedOffsetToSource(
        generatedOffset: number,
    ): number | undefined {
        const m = findContaining(
            this.#byGenerated,
            generatedOffset,
            (x) => x.generatedOffset,
            (x) => x.generatedLength,
        );
        if (!m) return undefined;
        return translate(
            generatedOffset,
            m.generatedOffset,
            m.generatedLength,
            m.sourceOffset,
            m.sourceLength,
        );
    }

    // ----- position translation ---------------------------------------------

    /**
     * Translates a source-document {@link Position} to a generated-document
     * position.
     *
     * @returns The mapped position, or `undefined` if it lies in an unmapped
     * region.
     */
    public sourcePositionToGenerated(position: Position): Position | undefined {
        const offset = this.#sourceDoc.offsetAt(position);
        const generated = this.sourceOffsetToGenerated(offset);
        if (generated === undefined) return undefined;
        return this.#generatedDoc.positionAt(generated);
    }

    /**
     * Translates a generated-document {@link Position} to a source-document
     * position.
     *
     * @returns The mapped position, or `undefined` if it lies in an unmapped
     * region.
     */
    public generatedPositionToSource(position: Position): Position | undefined {
        const offset = this.#generatedDoc.offsetAt(position);
        const source = this.generatedOffsetToSource(offset);
        if (source === undefined) return undefined;
        return this.#sourceDoc.positionAt(source);
    }

    // ----- range translation -------------------------------------------------

    /**
     * Translates a source-document {@link Range} to a generated-document range.
     *
     * @returns The mapped range, or `undefined` if either endpoint is unmapped.
     *
     * @remarks
     * A range is only translated when _both_ endpoints land in mapped spans.
     * This is the conservative choice: a half-mapped range would produce a
     * nonsensical generated range and confuse the embedded server.
     */
    public sourceRangeToGenerated(range: Range): Range | undefined {
        const start = this.sourcePositionToGenerated(range.start);
        const end = this.sourcePositionToGenerated(range.end);
        if (!start || !end) return undefined;
        return { start, end };
    }

    /**
     * Translates a generated-document {@link Range} to a source-document range.
     *
     * @returns The mapped range, or `undefined` if either endpoint is unmapped.
     */
    public generatedRangeToSource(range: Range): Range | undefined {
        const start = this.generatedPositionToSource(range.start);
        const end = this.generatedPositionToSource(range.end);
        if (!start || !end) return undefined;
        return { start, end };
    }

    // ----- feature flags -----------------------------------------------------

    /**
     * Returns the {@link MappingFeatures} governing a given offset.
     *
     * @param offset - The offset to query.
     * @param direction - `'toGenerated'` to interpret `offset` as a source
     * offset, `'toSource'` to interpret it as a generated offset.
     * @returns The feature flags, or `undefined` if the offset is unmapped.
     */
    public featuresAt(
        offset: number,
        direction: MapDirection,
    ): MappingFeatures | undefined {
        const m =
            direction === 'toGenerated'
                ? findContaining(
                      this.#bySource,
                      offset,
                      (x) => x.sourceOffset,
                      (x) => x.sourceLength,
                  )
                : findContaining(
                      this.#byGenerated,
                      offset,
                      (x) => x.generatedOffset,
                      (x) => x.generatedLength,
                  );
        return m?.features;
    }
}

/**
 * Maps a position within `[fromOffset, fromOffset + fromLength]` onto the
 * corresponding position within `[toOffset, toOffset + toLength]`.
 *
 * For the v1 identity case (`fromLength === toLength`) this is simply
 * `toOffset + (offset - fromOffset)`. When the spans differ in length the
 * offset is clamped to the destination span — a defensive measure for future
 * non-affine mappings; it never triggers in v1.
 */
function translate(
    offset: number,
    fromOffset: number,
    fromLength: number,
    toOffset: number,
    toLength: number,
): number {
    const delta = offset - fromOffset;
    if (delta <= 0) return toOffset;
    if (delta >= fromLength) return toOffset + toLength;
    if (fromLength === toLength) return toOffset + delta;
    return toOffset + Math.min(delta, toLength);
}

/**
 * Binary-searches a list of mappings (sorted by the offset accessor) for the
 * mapping whose span contains `offset`.
 *
 * The span is treated as the half-open interval `[start, start + length)`, with
 * one exception: a zero-length probe at `start + length` (the very end of a
 * span) also matches, so that a caret positioned immediately after the last
 * character of a mapped region still maps. This matches how editors place the
 * cursor at end-of-token.
 *
 * @param sorted - Mappings sorted ascending by `getStart`.
 * @param offset - The offset to locate.
 * @param getStart - Accessor for a mapping's span start.
 * @param getLength - Accessor for a mapping's span length.
 * @returns The containing mapping, or `undefined`.
 */
function findContaining(
    sorted: Mapping[],
    offset: number,
    getStart: (m: Mapping) => number,
    getLength: (m: Mapping) => number,
): Mapping | undefined {
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const m = sorted[mid];
        if (!m) break;
        const start = getStart(m);
        const end = start + getLength(m);
        if (offset < start) {
            hi = mid - 1;
        } else if (offset > end) {
            lo = mid + 1;
        } else if (offset === end && offset !== start) {
            // `offset` is exactly at this span's end. Prefer the next span if
            // it starts here (so an interior boundary maps into the right-hand
            // region); otherwise accept this span (true end of document).
            const next = sorted[mid + 1];
            if (next && getStart(next) === offset) {
                lo = mid + 1;
            } else {
                return m;
            }
        } else {
            return m;
        }
    }
    return undefined;
}
