// Unit tests for diagnostic mapping/merging (`src/core/diagnostics.ts`):
// remapping a batch of child-server diagnostics from generated to source
// coordinates, dropping those that fall in a non-delegated (unmapped) region,
// carrying through `relatedInformation` (mapping what maps, dropping what does
// not), and the trivial concatenation of proxied with native diagnostics.

import { describe, expect, it } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver-protocol';
import {
    mapProxiedDiagnostics,
    mergeDiagnostics,
} from '../../src/core/diagnostics.js';
import { identityMapping } from '../../src/core/mapping.js';
import { SourceMap } from '../../src/core/mapper.js';

// A single-line source and a single-line generated document of equal length.
// The first 5 generated chars (`[0, 5)`) map identity-wise onto source `[0, 5)`;
// generated chars at and after offset 5 are unmapped (a stand-in for a blanked
// non-delegated region), so any diagnostic touching them is dropped.
const SOURCE_TEXT = 'aaaaa-----';
const GENERATED_TEXT = 'aaaaa-----';

/** A source map whose only mapped span is generated `[0, 5)` ↔ source `[0, 5)`. */
function partialMap(): SourceMap {
    return SourceMap.create(
        [identityMapping(0, 0, 5)],
        SOURCE_TEXT,
        GENERATED_TEXT,
    );
}

/** A range on line 0 spanning `[startChar, endChar)`. */
function range(startChar: number, endChar: number) {
    return {
        start: { line: 0, character: startChar },
        end: { line: 0, character: endChar },
    };
}

describe('mapProxiedDiagnostics', () => {
    it('keeps a diagnostic whose range maps and rewrites its range', () => {
        const diag: Diagnostic = {
            range: range(0, 4),
            message: 'in the mapped span',
        };
        const mapped = mapProxiedDiagnostics([diag], partialMap());
        expect(mapped).toHaveLength(1);
        expect(mapped[0]?.range).toEqual(range(0, 4));
        expect(mapped[0]?.message).toBe('in the mapped span');
    });

    it('drops a diagnostic whose range falls in an unmapped region', () => {
        const diag: Diagnostic = {
            // `[6, 9)` is entirely inside the blanked span — does not map.
            range: range(6, 9),
            message: 'in the blanked region',
        };
        expect(mapProxiedDiagnostics([diag], partialMap())).toEqual([]);
    });

    it('maps related-information ranges that map and drops those that do not', () => {
        const diag: Diagnostic = {
            range: range(0, 3),
            message: 'primary',
            relatedInformation: [
                {
                    location: { uri: 'mem://x', range: range(1, 4) },
                    message: 'related, maps',
                },
                {
                    location: { uri: 'mem://x', range: range(6, 9) },
                    message: 'related, unmapped',
                },
            ],
        };
        const mapped = mapProxiedDiagnostics([diag], partialMap());
        expect(mapped).toHaveLength(1);
        const related = mapped[0]?.relatedInformation;
        // Only the mappable related entry survives.
        expect(related).toHaveLength(1);
        expect(related?.[0]?.message).toBe('related, maps');
        expect(related?.[0]?.location.range).toEqual(range(1, 4));
    });

    it('does not add a remapped relatedInformation when every entry is unmapped', () => {
        const original = [
            {
                location: { uri: 'mem://x', range: range(6, 9) },
                message: 'unmapped only',
            },
        ];
        const diag: Diagnostic = {
            range: range(0, 3),
            message: 'primary',
            relatedInformation: original,
        };
        const mapped = mapProxiedDiagnostics([diag], partialMap());
        expect(mapped).toHaveLength(1);
        // The filtered related list is empty, so the conditional spread adds
        // nothing — the spread of the original diagnostic carries its original
        // `relatedInformation` through unchanged (the empty-related branch).
        expect(mapped[0]?.relatedInformation).toBe(original);
    });

    it('leaves a diagnostic without relatedInformation untouched', () => {
        const diag: Diagnostic = {
            range: range(0, 2),
            message: 'no related info',
            severity: 1,
        };
        const mapped = mapProxiedDiagnostics([diag], partialMap());
        expect(mapped).toHaveLength(1);
        expect(mapped[0]?.relatedInformation).toBeUndefined();
        // Unrelated fields are preserved.
        expect(mapped[0]?.severity).toBe(1);
    });
});

describe('mergeDiagnostics', () => {
    it('concatenates proxied and native diagnostics in order', () => {
        const proxied: Diagnostic[] = [
            { range: range(0, 1), message: 'proxied' },
        ];
        const native: Diagnostic[] = [
            { range: range(2, 3), message: 'native' },
        ];
        expect(mergeDiagnostics(proxied, native)).toEqual([
            ...proxied,
            ...native,
        ]);
    });

    it('handles empty inputs', () => {
        expect(mergeDiagnostics([], [])).toEqual([]);
    });
});
