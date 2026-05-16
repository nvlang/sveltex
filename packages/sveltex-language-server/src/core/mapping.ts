// File description: The `Mapping` data model — a single offset-triple linking a
// span of the source `.sveltex` document to a span of the generated virtual
// `.svelte` document.
//
// This is a deliberate, trimmed-down adaptation of Volar's `CodeMapping`
// representation (`sourceOffsets[]` / `generatedOffsets[]` / `lengths[]` plus
// per-region `CodeInformation` feature flags). We do NOT depend on Volar — the
// architecture brief is explicit that Volar cannot host the real
// `svelte-language-server` — we only borrow its proven data shape.

/**
 * Per-mapping feature flags, mirroring Volar's `CodeInformation`.
 *
 * Every flag defaults to `true` when the mapping is created via
 * {@link identityMapping}. They exist so that later phases can, for example,
 * keep a region navigable (go-to-definition) while suppressing diagnostics in
 * it, without changing the mapping geometry.
 */
export interface MappingFeatures {
    /** Whether diagnostics inside this mapping should surface to the user. */
    diagnostics: boolean;
    /** Whether hover / signature-help requests are answered here. */
    verification: boolean;
    /** Whether completion is offered here. */
    completion: boolean;
    /** Whether semantic-token / highlight requests are answered here. */
    semantic: boolean;
    /** Whether go-to-definition / references / rename are answered here. */
    navigation: boolean;
}

/**
 * Links one contiguous span of the source document to one contiguous span of
 * the generated document.
 *
 * Unlike Volar's `CodeMapping` (which packs several spans into parallel
 * arrays), each `Mapping` here describes exactly one span pair. The arrays live
 * one level up, in the {@link SourceMap}. Keeping one span per object makes the
 * binary searches in {@link SourceMap} trivial to reason about and test.
 *
 * @remarks
 * In v1 every delegated region is copied byte-for-byte, so `sourceLength` and
 * `generatedLength` are always equal and the mapping is affine with slope 1.
 * The fields are kept independent regardless, so that a future phase which
 * expands Markdown to HTML (changing lengths) needs no API change here.
 */
export interface Mapping {
    /** Offset of the span in the source `.sveltex` document. */
    sourceOffset: number;
    /** Length of the span in the source document. */
    sourceLength: number;
    /** Offset of the span in the generated `.svelte` document. */
    generatedOffset: number;
    /** Length of the span in the generated document. */
    generatedLength: number;
    /** Feature flags for content inside this span. */
    features: MappingFeatures;
}

/** Returns a {@link MappingFeatures} object with every feature enabled. */
export function allFeatures(): MappingFeatures {
    return {
        diagnostics: true,
        verification: true,
        completion: true,
        semantic: true,
        navigation: true,
    };
}

/**
 * Builds an identity {@link Mapping}: a span that occupies the same length in
 * both documents (the v1 case for every delegated region).
 *
 * @param sourceOffset - Start of the span in the source document.
 * @param generatedOffset - Start of the span in the generated document.
 * @param length - Length of the span (identical in both documents).
 * @param features - Feature flags; defaults to all-enabled.
 */
export function identityMapping(
    sourceOffset: number,
    generatedOffset: number,
    length: number,
    features: MappingFeatures = allFeatures(),
): Mapping {
    return {
        sourceOffset,
        sourceLength: length,
        generatedOffset,
        generatedLength: length,
        features,
    };
}
