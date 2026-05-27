// Unit tests for the LSP-payload remapping helpers (`src/core/remap.ts`):
// rewriting the position-bearing parts of responses from generated (`.svelte`)
// to source (`.sveltex`) coordinates (and request ranges the other way),
// passing through anything that belongs to a different file, and dropping
// anything that maps into a non-delegated (unmapped/blanked) region.

import { describe, expect, it } from 'vitest';
import type {
    CodeAction,
    Command,
    CompletionItem,
    CompletionList,
    DocumentHighlight,
    DocumentLink,
    Hover,
    Location,
    LocationLink,
    Range,
    SignatureHelp,
    TextEdit,
    WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { identityMapping } from '../../src/core/mapping.js';
import { SourceMap } from '../../src/core/mapper.js';
import {
    remapCodeActions,
    remapCompletion,
    remapDefinition,
    remapDocumentLinks,
    remapHighlights,
    remapHover,
    remapReferences,
    remapSignatureHelp,
    remapWorkspaceEdit,
    sourceRangeToGenerated,
    toSourceUri,
    toVirtualUri,
    type RemapContext,
} from '../../src/core/remap.js';

// A single-line document of equal length on both sides. Generated `[0, 5)`
// maps identity-wise onto source `[0, 5)`; offsets at and after 5 are unmapped
// (a stand-in for a blanked non-delegated region), so anything touching them is
// dropped.
const SOURCE_TEXT = 'aaaaa-----';
const GENERATED_TEXT = 'aaaaa-----';
const SOURCE_URI = 'file:///doc.sveltex';
const VIRTUAL_URI = 'file:///doc.sveltex.svelte';
const OTHER_URI = 'file:///node_modules/foo/index.d.ts';

/** A source map whose only mapped span is generated `[0, 5)` ↔ source `[0, 5)`. */
function partialMap(): SourceMap {
    return SourceMap.create(
        [identityMapping(0, 0, 5)],
        SOURCE_TEXT,
        GENERATED_TEXT,
    );
}

function ctx(): RemapContext {
    return {
        sourceUri: SOURCE_URI,
        virtualUri: VIRTUAL_URI,
        sourceMap: partialMap(),
    };
}

/** A range on line 0 spanning `[startChar, endChar)`. */
function range(startChar: number, endChar: number): Range {
    return {
        start: { line: 0, character: startChar },
        end: { line: 0, character: endChar },
    };
}

/** A range fully inside the mapped span. */
const MAPPED = range(0, 4);
/** A range fully inside the blanked (unmapped) span. */
const UNMAPPED = range(6, 9);

describe('toVirtualUri / toSourceUri', () => {
    it('appends `.svelte` to derive the virtual URI', () => {
        expect(toVirtualUri(SOURCE_URI)).toBe(VIRTUAL_URI);
    });

    it('strips a trailing `.svelte` to recover the source URI', () => {
        expect(toSourceUri(VIRTUAL_URI)).toBe(SOURCE_URI);
    });

    it('returns a non-`.svelte` URI unchanged', () => {
        expect(toSourceUri(OTHER_URI)).toBe(OTHER_URI);
    });

    it('round-trips', () => {
        expect(toSourceUri(toVirtualUri(SOURCE_URI))).toBe(SOURCE_URI);
    });
});

describe('remapDefinition', () => {
    it('returns null for a falsy result', () => {
        expect(remapDefinition(null, ctx())).toBeNull();
        expect(remapDefinition(undefined, ctx())).toBeNull();
    });

    it('remaps a single Location in the virtual file', () => {
        const loc: Location = { uri: VIRTUAL_URI, range: MAPPED };
        const out = remapDefinition(loc, ctx());
        expect(out).toEqual({ uri: SOURCE_URI, range: MAPPED });
    });

    it('returns null for a single Location that fails to map', () => {
        const loc: Location = { uri: VIRTUAL_URI, range: UNMAPPED };
        expect(remapDefinition(loc, ctx())).toBeNull();
    });

    it('passes a single Location in another file through unchanged', () => {
        const loc: Location = { uri: OTHER_URI, range: MAPPED };
        expect(remapDefinition(loc, ctx())).toEqual(loc);
    });

    it('remaps an array of Locations, dropping unmapped ones', () => {
        const result: Location[] = [
            { uri: VIRTUAL_URI, range: MAPPED }, // maps
            { uri: VIRTUAL_URI, range: UNMAPPED }, // dropped
            { uri: OTHER_URI, range: MAPPED }, // passes through
        ];
        const out = remapDefinition(result, ctx());
        expect(out).toEqual([
            { uri: SOURCE_URI, range: MAPPED },
            { uri: OTHER_URI, range: MAPPED },
        ]);
    });

    it('remaps an array of LocationLinks', () => {
        const link: LocationLink = {
            targetUri: VIRTUAL_URI,
            targetRange: MAPPED,
            targetSelectionRange: MAPPED,
            originSelectionRange: range(1, 3),
        };
        const out = remapDefinition([link], ctx());
        expect(out).toEqual([
            {
                targetUri: SOURCE_URI,
                targetRange: MAPPED,
                targetSelectionRange: MAPPED,
                originSelectionRange: range(1, 3),
            },
        ]);
    });

    it('remaps a LocationLink without an originSelectionRange', () => {
        const link: LocationLink = {
            targetUri: VIRTUAL_URI,
            targetRange: MAPPED,
            targetSelectionRange: MAPPED,
        };
        const out = remapDefinition([link], ctx());
        expect(out).toEqual([
            {
                targetUri: SOURCE_URI,
                targetRange: MAPPED,
                targetSelectionRange: MAPPED,
            },
        ]);
    });

    it('passes a LocationLink in another file through unchanged', () => {
        const link: LocationLink = {
            targetUri: OTHER_URI,
            targetRange: MAPPED,
            targetSelectionRange: MAPPED,
        };
        expect(remapDefinition([link], ctx())).toEqual([link]);
    });

    it('drops a LocationLink whose targetRange does not map', () => {
        const link: LocationLink = {
            targetUri: VIRTUAL_URI,
            targetRange: UNMAPPED,
            targetSelectionRange: MAPPED,
        };
        expect(remapDefinition([link], ctx())).toEqual([]);
    });

    it('drops a LocationLink whose targetSelectionRange does not map', () => {
        const link: LocationLink = {
            targetUri: VIRTUAL_URI,
            targetRange: MAPPED,
            targetSelectionRange: UNMAPPED,
        };
        expect(remapDefinition([link], ctx())).toEqual([]);
    });

    it('drops the originSelectionRange when it fails to map', () => {
        // When `originSelectionRange` does not map, it must be dropped — never
        // leaked through in generated (virtual-document) coordinates. The link
        // itself is still produced (its target ranges mapped fine).
        const link: LocationLink = {
            targetUri: VIRTUAL_URI,
            targetRange: MAPPED,
            targetSelectionRange: MAPPED,
            originSelectionRange: UNMAPPED, // does not map
        };
        const out = remapDefinition([link], ctx());
        expect(out).toEqual([
            {
                targetUri: SOURCE_URI,
                targetRange: MAPPED,
                targetSelectionRange: MAPPED,
                // originSelectionRange dropped — not carried over.
            },
        ]);
    });
});

describe('remapReferences', () => {
    it('returns null for a falsy result', () => {
        expect(remapReferences(null, ctx())).toBeNull();
        expect(remapReferences(undefined, ctx())).toBeNull();
    });

    it('remaps references and drops unmapped ones', () => {
        const result: Location[] = [
            { uri: VIRTUAL_URI, range: MAPPED },
            { uri: VIRTUAL_URI, range: UNMAPPED },
        ];
        expect(remapReferences(result, ctx())).toEqual([
            { uri: SOURCE_URI, range: MAPPED },
        ]);
    });
});

describe('remapHighlights', () => {
    it('returns null for a falsy result', () => {
        expect(remapHighlights(null, ctx())).toBeNull();
        expect(remapHighlights(undefined, ctx())).toBeNull();
    });

    it('remaps highlights and drops unmapped ones', () => {
        const result: DocumentHighlight[] = [
            { range: MAPPED, kind: 1 },
            { range: UNMAPPED, kind: 2 },
        ];
        expect(remapHighlights(result, ctx())).toEqual([
            { range: MAPPED, kind: 1 },
        ]);
    });
});

describe('remapHover', () => {
    it('returns null for a falsy result', () => {
        expect(remapHover(null, ctx())).toBeNull();
        expect(remapHover(undefined, ctx())).toBeNull();
    });

    it('returns a rangeless hover unchanged', () => {
        const hover: Hover = { contents: 'docs' };
        expect(remapHover(hover, ctx())).toEqual(hover);
    });

    it('remaps a hover range', () => {
        const hover: Hover = { contents: 'docs', range: MAPPED };
        expect(remapHover(hover, ctx())).toEqual({
            contents: 'docs',
            range: MAPPED,
        });
    });

    it('drops a hover whose range fails to map', () => {
        const hover: Hover = { contents: 'docs', range: UNMAPPED };
        expect(remapHover(hover, ctx())).toBeNull();
    });
});

describe('remapCompletion', () => {
    it('returns null for a falsy result', () => {
        expect(remapCompletion(null, ctx())).toBeNull();
        expect(remapCompletion(undefined, ctx())).toBeNull();
    });

    it('remaps a bare item array with a textEdit (TextEdit form)', () => {
        const items: CompletionItem[] = [
            { label: 'foo', textEdit: { range: MAPPED, newText: 'foo' } },
        ];
        const out = remapCompletion(items, ctx());
        expect(out).toEqual([
            { label: 'foo', textEdit: { range: MAPPED, newText: 'foo' } },
        ]);
    });

    it('keeps an item with no textEdit untouched', () => {
        const items: CompletionItem[] = [{ label: 'bar' }];
        expect(remapCompletion(items, ctx())).toEqual([{ label: 'bar' }]);
    });

    it('drops an item whose TextEdit range fails to map', () => {
        const items: CompletionItem[] = [
            { label: 'foo', textEdit: { range: UNMAPPED, newText: 'foo' } },
        ];
        expect(remapCompletion(items, ctx())).toEqual([]);
    });

    it('remaps an InsertReplaceEdit (both ranges)', () => {
        const items: CompletionItem[] = [
            {
                label: 'foo',
                textEdit: {
                    newText: 'foo',
                    insert: range(0, 2),
                    replace: range(0, 4),
                },
            },
        ];
        expect(remapCompletion(items, ctx())).toEqual([
            {
                label: 'foo',
                textEdit: {
                    newText: 'foo',
                    insert: range(0, 2),
                    replace: range(0, 4),
                },
            },
        ]);
    });

    it('drops an InsertReplaceEdit whose insert range fails to map', () => {
        const items: CompletionItem[] = [
            {
                label: 'foo',
                textEdit: {
                    newText: 'foo',
                    insert: UNMAPPED,
                    replace: range(0, 4),
                },
            },
        ];
        expect(remapCompletion(items, ctx())).toEqual([]);
    });

    it('drops an InsertReplaceEdit whose replace range fails to map', () => {
        const items: CompletionItem[] = [
            {
                label: 'foo',
                textEdit: {
                    newText: 'foo',
                    insert: range(0, 2),
                    replace: UNMAPPED,
                },
            },
        ];
        expect(remapCompletion(items, ctx())).toEqual([]);
    });

    it('remaps additionalTextEdits, dropping unmapped ones', () => {
        const items: CompletionItem[] = [
            {
                label: 'foo',
                additionalTextEdits: [
                    { range: MAPPED, newText: 'x' },
                    { range: UNMAPPED, newText: 'y' },
                ],
            },
        ];
        expect(remapCompletion(items, ctx())).toEqual([
            {
                label: 'foo',
                additionalTextEdits: [{ range: MAPPED, newText: 'x' }],
            },
        ]);
    });

    it('remaps a CompletionList, preserving isIncomplete', () => {
        const list: CompletionList = {
            isIncomplete: true,
            items: [
                { label: 'foo', textEdit: { range: MAPPED, newText: 'foo' } },
                { label: 'bad', textEdit: { range: UNMAPPED, newText: 'bad' } },
            ],
        };
        const out = remapCompletion(list, ctx());
        expect(out).toEqual({
            isIncomplete: true,
            items: [
                { label: 'foo', textEdit: { range: MAPPED, newText: 'foo' } },
            ],
        });
    });
});

describe('remapWorkspaceEdit', () => {
    it('returns null for a falsy result', () => {
        expect(remapWorkspaceEdit(null, ctx())).toBeNull();
        expect(remapWorkspaceEdit(undefined, ctx())).toBeNull();
    });

    it('returns an edit with no `changes` unchanged', () => {
        const edit: WorkspaceEdit = {
            documentChanges: [],
        };
        expect(remapWorkspaceEdit(edit, ctx())).toEqual(edit);
    });

    it('rewrites virtual-file changes to the source URI and passes others through', () => {
        const virtualEdits: TextEdit[] = [
            { range: MAPPED, newText: 'a' },
            { range: UNMAPPED, newText: 'b' }, // dropped
        ];
        const otherEdits: TextEdit[] = [{ range: MAPPED, newText: 'c' }];
        const edit: WorkspaceEdit = {
            changes: {
                [VIRTUAL_URI]: virtualEdits,
                [OTHER_URI]: otherEdits,
            },
        };
        const out = remapWorkspaceEdit(edit, ctx());
        expect(out).toEqual({
            changes: {
                [SOURCE_URI]: [{ range: MAPPED, newText: 'a' }],
                [OTHER_URI]: otherEdits,
            },
        });
    });
});

describe('remapCodeActions', () => {
    it('returns null for a falsy result', () => {
        expect(remapCodeActions(null, ctx())).toBeNull();
        expect(remapCodeActions(undefined, ctx())).toBeNull();
    });

    it('passes a bare Command through unchanged', () => {
        const command: Command = { title: 'Do it', command: 'do.it' };
        expect(remapCodeActions([command], ctx())).toEqual([command]);
    });

    it('remaps a CodeAction with an inline edit and diagnostics', () => {
        const action: CodeAction = {
            title: 'Fix',
            edit: {
                changes: {
                    [VIRTUAL_URI]: [{ range: MAPPED, newText: 'z' }],
                },
            },
            diagnostics: [
                { range: MAPPED, message: 'keep' },
                { range: UNMAPPED, message: 'drop' },
            ],
        };
        const out = remapCodeActions([action], ctx());
        expect(out).toEqual([
            {
                title: 'Fix',
                edit: {
                    changes: {
                        [SOURCE_URI]: [{ range: MAPPED, newText: 'z' }],
                    },
                },
                diagnostics: [{ range: MAPPED, message: 'keep' }],
            },
        ]);
    });

    it('treats an entry with `diagnostics` but no `edit` as a CodeAction', () => {
        // The `diagnostics` key alone narrows the entry to a CodeAction, so the
        // absent-`edit` (`if (action.edit)` false) path is exercised.
        const action: CodeAction = {
            title: 'Note',
            diagnostics: [{ range: MAPPED, message: 'm' }],
        };
        const out = remapCodeActions([action], ctx());
        expect(out).toEqual([
            {
                title: 'Note',
                diagnostics: [{ range: MAPPED, message: 'm' }],
            },
        ]);
    });

    it('keeps a CodeAction edit while leaving diagnostics absent', () => {
        // The `edit` key narrows to a CodeAction; `if (action.diagnostics)` is
        // false, exercising the no-diagnostics path.
        const action: CodeAction = {
            title: 'Edit only',
            edit: { changes: { [VIRTUAL_URI]: [{ range: MAPPED, newText: 'q' }] } },
        };
        const out = remapCodeActions([action], ctx());
        expect(out).toEqual([
            {
                title: 'Edit only',
                edit: { changes: { [SOURCE_URI]: [{ range: MAPPED, newText: 'q' }] } },
            },
        ]);
    });
});

describe('remapSignatureHelp', () => {
    it('returns the signature help unchanged', () => {
        const help: SignatureHelp = {
            signatures: [{ label: 'fn()' }],
            activeSignature: 0,
            activeParameter: 0,
        };
        expect(remapSignatureHelp(help)).toEqual(help);
    });

    it('returns null for a falsy result', () => {
        expect(remapSignatureHelp(null)).toBeNull();
        expect(remapSignatureHelp(undefined)).toBeNull();
    });
});

describe('remapDocumentLinks', () => {
    it('returns null for a falsy result', () => {
        expect(remapDocumentLinks(null, ctx())).toBeNull();
        expect(remapDocumentLinks(undefined, ctx())).toBeNull();
    });

    it('remaps links and drops unmapped ones', () => {
        const result: DocumentLink[] = [
            { range: MAPPED, target: 'https://a' },
            { range: UNMAPPED, target: 'https://b' },
        ];
        expect(remapDocumentLinks(result, ctx())).toEqual([
            { range: MAPPED, target: 'https://a' },
        ]);
    });
});

describe('sourceRangeToGenerated', () => {
    it('maps a source range to generated coordinates', () => {
        expect(sourceRangeToGenerated(MAPPED, ctx())).toEqual(MAPPED);
    });

    it('returns undefined for a source range that is not fully mapped', () => {
        expect(sourceRangeToGenerated(UNMAPPED, ctx())).toBeUndefined();
    });
});
