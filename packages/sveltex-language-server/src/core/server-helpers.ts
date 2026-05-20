// File description: Pure module-level helpers and shared types pulled out of
// `server.ts`. None of these close over per-connection state, so they have
// no business living inside the `createServer` factory — and keeping them
// here makes that factory shorter and easier to read.
//
// Three groupings, in order:
//   1. State shapes used by `createServer` (`OpenDocument`,
//      `DEFAULT_SVELTEX_EXTENSION`).
//   2. Request-pipeline helpers (`pickDefined`, `withoutPullDiagnostics`,
//      the `markNativeCompletion` / `isNativeCompletionItem` pair).
//   3. `initialize`-time helpers (`workspaceRootOf`, `uriToPath`,
//      `ResolvedServerPaths`, `readServerPaths`).

import { URI } from 'vscode-uri';
import type {
    ClientCapabilities,
    CompletionItem,
    CompletionList,
    InitializeParams,
    TextDocumentClientCapabilities,
} from 'vscode-languageserver-protocol';
import type { Region } from './regions.js';
import type { VirtualSvelteDocument } from './virtual-svelte.js';

// ---------------------------------------------------------------------------
// 1. State shapes
// ---------------------------------------------------------------------------

/** State tracked for one open `.sveltex` document. */
export interface OpenDocument {
    /** The `.sveltex` document URI. */
    uri: string;
    /** Current full text of the source document. */
    text: string;
    /** LSP document version. */
    version: number;
    /** The document's regions (gap-free, sorted), as used to build `virtual`. */
    regions: Region[];
    /** The generated virtual `.svelte` document and its source map. */
    virtual: VirtualSvelteDocument;
}

/**
 * Default file extension for a SvelTeX document. The full set is read from
 * the live config (`SveltexConfigSnapshot.extensions`); this fallback is
 * only used before the first config snapshot resolves.
 */
export const DEFAULT_SVELTEX_EXTENSION = '.sveltex';

// ---------------------------------------------------------------------------
// 2. Request-pipeline helpers
// ---------------------------------------------------------------------------

/**
 * Returns a fresh object with the listed keys of `source` whose value is
 * defined; a key whose value is `undefined`, or a missing `source`, is omitted
 * entirely.
 *
 * Used to fold the embedded Svelte server's proxied capabilities into this
 * server's `initialize` response. A capability the child lacks must be
 * *absent*, not present-and-`undefined`: under `exactOptionalPropertyTypes` an
 * explicit `undefined` is a type error, and an editor seeing the key at all
 * would fire requests this server can answer only with `-32601`.
 */
export function pickDefined<T extends object, K extends keyof T>(
    source: T | undefined,
    keys: readonly K[],
): Partial<Pick<T, K>> {
    const picked: Partial<Pick<T, K>> = {};
    if (!source) return picked;
    for (const key of keys) {
        if (source[key] !== undefined) {
            picked[key] = source[key];
        }
    }
    return picked;
}

/**
 * Returns a copy of `capabilities` with the pull-diagnostics capability
 * (`textDocument.diagnostic`) removed.
 *
 * `svelte-language-server` switches to pull-only diagnostics — answering
 * `textDocument/diagnostic` requests and no longer *pushing*
 * `publishDiagnostics` — the moment the client claims to support them. This
 * server forwards only pushed diagnostics and advertises no pull
 * `diagnosticProvider` of its own, so it hides the capability from the child,
 * keeping it in push mode; otherwise diagnostics silently never appear.
 */
export function withoutPullDiagnostics(
    capabilities: ClientCapabilities,
): ClientCapabilities {
    const textDocument = capabilities.textDocument;
    if (!textDocument?.diagnostic) return capabilities;
    const nextTextDocument: TextDocumentClientCapabilities = {
        ...textDocument,
    };
    delete nextTextDocument.diagnostic;
    return { ...capabilities, textDocument: nextTextDocument };
}

/**
 * Origin marker placed on the `data` of every completion item this server
 * produces itself: items forwarded from a region child (TexLab, the math
 * server) and items computed natively for frontmatter.
 *
 * `completionItem/resolve` carries only the item, so its `data` is the sole
 * channel for telling an item's origin apart — which is what lets a resolve
 * request be answered correctly instead of being mis-sent to the embedded
 * Svelte server, which errors on a completion item it never produced.
 */
const NATIVE_COMPLETION_ORIGIN = 'sveltex-native';

/**
 * Tags every item of a completion result with {@link NATIVE_COMPLETION_ORIGIN}
 * — applied to the region-forwarded and frontmatter completion results so
 * their later `completionItem/resolve` is recognised as this server's own.
 */
export function markNativeCompletion(
    result: CompletionItem[] | CompletionList | null,
): CompletionItem[] | CompletionList | null {
    if (!result) return result;
    const mark = (item: CompletionItem): CompletionItem => ({
        ...item,
        data: { sveltexOrigin: NATIVE_COMPLETION_ORIGIN },
    });
    return Array.isArray(result)
        ? result.map(mark)
        : { ...result, items: result.items.map(mark) };
}

/**
 * Whether `item` was produced by this server itself — see
 * {@link markNativeCompletion}. Such an item is already complete: its
 * `completionItem/resolve` is answered by returning it unchanged.
 */
export function isNativeCompletionItem(item: CompletionItem): boolean {
    const data: unknown = item.data;
    return (
        typeof data === 'object' &&
        data !== null &&
        (data as Record<string, unknown>)['sveltexOrigin'] ===
            NATIVE_COMPLETION_ORIGIN
    );
}

// ---------------------------------------------------------------------------
// 3. `initialize`-time helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a usable filesystem path for the workspace root from `initialize`
 * params, tolerating the several historical shapes (`workspaceFolders`,
 * `rootUri`, the long-deprecated `rootPath`).
 *
 * @returns An absolute path, or `undefined` if none could be determined.
 */
export function workspaceRootOf(
    params: InitializeParams,
): string | undefined {
    const folder = params.workspaceFolders?.[0]?.uri;
    if (folder) return uriToPath(folder);
    // `rootUri` / `rootPath` are deprecated in the LSP spec but are still the
    // only root information sent by older clients, so they are kept as
    // fallbacks for compatibility.
    /* eslint-disable @typescript-eslint/no-deprecated */
    if (params.rootUri) return uriToPath(params.rootUri);
    if (typeof params.rootPath === 'string') return params.rootPath;
    /* eslint-enable @typescript-eslint/no-deprecated */
    return undefined;
}

/** Converts a `file:` URI to a filesystem path; returns `undefined` otherwise. */
export function uriToPath(uri: string): string | undefined {
    try {
        const parsed = URI.parse(uri);
        return parsed.scheme === 'file' ? parsed.fsPath : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Absolute paths of the child servers this server spawns, as a host may
 * optionally supply them. Each field is `undefined` when the host did not
 * provide a path, in which case the corresponding child is resolved from
 * `node_modules` by its proxy.
 */
export interface ResolvedServerPaths {
    /** Path of `svelte-language-server`'s `bin/server.js`, if supplied. */
    svelteLanguageServer: string | undefined;
    /**
     * Path of `@nvl/sveltex-math-language-server`'s `bin/server.js`, if
     * supplied.
     */
    mathLanguageServer: string | undefined;
}

/**
 * Extracts the optional child-server paths from an `initialize` request's
 * `initializationOptions`.
 *
 * A host that has bundled the child servers and so cannot resolve them from
 * `node_modules` (the VS Code extension) passes their absolute paths under a
 * `serverPaths` object:
 *
 * ```jsonc
 * "initializationOptions": {
 *   "serverPaths": {
 *     "svelteLanguageServer": "/abs/path/to/svelte-language-server.js",
 *     "mathLanguageServer": "/abs/path/to/sveltex-math-language-server.js"
 *   }
 * }
 * ```
 *
 * The field is entirely optional: any standalone client (the Zed extension,
 * the CLI, the test harness) omits it, and every path then resolves from
 * `node_modules` as before. Non-string entries are ignored.
 *
 * @param initializationOptions - The raw `initializationOptions` value, of
 * unknown shape.
 * @returns The resolved paths; fields are `undefined` when not supplied.
 */
export function readServerPaths(
    initializationOptions: unknown,
): ResolvedServerPaths {
    const empty: ResolvedServerPaths = {
        svelteLanguageServer: undefined,
        mathLanguageServer: undefined,
    };
    if (typeof initializationOptions !== 'object' || !initializationOptions) {
        return empty;
    }
    const serverPaths = (initializationOptions as Record<string, unknown>)[
        'serverPaths'
    ];
    if (typeof serverPaths !== 'object' || !serverPaths) return empty;
    const record = serverPaths as Record<string, unknown>;
    const asPath = (value: unknown): string | undefined =>
        typeof value === 'string' && value.length > 0 ? value : undefined;
    return {
        svelteLanguageServer: asPath(record['svelteLanguageServer']),
        mathLanguageServer: asPath(record['mathLanguageServer']),
    };
}
