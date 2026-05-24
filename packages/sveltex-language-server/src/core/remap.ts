// File description: Pure helpers that rewrite the position-bearing parts of LSP
// payloads between source (`.sveltex`) and generated (`.svelte`) coordinates.
//
// The host server holds, per open file, exactly one virtual `.svelte` document
// (see `virtual-svelte.ts`). Translating a request therefore means: rewrite the
// source URI to the virtual URI and map the request position source -> generated;
// translating a response means the reverse, plus dropping anything that maps
// into a non-delegated (unmapped) region.

import type {
    CodeAction,
    Command,
    CompletionItem,
    CompletionList,
    Definition,
    DefinitionLink,
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
import type { SourceMap } from './mapper.js';

/**
 * Bundles the two URIs and the source map for one open `.sveltex` file, so the
 * remapping helpers have everything they need in a single argument.
 */
export interface RemapContext {
    /** The real `.sveltex` document URI as seen by the editor. */
    sourceUri: string;
    /** The synthetic `<source>.svelte` URI handed to the embedded server. */
    virtualUri: string;
    /** Bidirectional mapper between the two documents. */
    sourceMap: SourceMap;
}

/**
 * Derives the virtual `.svelte` URI for a given `.sveltex` source URI.
 *
 * Appending `.svelte` (rather than replacing the extension) keeps the original
 * name recoverable and makes the embedded TypeScript service treat the file as
 * Svelte.
 */
export function toVirtualUri(sourceUri: string): string {
    return `${sourceUri}.svelte`;
}

/** Inverse of {@link toVirtualUri}. */
export function toSourceUri(virtualUri: string): string {
    return virtualUri.endsWith('.svelte')
        ? virtualUri.slice(0, -'.svelte'.length)
        : virtualUri;
}

/**
 * Rewrites a `Location` from generated to source coordinates.
 *
 * @returns The remapped location, or `undefined` if it does not belong to this
 * document's virtual file or maps into an unmapped region.
 */
function remapLocation(
    location: Location,
    ctx: RemapContext,
): Location | undefined {
    if (location.uri !== ctx.virtualUri) {
        // A location in some other file (e.g. a `node_modules` `.d.ts`) needs
        // no mapping — pass it through untouched.
        return location;
    }
    const range = ctx.sourceMap.generatedRangeToSource(location.range);
    if (!range) return undefined;
    return { uri: ctx.sourceUri, range };
}

/**
 * Rewrites a `LocationLink` from generated to source coordinates.
 */
function remapLocationLink(
    link: LocationLink,
    ctx: RemapContext,
): LocationLink | undefined {
    if (link.targetUri !== ctx.virtualUri) return link;
    const targetRange = ctx.sourceMap.generatedRangeToSource(link.targetRange);
    const targetSelectionRange = ctx.sourceMap.generatedRangeToSource(
        link.targetSelectionRange,
    );
    if (!targetRange || !targetSelectionRange) return undefined;
    const originSelectionRange = link.originSelectionRange
        ? ctx.sourceMap.generatedRangeToSource(link.originSelectionRange)
        : undefined;
    return {
        ...link,
        targetUri: ctx.sourceUri,
        targetRange,
        targetSelectionRange,
        ...(originSelectionRange ? { originSelectionRange } : {}),
    };
}

/**
 * Remaps the result of a definition / declaration / type-definition /
 * implementation request.
 */
export function remapDefinition(
    result: Definition | DefinitionLink[] | null | undefined,
    ctx: RemapContext,
): Definition | DefinitionLink[] | null {
    if (!result) return null;
    if (Array.isArray(result)) {
        // Either `Location[]` or `LocationLink[]`; both are handled per-item.
        const out = result
            .map((item) =>
                'targetUri' in item
                    ? remapLocationLink(item, ctx)
                    : remapLocation(item, ctx),
            )
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
        return out as Definition | DefinitionLink[];
    }
    return remapLocation(result, ctx) ?? null;
}

/**
 * Remaps the result of a find-references request.
 */
export function remapReferences(
    result: Location[] | null | undefined,
    ctx: RemapContext,
): Location[] | null {
    if (!result) return null;
    return result
        .map((loc) => remapLocation(loc, ctx))
        .filter((loc): loc is Location => Boolean(loc));
}

/**
 * Remaps the result of a document-highlight request. Highlights always refer to
 * the requested document, so any highlight that fails to map is dropped.
 */
export function remapHighlights(
    result: DocumentHighlight[] | null | undefined,
    ctx: RemapContext,
): DocumentHighlight[] | null {
    if (!result) return null;
    return result
        .map((highlight) => {
            const range = ctx.sourceMap.generatedRangeToSource(highlight.range);
            if (!range) return undefined;
            return { ...highlight, range };
        })
        .filter((h): h is DocumentHighlight => Boolean(h));
}

/**
 * Remaps a hover result. The optional `range` is mapped; if it fails to map the
 * hover is dropped entirely (its contents describe code that, from the user's
 * point of view, is not at the hovered spot).
 */
export function remapHover(
    result: Hover | null | undefined,
    ctx: RemapContext,
): Hover | null {
    if (!result) return null;
    if (!result.range) return result;
    const range = ctx.sourceMap.generatedRangeToSource(result.range);
    if (!range) return null;
    return { ...result, range };
}

/**
 * Remaps an array of `TextEdit`s, dropping edits whose range does not map.
 */
function remapTextEdits(edits: TextEdit[], ctx: RemapContext): TextEdit[] {
    return edits
        .map((edit) => {
            const range = ctx.sourceMap.generatedRangeToSource(edit.range);
            if (!range) return undefined;
            return { ...edit, range };
        })
        .filter((edit): edit is TextEdit => Boolean(edit));
}

/**
 * Remaps a single completion item: its `textEdit` and `additionalTextEdits`
 * carry ranges in generated coordinates.
 *
 * @returns The remapped item, or `undefined` if its primary `textEdit` range
 * cannot be mapped (applying it would corrupt the source document).
 */
function remapCompletionItem(
    item: CompletionItem,
    ctx: RemapContext,
): CompletionItem | undefined {
    const next: CompletionItem = { ...item };
    if (item.textEdit) {
        if ('range' in item.textEdit) {
            const range = ctx.sourceMap.generatedRangeToSource(
                item.textEdit.range,
            );
            if (!range) return undefined;
            next.textEdit = { ...item.textEdit, range };
        } else {
            // `InsertReplaceEdit`: map both ranges.
            const insert = ctx.sourceMap.generatedRangeToSource(
                item.textEdit.insert,
            );
            const replace = ctx.sourceMap.generatedRangeToSource(
                item.textEdit.replace,
            );
            if (!insert || !replace) return undefined;
            next.textEdit = { ...item.textEdit, insert, replace };
        }
    }
    if (item.additionalTextEdits) {
        next.additionalTextEdits = remapTextEdits(
            item.additionalTextEdits,
            ctx,
        );
    }
    return next;
}

/**
 * Remaps a completion result (either a bare item array or a `CompletionList`).
 */
export function remapCompletion(
    result: CompletionItem[] | CompletionList | null | undefined,
    ctx: RemapContext,
): CompletionItem[] | CompletionList | null {
    if (!result) return null;
    const items = Array.isArray(result) ? result : result.items;
    const remapped = items
        .map((item) => remapCompletionItem(item, ctx))
        .filter((item): item is CompletionItem => Boolean(item));
    if (Array.isArray(result)) return remapped;
    return { ...result, items: remapped };
}

/**
 * Remaps a `WorkspaceEdit` (the result of a rename). Only the `changes` keyed
 * by the virtual URI are rewritten; edits to other files pass through.
 *
 * @remarks
 * `documentChanges` (the versioned form) is intentionally _not_ remapped in
 * v1: `svelte-language-server`'s rename returns the `changes` form, and
 * versioned edits would also require tracking the source document's version.
 *
 * TODO: support `documentChanges` once incremental virtual updates land.
 */
export function remapWorkspaceEdit(
    result: WorkspaceEdit | null | undefined,
    ctx: RemapContext,
): WorkspaceEdit | null {
    if (!result) return null;
    if (!result.changes) return result;
    const changes: Record<string, TextEdit[]> = {};
    for (const [uri, edits] of Object.entries(result.changes)) {
        if (uri === ctx.virtualUri) {
            changes[ctx.sourceUri] = remapTextEdits(edits, ctx);
        } else {
            changes[uri] = edits;
        }
    }
    return { ...result, changes };
}

/**
 * Remaps a code-action result. Each action may carry an inline `WorkspaceEdit`
 * and a list of `diagnostics`; both are rewritten. Bare `Command`s have no
 * positions and pass through unchanged.
 */
export function remapCodeActions(
    result: (Command | CodeAction)[] | null | undefined,
    ctx: RemapContext,
): (Command | CodeAction)[] | null {
    if (!result) return null;
    return result.map((entry) => {
        // `CodeAction` carries `edit` / `diagnostics`; a bare `Command` has
        // neither. Probing for those keys narrows `entry` to `CodeAction`
        // without a cast (a `Command` is returned unchanged — it has no
        // positions).
        if (!('edit' in entry) && !('diagnostics' in entry)) {
            return entry;
        }
        const action = entry;
        const next: CodeAction = { ...action };
        if (action.edit) {
            /* v8 ignore next -- the `?? action.edit` fallback is unreachable:
               `remapWorkspaceEdit` only returns null for a falsy input, but
               `action.edit` is truthy inside this guard. */
            next.edit = remapWorkspaceEdit(action.edit, ctx) ?? action.edit;
        }
        if (action.diagnostics) {
            next.diagnostics = action.diagnostics
                .map((diag) => {
                    const range = ctx.sourceMap.generatedRangeToSource(
                        diag.range,
                    );
                    if (!range) return undefined;
                    return { ...diag, range };
                })
                .filter((d): d is NonNullable<typeof d> => Boolean(d));
        }
        return next;
    });
}

/**
 * Remaps a signature-help result. `SignatureHelp` carries no document ranges,
 * so it is returned unchanged; the function exists to keep the proxy call sites
 * uniform and to provide an obvious hook should a future LSP version add
 * positional data.
 */
export function remapSignatureHelp(
    result: SignatureHelp | null | undefined,
): SignatureHelp | null {
    return result ?? null;
}

/**
 * Remaps document links: each link's `range` is in generated coordinates.
 */
export function remapDocumentLinks(
    result: DocumentLink[] | null | undefined,
    ctx: RemapContext,
): DocumentLink[] | null {
    if (!result) return null;
    return result
        .map((link) => {
            const range = ctx.sourceMap.generatedRangeToSource(link.range);
            if (!range) return undefined;
            return { ...link, range };
        })
        .filter((link): link is DocumentLink => Boolean(link));
}

/**
 * Maps a `Range` from source to generated coordinates, for request payloads
 * (e.g. the `range` of a code-action request).
 *
 * @returns The generated range, or `undefined` if it is not fully mapped.
 */
export function sourceRangeToGenerated(
    range: Range,
    ctx: RemapContext,
): Range | undefined {
    return ctx.sourceMap.sourceRangeToGenerated(range);
}
