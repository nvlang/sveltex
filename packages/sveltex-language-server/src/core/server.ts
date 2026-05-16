// File description: `createServer` — the transport-agnostic heart of the
// SvelTeX language server.
//
// `createServer` takes an already-constructed LSP `Connection` (created over
// stdio by `index.ts`, or over IPC by the VS Code extension) and wires it up.
// It deliberately does NOT import `vscode`, `process.stdin`, or any transport:
// that separation is what lets the same core back both the VS Code extension
// and the planned Zed extension. The Zed extension only needs to launch
// `bin/server.js`; everything below is shared.
//
// Request flow:
//   editor --(.sveltex coords)--> createServer --(map src->gen)--> SvelteProxy
//          <--(.sveltex coords)-- createServer <--(map gen->src)-- child server
//
// Non-delegated regions (verbatim/code/math/frontmatter) are blanked out of the
// virtual document, so the embedded Svelte server never sees them; requests and
// responses that land there are dropped.

import type { Connection } from 'vscode-languageserver';
import {
    DidChangeTextDocumentNotification,
    DidCloseTextDocumentNotification,
    DidOpenTextDocumentNotification,
    PublishDiagnosticsNotification,
    TextDocumentSyncKind,
    type CodeActionParams,
    type CompletionItem,
    type CompletionParams,
    type DefinitionParams,
    type DidChangeTextDocumentParams,
    type DidCloseTextDocumentParams,
    type DidOpenTextDocumentParams,
    type DocumentHighlightParams,
    type DocumentLinkParams,
    type DocumentSymbolParams,
    type FoldingRangeParams,
    type Hover,
    type HoverParams,
    type InitializeParams,
    type InitializeResult,
    type Location,
    type PrepareRenameParams,
    type PublishDiagnosticsParams,
    type Range,
    type ReferenceParams,
    type RenameParams,
    type SelectionRangeParams,
    type SignatureHelpParams,
    type TextDocumentPositionParams,
} from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { SvelteProxy } from './svelte-proxy.js';
import { computeRegions } from './regions.js';
import {
    buildVirtualSvelte,
    type VirtualSvelteDocument,
} from './virtual-svelte.js';
import {
    defaultConfigSnapshot,
    loadConfigSnapshot,
    type SveltexConfigSnapshot,
} from './config.js';
import {
    computeDocumentSymbols,
    computeFoldingRanges,
    computeSelectionRanges,
} from './markdown.js';
import { mapProxiedDiagnostics, mergeDiagnostics } from './diagnostics.js';
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
    toSourceUri,
    toVirtualUri,
    type RemapContext,
} from './remap.js';

/** State tracked for one open `.sveltex` document. */
interface OpenDocument {
    /** The `.sveltex` document URI. */
    uri: string;
    /** Current full text of the source document. */
    text: string;
    /** LSP document version. */
    version: number;
    /** The generated virtual `.svelte` document and its source map. */
    virtual: VirtualSvelteDocument;
}

/** Debounce window (ms) for rebuilding the virtual document on edits. */
const REPARSE_DEBOUNCE_MS = 150;

/** File extension that identifies a SvelTeX document. */
const SVELTEX_EXTENSION = '.sveltex';

/**
 * Wires a SvelTeX language server onto the given connection.
 *
 * @param connection - An LSP {@link Connection}, already created for whatever
 * transport the host uses. This function never calls `listen()` — the caller
 * (`startServer` in `index.ts`, or the VS Code client) owns the lifecycle.
 *
 * @remarks
 * Transport-agnostic by construction: no `vscode` import, no direct stdio
 * access. This is the contract the future Zed extension relies on.
 */
export function createServer(connection: Connection): void {
    /** Open `.sveltex` documents, keyed by URI. */
    const documents = new Map<string, OpenDocument>();
    /** Pending debounced re-parse timers, keyed by URI. */
    const reparseTimers = new Map<string, NodeJS.Timeout>();
    /** Resolved SvelTeX config; replaced once `initialize` locates a config. */
    let config: SveltexConfigSnapshot = defaultConfigSnapshot();

    /**
     * The embedded Svelte language server. Notifications it emits for a virtual
     * `.svelte` URI are translated and re-emitted by the host on the
     * corresponding `.sveltex` URI.
     */
    const proxy = new SvelteProxy({
        onNotification: (method, params) => {
            handleProxyNotification(method, params);
        },
        onRequest: async (method, params) => {
            // Server-to-client requests from the child (e.g.
            // `client/registerCapability`, `workspace/configuration`) are
            // forwarded to the real editor and the response relayed back.
            return connection.sendRequest(method, params);
        },
    });

    /** Returns whether a URI denotes a SvelTeX document. */
    function isSveltexUri(uri: string): boolean {
        return uri.endsWith(SVELTEX_EXTENSION);
    }

    /** Builds a {@link RemapContext} for an open document. */
    function remapContext(doc: OpenDocument): RemapContext {
        return {
            sourceUri: doc.uri,
            virtualUri: toVirtualUri(doc.uri),
            sourceMap: doc.virtual.sourceMap,
        };
    }

    /**
     * Rebuilds the regions, virtual document and source map for `text` and
     * stores them against `uri`.
     */
    function rebuild(uri: string, text: string, version: number): OpenDocument {
        const regions = computeRegions(text, config);
        const virtual = buildVirtualSvelte(text, regions);
        const doc: OpenDocument = { uri, text, version, virtual };
        documents.set(uri, doc);
        return doc;
    }

    /** Sends the virtual document to the child via `textDocument/didOpen`. */
    async function proxyDidOpen(doc: OpenDocument): Promise<void> {
        await proxy.sendNotification(DidOpenTextDocumentNotification.method, {
            textDocument: {
                uri: toVirtualUri(doc.uri),
                languageId: 'svelte',
                version: doc.version,
                text: doc.virtual.text,
            },
        });
    }

    /**
     * Sends a full-text update of the virtual document to the child via
     * `textDocument/didChange`.
     */
    async function proxyDidChange(doc: OpenDocument): Promise<void> {
        await proxy.sendNotification(DidChangeTextDocumentNotification.method, {
            textDocument: { uri: toVirtualUri(doc.uri), version: doc.version },
            contentChanges: [{ text: doc.virtual.text }],
        });
    }

    /** Tells the child to close the virtual document. */
    async function proxyDidClose(uri: string): Promise<void> {
        await proxy.sendNotification(DidCloseTextDocumentNotification.method, {
            textDocument: { uri: toVirtualUri(uri) },
        });
    }

    /**
     * Routes a notification originating in the child server back to the editor.
     *
     * The only notification needing translation is `publishDiagnostics`: its
     * ranges are in virtual-document coordinates and must be mapped back, and
     * its URI must be rewritten from the virtual `.svelte` URI to the
     * `.sveltex` URI. All other notifications (log messages, telemetry, ...)
     * are forwarded verbatim.
     */
    function handleProxyNotification(method: string, params: unknown): void {
        if (method === PublishDiagnosticsNotification.method) {
            const diagnosticsParams = params as PublishDiagnosticsParams;
            const sourceUri = toSourceUri(diagnosticsParams.uri);
            const doc = documents.get(sourceUri);
            if (!doc) return;
            const ctx = remapContext(doc);
            const proxied = mapProxiedDiagnostics(
                diagnosticsParams.diagnostics,
                ctx.sourceMap,
            );
            // Native LaTeX/math diagnostics are stubbed for v1.
            // TODO: produce native diagnostics for verbatim/math regions.
            const merged = mergeDiagnostics(proxied, []);
            void connection.sendDiagnostics({
                uri: sourceUri,
                ...(diagnosticsParams.version !== undefined
                    ? { version: diagnosticsParams.version }
                    : {}),
                diagnostics: merged,
            });
            return;
        }
        // Pass through everything else (window/logMessage, $/progress, ...).
        void connection.sendNotification(method, params);
    }

    /**
     * Maps a request's `{ textDocument, position }` from source to generated
     * coordinates and forwards the request to the child.
     *
     * @typeParam R - The expected response shape. The LSP wire protocol is
     * untyped JSON, so `R` is a caller-supplied assertion about what the child
     * returns — hence it appears only in the return position.
     * @returns The raw child response, or `null` if the document is unknown,
     * the proxy is down, or the position falls in a non-delegated region.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    async function proxyPositionRequest<R>(
        method: string,
        params: TextDocumentPositionParams,
    ): Promise<{ result: R; ctx: RemapContext } | null> {
        const doc = documents.get(params.textDocument.uri);
        if (!doc || !proxy.isRunning) return null;
        const ctx = remapContext(doc);
        const position = ctx.sourceMap.sourcePositionToGenerated(
            params.position,
        );
        if (!position) return null;
        const generatedParams = {
            ...params,
            textDocument: { uri: ctx.virtualUri },
            position,
        };
        const result = await proxy.sendRequest<R>(method, generatedParams);
        return { result, ctx };
    }

    // ----- lifecycle ---------------------------------------------------------

    connection.onInitialize(
        async (params: InitializeParams): Promise<InitializeResult> => {
            // Locate and load `sveltex.config.*` from the workspace root.
            const root = workspaceRootOf(params);
            if (root) {
                config = await loadConfigSnapshot(root);
            }

            // Start the embedded Svelte server with the host's own initialize
            // params so its TypeScript service resolves the real project.
            let childCapabilities: InitializeResult['capabilities'] | undefined;
            try {
                const childResult = await proxy.start(params);
                childCapabilities = childResult.capabilities;
            } catch (error) {
                connection.console.error(
                    `Failed to start svelte-language-server: ${String(error)}`,
                );
            }

            // Advertise the union of: what the child can do (so proxied
            // requests are actually requested by the editor) and the native
            // Markdown features this server adds. `textDocumentSync` is forced
            // to `Full` because the virtual document is rebuilt wholesale.
            return {
                capabilities: {
                    ...(childCapabilities ?? {}),
                    textDocumentSync: TextDocumentSyncKind.Full,
                    documentSymbolProvider: true,
                    foldingRangeProvider: true,
                    selectionRangeProvider: true,
                },
                serverInfo: {
                    name: 'sveltex-language-server',
                },
            };
        },
    );

    connection.onShutdown(async () => {
        for (const timer of reparseTimers.values()) clearTimeout(timer);
        reparseTimers.clear();
        await proxy.stop();
    });

    // ----- document synchronization -----------------------------------------

    connection.onDidOpenTextDocument(
        (params: DidOpenTextDocumentParams): void => {
            const { uri, version, text } = params.textDocument;
            if (!isSveltexUri(uri)) return;
            const doc = rebuild(uri, text, version);
            void proxyDidOpen(doc);
        },
    );

    connection.onDidChangeTextDocument(
        (params: DidChangeTextDocumentParams): void => {
            const uri = params.textDocument.uri;
            if (!isSveltexUri(uri)) return;
            const previous = documents.get(uri);
            if (!previous) return;

            // The client uses Full sync (we advertised it), so the last change
            // entry holds the complete new text.
            const last = params.contentChanges.at(-1);
            if (!last || !('text' in last)) return;
            const version = params.textDocument.version;

            // Debounce: a fresh re-parse on every keystroke is wasteful, and
            // mid-edit text is often transiently unparseable anyway.
            const existing = reparseTimers.get(uri);
            if (existing) clearTimeout(existing);
            reparseTimers.set(
                uri,
                setTimeout(() => {
                    reparseTimers.delete(uri);
                    const doc = rebuild(uri, last.text, version);
                    void proxyDidChange(doc);
                }, REPARSE_DEBOUNCE_MS),
            );
        },
    );

    connection.onDidCloseTextDocument(
        (params: DidCloseTextDocumentParams): void => {
            const uri = params.textDocument.uri;
            if (!isSveltexUri(uri)) return;
            const timer = reparseTimers.get(uri);
            if (timer) {
                clearTimeout(timer);
                reparseTimers.delete(uri);
            }
            documents.delete(uri);
            void proxyDidClose(uri);
        },
    );

    // ----- proxied, position-mapped language features -----------------------

    connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
        const proxied = await proxyPositionRequest<Hover | null>(
            'textDocument/hover',
            params,
        );
        if (!proxied) return null;
        return remapHover(proxied.result, proxied.ctx);
    });

    connection.onCompletion(async (params: CompletionParams) => {
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapCompletion>[0]
        >('textDocument/completion', params);
        if (!proxied) return null;
        return remapCompletion(proxied.result, proxied.ctx);
    });

    // Completion items are resolved by the child unchanged: a resolved item's
    // edits, if any, were already source-mapped when the item was first
    // returned, and `resolve` only enriches documentation/detail.
    connection.onCompletionResolve(
        async (item: CompletionItem): Promise<CompletionItem> => {
            if (!proxy.isRunning) return item;
            return proxy.sendRequest<CompletionItem>(
                'completionItem/resolve',
                item,
            );
        },
    );

    connection.onDefinition(async (params: DefinitionParams) => {
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapDefinition>[0]
        >('textDocument/definition', params);
        if (!proxied) return null;
        return remapDefinition(proxied.result, proxied.ctx);
    });

    connection.onReferences(
        async (params: ReferenceParams): Promise<Location[] | null> => {
            const proxied = await proxyPositionRequest<Location[] | null>(
                'textDocument/references',
                params,
            );
            if (!proxied) return null;
            return remapReferences(proxied.result, proxied.ctx);
        },
    );

    connection.onDocumentHighlight(async (params: DocumentHighlightParams) => {
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapHighlights>[0]
        >('textDocument/documentHighlight', params);
        if (!proxied) return null;
        return remapHighlights(proxied.result, proxied.ctx);
    });

    connection.onSignatureHelp(async (params: SignatureHelpParams) => {
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapSignatureHelp>[0]
        >('textDocument/signatureHelp', params);
        if (!proxied) return null;
        return remapSignatureHelp(proxied.result);
    });

    connection.onRenameRequest(async (params: RenameParams) => {
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapWorkspaceEdit>[0]
        >('textDocument/rename', params);
        if (!proxied) return null;
        return remapWorkspaceEdit(proxied.result, proxied.ctx);
    });

    connection.onPrepareRename(async (params: PrepareRenameParams) => {
        const proxied = await proxyPositionRequest<Range | null>(
            'textDocument/prepareRename',
            params,
        );
        if (!proxied || !proxied.result) return null;
        // `prepareRename` may return a bare `Range` or a `{ range, placeholder }`
        // object; only the `Range` case needs mapping. The bare-range case is
        // the one `svelte-language-server` returns.
        return (
            proxied.ctx.sourceMap.generatedRangeToSource(proxied.result) ?? null
        );
    });

    connection.onCodeAction(async (params: CodeActionParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc || !proxy.isRunning) return null;
        const ctx = remapContext(doc);
        const range = ctx.sourceMap.sourceRangeToGenerated(params.range);
        // A code action requested over a non-delegated region has nothing the
        // embedded server can offer.
        if (!range) return null;
        const generatedParams: CodeActionParams = {
            ...params,
            textDocument: { uri: ctx.virtualUri },
            range,
            context: {
                ...params.context,
                // Diagnostics in the request context are in source
                // coordinates; map the ones that fall in delegated regions.
                diagnostics: params.context.diagnostics
                    .map((diag) => {
                        const mapped = ctx.sourceMap.sourceRangeToGenerated(
                            diag.range,
                        );
                        if (!mapped) return undefined;
                        return { ...diag, range: mapped };
                    })
                    .filter((d): d is NonNullable<typeof d> => Boolean(d)),
            },
        };
        const result = await proxy.sendRequest<
            Parameters<typeof remapCodeActions>[0]
        >('textDocument/codeAction', generatedParams);
        return remapCodeActions(result, ctx);
    });

    connection.onDocumentLinks(async (params: DocumentLinkParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc || !proxy.isRunning) return null;
        const ctx = remapContext(doc);
        const result = await proxy.sendRequest<
            Parameters<typeof remapDocumentLinks>[0]
        >('textDocument/documentLink', {
            textDocument: { uri: ctx.virtualUri },
        });
        return remapDocumentLinks(result, ctx);
    });

    // ----- native Markdown features (no proxy, no mapping) ------------------

    connection.onDocumentSymbol((params: DocumentSymbolParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc) return null;
        return computeDocumentSymbols(doc.text, config);
    });

    connection.onFoldingRanges((params: FoldingRangeParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc) return null;
        return computeFoldingRanges(doc.text, config);
    });

    connection.onSelectionRanges((params: SelectionRangeParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc) return null;
        return computeSelectionRanges(doc.text, params.positions, config);
    });
}

/**
 * Extracts a usable filesystem path for the workspace root from `initialize`
 * params, tolerating the several historical shapes (`workspaceFolders`,
 * `rootUri`, the long-deprecated `rootPath`).
 *
 * @returns An absolute path, or `undefined` if none could be determined.
 */
function workspaceRootOf(params: InitializeParams): string | undefined {
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
function uriToPath(uri: string): string | undefined {
    try {
        const parsed = URI.parse(uri);
        return parsed.scheme === 'file' ? parsed.fsPath : undefined;
    } catch {
        return undefined;
    }
}
