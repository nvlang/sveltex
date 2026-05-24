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

import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';
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
    type Position,
    type PrepareRenameParams,
    type PublishDiagnosticsParams,
    type Range,
    type ReferenceParams,
    type RenameParams,
    type SelectionRangeParams,
    type SignatureHelpParams,
    type TextDocumentPositionParams,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SvelteProxy } from './svelte-proxy.js';
import { computeRegions, type Region } from './regions.js';
import { buildVirtualSvelte } from './virtual-svelte.js';
import { RegionForwarder, isLatexVerbatimRegion } from './region-forwarding.js';
import {
    collectConfigDependencies,
    defaultConfigSnapshot,
    loadConfigSnapshot,
    type SveltexConfigSnapshot,
} from './config.js';
import {
    computeDocumentSymbols,
    computeFoldingRanges,
    computeSelectionRanges,
} from './markdown.js';
import {
    computeFrontmatterCompletion,
    computeFrontmatterHover,
} from './frontmatter.js';
import {
    SEMANTIC_TOKEN_MODIFIERS,
    SEMANTIC_TOKEN_TYPES,
    computeSemanticTokens,
} from './semantic-tokens.js';
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
import {
    DEFAULT_SVELTEX_EXTENSION,
    isNativeCompletionItem,
    markNativeCompletion,
    pickDefined,
    readClientName,
    readServerPaths,
    withoutPullDiagnostics,
    workspaceRootOf,
    type OpenDocument,
} from './server-helpers.js';

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
    /** Resolved SvelTeX config; replaced once `initialize` locates a config. */
    let config: SveltexConfigSnapshot = defaultConfigSnapshot();
    /**
     * Workspace root, captured at `initialize`. Kept so the watched-file
     * handler can reload the config later without re-deriving it.
     */
    let workspaceRoot: string | undefined;

    /**
     * Live config-reload bookkeeping (see {@link scheduleConfigReload}). A
     * burst of `svelte.config.*` watch events is debounced into one reload,
     * and `configReloadInFlight`/`configReloadQueued` single-flight it —
     * together they cap the config loader at a single child process at a time.
     */
    let configReloadTimer: NodeJS.Timeout | undefined;
    let configReloadInFlight = false;
    let configReloadQueued = false;

    /**
     * Server-side filesystem watchers over the config's dependency graph (the
     * `svelte.config.*` plus every file it statically imports). Supplements the
     * client's own file watcher: it makes live reload fire for helper modules
     * the client's fixed `*.config.*` glob misses, and for clients (Zed,
     * standalone) that register no watcher at all. Re-armed on every reload —
     * see {@link rearmConfigWatchers}.
     */
    let configWatchers: FSWatcher[] = [];

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

    /**
     * Logs one operational line to the editor's "SvelTeX Language Server"
     * output channel, tagged `[sveltex]`. Carries child-server lifecycle
     * messages and config-load outcomes — the things that, when they go
     * wrong, would otherwise fail silently.
     */
    const logInfo = (message: string): void => {
        connection.console.info(`[sveltex] ${message}`);
    };

    /**
     * Pushes the live verbatim tag list to the client over the custom
     * `sveltex/resolvedTags` notification, keyed by verbatim type.
     *
     * The VS Code extension uses this to rebuild its TextMate grammar from
     * the same source of truth the LSP uses — the user's
     * `sveltex.config.js` — instead of from a separate VS Code user setting
     * that has to be kept in sync manually. Other clients (Zed, …) can
     * ignore the notification harmlessly.
     *
     * The four type-keyed lists let the client place each tag in the right
     * grammar bucket: `latexTags` → LaTeX injection; `escapeTags` /
     * `codeTags` → plain literal-text styling; `noopTags` → Svelte
     * injection.
     */
    function notifyResolvedTags(): void {
        void connection.sendNotification('sveltex/resolvedTags', {
            verbatimTags: config.verbatimTags,
            latexTags: config.latexTags,
            escapeTags: config.escapeTags,
            codeTags: config.codeTags,
            noopTags: config.noopTags,
        });
    }

    /**
     * Forwards hover/completion in non-delegated regions to dedicated child
     * servers: the math language server for `math` regions, TexLab for LaTeX
     * `verbatim` regions. Spawns its children lazily on first use.
     *
     * Its lifecycle log lines (TexLab / math server found, started, failed)
     * are routed to the editor's output channel so a missing or crashing
     * child is visible rather than a silent loss of language features.
     */
    const regionForwarder = new RegionForwarder(config, logInfo);

    /**
     * Returns whether a URI denotes a SvelTeX document, based on the live
     * config's `extensions` list (defaults to `['.sveltex']`). A user who
     * sets `extensions: ['.svtx']` in their SvelTeX config has the LSP open
     * `.svtx` files; the default still applies if the config hasn't
     * resolved yet.
     */
    function isSveltexUri(uri: string): boolean {
        const exts = config.extensions.length
            ? config.extensions
            : [DEFAULT_SVELTEX_EXTENSION];
        return exts.some((ext) => uri.endsWith(ext));
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
     * Returns the region of `doc` that contains `position`.
     *
     * @param doc - The open document.
     * @param position - A caret position in `.sveltex` coordinates.
     * @returns The containing {@link Region}, or `undefined` if the position is
     * out of range.
     *
     * @remarks
     * Regions tile the document gap-free, so the position lands in exactly one
     * — except a caret exactly on an interior boundary, which is resolved to
     * the region the boundary _opens_ (so a caret right after a `$…$` is
     * treated as the following region, not the math one).
     */
    function regionAt(
        doc: OpenDocument,
        position: Position,
    ): Region | undefined {
        const textDoc = TextDocument.create(
            'mem://sveltex',
            'sveltex',
            doc.version,
            doc.text,
        );
        const offset = textDoc.offsetAt(position);
        if (offset < 0 || offset > doc.text.length) return undefined;
        for (const region of doc.regions) {
            if (offset >= region.sourceStart && offset < region.sourceEnd) {
                return region;
            }
        }
        // A caret at the very end of the document belongs to the last region.
        return doc.regions.at(-1);
    }

    /**
     * Whether a request landing in `region` should be forwarded to a dedicated
     * child server (rather than the Svelte proxy).
     *
     * `true` for a `math` region (forwarded to the math language server) and
     * for a `verbatim` region whose tag is a configured LaTeX environment
     * (forwarded to TexLab). `RegionForwarder` makes the final call about
     * whether a child is actually available; this is just the fast gate.
     */
    function isForwardableRegion(doc: OpenDocument, region: Region): boolean {
        if (region.kind === 'math') return true;
        return isLatexVerbatimRegion(doc.text, region, config.latexTags);
    }

    /**
     * Rebuilds the regions, virtual document and source map for `text` and
     * stores them against `uri`.
     */
    function rebuild(uri: string, text: string, version: number): OpenDocument {
        const regions = computeRegions(text, config);
        const virtual = buildVirtualSvelte(text, regions);
        const doc: OpenDocument = { uri, text, version, regions, virtual };
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
            // Locate and load the SvelTeX config (from `svelte.config.*` at
            // the workspace root).
            workspaceRoot = workspaceRootOf(params);
            if (workspaceRoot) {
                config = await loadConfigSnapshot(workspaceRoot, logInfo);
                rearmConfigWatchers();
            }
            // The forwarder needs the resolved config (math backend, LaTeX
            // tags) before any request can be routed.
            regionForwarder.updateConfig(config);

            // A host that has bundled the child servers (the VS Code
            // extension) cannot rely on `node_modules` existing next to this
            // server, so it passes the bundled servers' absolute paths in
            // `initializationOptions`. When the field is absent — standalone
            // use, the Zed extension — the proxies fall back to resolving the
            // children from `node_modules` exactly as before.
            const serverPaths = readServerPaths(params.initializationOptions);
            proxy.setServerPath(serverPaths.svelteLanguageServer);
            regionForwarder.setMathServerPath(serverPaths.mathLanguageServer);

            // VS Code regenerates its TextMate grammar from
            // `sveltex/resolvedTags` so it already paints custom escape /
            // code verbatim bodies via `markup.fenced_code`. Emitting a
            // `string` semantic token over those would just override the
            // TM colouring with a different one. Other editors (Zed,
            // Helix, Neovim, …) can't dynamically extend their static
            // grammar, so semantic tokens are the only path there.
            const clientName = readClientName(params.initializationOptions);
            const shouldAdvertiseSemanticTokens = clientName !== 'vscode';

            // Start the embedded Svelte server with the host's own initialize
            // params (so its TypeScript service resolves the real project) —
            // but with the pull-diagnostics capability stripped. With it,
            // `svelte-language-server` answers diagnostics only on demand via
            // `textDocument/diagnostic` and stops *pushing* `publishDiagnostics`
            // notifications; this server forwards only pushed diagnostics (it
            // advertises no `diagnosticProvider`, so the editor never pulls),
            // so without the strip diagnostics would silently never appear.
            let childCapabilities: InitializeResult['capabilities'] | undefined;
            try {
                const childResult = await proxy.start({
                    ...params,
                    capabilities: withoutPullDiagnostics(params.capabilities),
                });
                childCapabilities = childResult.capabilities;
            } catch (error) {
                connection.console.error(
                    `Failed to start svelte-language-server: ${String(error)}`,
                );
            }

            // Advertise ONLY what this server actually answers, in two groups:
            //
            //  - Native — handled here directly (`textDocumentSync`, the
            //    Markdown document-symbol / folding / selection features) or by
            //    forwarding to the math / TexLab children (`hover`,
            //    `completion`). Always advertised: they work even when the
            //    Svelte child is unavailable.
            //  - Proxied — forwarded verbatim to `svelte-language-server` with
            //    no local fallback. Advertised only if that child advertises
            //    them; otherwise the editor fires requests this server can
            //    answer only with `-32601`. `svelte-language-server` has no
            //    `textDocument/documentLink` handler, for one — advertising it
            //    unconditionally flooded the editor log with failures.
            //
            // Spreading the child's *whole* capability set is wrong too: it
            // pulls in pull diagnostics, semantic tokens, inlay hints, … which
            // have no handler here at all.
            //
            // `textDocumentSync` is `Full` because the virtual document is
            // rebuilt wholesale. The completion trigger characters are extended
            // with `\` and `{`: the editor only re-requests completion on a
            // trigger character it was told about, and those two open a TeX
            // command / a `\begin{...}` environment name inside a forwarded
            // math or LaTeX region.
            const childCompletion = childCapabilities?.completionProvider;
            const triggerCharacters = [
                ...new Set([
                    ...(childCompletion?.triggerCharacters ?? []),
                    '\\',
                    '{',
                ]),
            ];
            return {
                capabilities: {
                    // Native — handled here, or via the math / TexLab
                    // children; advertised unconditionally.
                    textDocumentSync: TextDocumentSyncKind.Full,
                    hoverProvider: true,
                    completionProvider: {
                        ...(childCompletion ?? {}),
                        triggerCharacters,
                    },
                    documentSymbolProvider: true,
                    foldingRangeProvider: true,
                    selectionRangeProvider: true,
                    // Native semantic tokens — flat `string` for custom
                    // escape / code verbatim bodies. Advertised only
                    // when the client *can't* extend its static grammar
                    // (anything that isn't VS Code).
                    ...(shouldAdvertiseSemanticTokens
                        ? {
                              semanticTokensProvider: {
                                  legend: {
                                      tokenTypes: [...SEMANTIC_TOKEN_TYPES],
                                      tokenModifiers: [
                                          ...SEMANTIC_TOKEN_MODIFIERS,
                                      ],
                                  },
                                  full: true,
                                  range: false,
                              },
                          }
                        : {}),
                    // Proxied — forwarded to `svelte-language-server`; each is
                    // advertised only if that child advertises it.
                    ...pickDefined(childCapabilities, [
                        'definitionProvider',
                        'referencesProvider',
                        'documentHighlightProvider',
                        'signatureHelpProvider',
                        'renameProvider',
                        'codeActionProvider',
                        'documentLinkProvider',
                    ]),
                },
                serverInfo: {
                    name: 'sveltex-language-server',
                },
            };
        },
    );

    /**
     * The config-reload pump: drains pending reload requests one at a time,
     * re-pointing the region forwarder at each fresh snapshot.
     *
     * {@link loadConfigSnapshot} spawns a child process, so reloads are run
     * strictly sequentially — `configReloadInFlight` keeps only one pump (and
     * thus one child process) alive at a time, and requests that arrive
     * mid-reload are coalesced into a single trailing pass via
     * `configReloadQueued`.
     */
    async function runConfigReloadPump(): Promise<void> {
        try {
            while (configReloadQueued) {
                configReloadQueued = false;
                const root = workspaceRoot;
                if (!root) break;
                config = await loadConfigSnapshot(root, logInfo);
                // The dependency graph can change between reloads (an import
                // added or removed), so re-arm the watchers each time.
                rearmConfigWatchers();
                regionForwarder.updateConfig(config);
                // Tell the client about the new tag list so it can refresh
                // any tag-derived state (e.g. the VS Code extension's
                // TextMate grammar).
                notifyResolvedTags();
                // Region kinds depend on the config — which tags are
                // `noop` (delegated to the Svelte proxy) vs
                // `tex`/`escape`/`code` (blanked out of the virtual
                // document), the math delimiters, the directive settings.
                // So a config change must re-parse every OPEN document;
                // otherwise its regions, virtual document and source map
                // stay frozen at the old config until the next keystroke,
                // and e.g. a freshly-added `noop` env's body keeps being
                // hidden from `svelte-language-server`.
                await resyncOpenDocuments();
            }
        } finally {
            configReloadInFlight = false;
        }
    }

    /**
     * Re-parses every open document against the current {@link config} and
     * re-syncs it to the Svelte proxy (close + re-open so the proxy drops
     * its stale virtual document and its source map cleanly, independent
     * of LSP version bookkeeping).
     */
    async function resyncOpenDocuments(): Promise<void> {
        // Snapshot the URIs, not the document objects: `rebuild` rewrites each
        // map entry, and a `didClose` can arrive at one of the `await`s below
        // and remove an entry mid-loop. Re-fetch each iteration, and re-check
        // liveness around the awaits, so a document the editor closed during
        // the resync is not resurrected and re-opened in the proxy — which
        // would leave a phantom virtual document (with stale diagnostics) that
        // no later edit or close would clear.
        for (const uri of [...documents.keys()]) {
            const existing = documents.get(uri);
            if (!existing) continue; // closed before we reached it
            const doc = rebuild(existing.uri, existing.text, existing.version);
            if (!proxy.isRunning) continue;
            await proxyDidClose(doc.uri);
            if (!documents.has(doc.uri)) continue; // closed during the await
            await proxyDidOpen(doc);
        }
    }

    /**
     * Debounced entry point for a config reload: a single editor save can emit
     * several watch events in quick succession (atomic write-and-rename, …),
     * and they collapse into one reload once the file stops changing. The
     * debounced callback then kicks {@link runConfigReloadPump}, unless one is
     * already running.
     */
    function scheduleConfigReload(): void {
        if (configReloadTimer) clearTimeout(configReloadTimer);
        // 200 ms: long enough to absorb a save's burst of events, short
        // enough to still feel immediate.
        configReloadTimer = setTimeout(() => {
            configReloadTimer = undefined;
            configReloadQueued = true;
            if (configReloadInFlight) return;
            configReloadInFlight = true;
            void runConfigReloadPump();
        }, 200);
        // The debounce timer must not by itself keep the process alive.
        configReloadTimer.unref();
    }

    /**
     * (Re)arms the server-side config watchers: closes any existing watchers,
     * then watches the directory of each file in the current config's
     * dependency graph, filtering events to those files by name. Watching the
     * containing directory rather than the file itself survives the atomic
     * write-and-rename many editors use on save. Safe to call repeatedly and
     * never throws.
     */
    function rearmConfigWatchers(): void {
        for (const watcher of configWatchers) {
            try {
                watcher.close();
            } catch {
                // Already closed / gone — ignore.
            }
        }
        configWatchers = [];

        const configPath = config.configPath;
        if (!configPath) return;

        let dependencies: string[];
        try {
            dependencies = collectConfigDependencies(configPath);
        } catch {
            dependencies = [configPath];
        }

        // One watcher per directory, with a basename allow-list so unrelated
        // edits in that directory (likely, when it is the project root) don't
        // trigger a reload.
        const namesByDir = new Map<string, Set<string>>();
        for (const dependency of dependencies) {
            const dir = dirname(dependency);
            const names = namesByDir.get(dir) ?? new Set<string>();
            names.add(basename(dependency));
            namesByDir.set(dir, names);
        }

        for (const [dir, names] of namesByDir) {
            try {
                const watcher = fsWatch(dir, (_event, filename) => {
                    // `filename` is null on some platforms — reload to be safe.
                    if (filename === null || names.has(filename.toString())) {
                        scheduleConfigReload();
                    }
                });
                // A transient watch error (directory removed, limit hit) must
                // not crash the server.
                watcher.on('error', () => {
                    /* ignore */
                });
                // The watcher must not by itself keep the process alive.
                watcher.unref();
                configWatchers.push(watcher);
            } catch {
                // A directory we cannot watch just isn't covered.
            }
        }
    }

    // The `initialized` notification arrives *after* `initialize` returned
    // and the client has finished setting up its side. That's the safe
    // earliest point to push server-initiated notifications — sending one
    // during `onInitialize` itself races the client's notification
    // handler registration.
    connection.onInitialized(() => {
        notifyResolvedTags();
    });

    // A watched `svelte.config.*` (or a `sveltex.config.*` it imports)
    // changed: schedule a debounced reload so region detection and TexLab
    // forwarding pick the new settings up without an LSP restart.
    connection.onDidChangeWatchedFiles((): void => {
        if (!workspaceRoot) return;
        scheduleConfigReload();
    });

    connection.onShutdown(async () => {
        if (configReloadTimer) clearTimeout(configReloadTimer);
        for (const watcher of configWatchers) {
            try {
                watcher.close();
            } catch {
                // Already closed / gone — ignore.
            }
        }
        configWatchers = [];
        await Promise.all([proxy.stop(), regionForwarder.stop()]);
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
            if (!documents.get(uri)) return;

            // The client uses Full sync (we advertised it), so the last change
            // entry holds the complete new text.
            const last = params.contentChanges.at(-1);
            if (!last || !('text' in last)) return;

            // Re-parse synchronously. The editor requests completion on the
            // very `\` (or `{`) it just inserted — i.e. immediately after this
            // `didChange`. Debouncing the re-parse would leave that request
            // working off stale regions and a stale source map while the caret
            // is already past them, so the position mis-maps and the forwarded
            // request silently returns nothing. `computeRegions` is cheap
            // enough to run per keystroke, and `svelte-language-server`
            // debounces its own (heavier) analysis downstream.
            const doc = rebuild(uri, last.text, params.textDocument.version);
            void proxyDidChange(doc);
        },
    );

    connection.onDidCloseTextDocument(
        (params: DidCloseTextDocumentParams): void => {
            const uri = params.textDocument.uri;
            if (!isSveltexUri(uri)) return;
            documents.delete(uri);
            void proxyDidClose(uri);
        },
    );

    // ----- proxied, position-mapped language features -----------------------

    connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
        // A hover inside a non-delegated region (math, LaTeX verbatim) is
        // handled by a dedicated child server, not the Svelte proxy.
        const doc = documents.get(params.textDocument.uri);
        if (doc) {
            const region = regionAt(doc, params.position);
            if (region && isForwardableRegion(doc, region)) {
                return regionForwarder.forwardHover(
                    doc.text,
                    doc.uri,
                    region,
                    params.position,
                );
            }
            // Frontmatter is non-delegated — the Svelte child never sees it —
            // so its keys are documented natively.
            if (region?.kind === 'frontmatter') {
                return computeFrontmatterHover(doc.text, params.position);
            }
        }
        const proxied = await proxyPositionRequest<Hover | null>(
            'textDocument/hover',
            params,
        );
        if (!proxied) return null;
        return remapHover(proxied.result, proxied.ctx);
    });

    connection.onCompletion(async (params: CompletionParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (doc) {
            const region = regionAt(doc, params.position);
            if (region && isForwardableRegion(doc, region)) {
                return markNativeCompletion(
                    await regionForwarder.forwardCompletion(
                        doc.text,
                        doc.uri,
                        region,
                        params.position,
                    ),
                );
            }
            // Frontmatter is non-delegated — suggest its keys/values natively.
            if (region?.kind === 'frontmatter') {
                return markNativeCompletion(
                    computeFrontmatterCompletion(doc.text, params.position),
                );
            }
        }
        const proxied = await proxyPositionRequest<
            Parameters<typeof remapCompletion>[0]
        >('textDocument/completion', params);
        if (!proxied) return null;
        return remapCompletion(proxied.result, proxied.ctx);
    });

    // A `completionItem/resolve` goes back to whichever server produced the
    // item. Items this server makes itself — region forwards (TexLab, the
    // math server) and native frontmatter completion — are already complete,
    // so they are returned unchanged; only genuine Svelte-proxy items are
    // resolved by the embedded child. Forwarding a foreign item to the Svelte
    // server instead makes it error on a document it never opened.
    connection.onCompletionResolve(
        async (item: CompletionItem): Promise<CompletionItem> => {
            if (isNativeCompletionItem(item)) return item;
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

    // Semantic tokens — flat `string` for custom escape/code verbatim
    // bodies, nothing else. Registered unconditionally because the
    // capability is only advertised to non-VS-Code clients (see
    // `shouldAdvertiseSemanticTokens` above); VS Code therefore never
    // sends this request. An unknown-document case returns an empty
    // token set rather than `null` so the wire path stays alive.
    connection.languages.semanticTokens.on(({ textDocument }) => {
        const doc = documents.get(textDocument.uri);
        if (!doc) return { data: [] };
        return computeSemanticTokens(
            doc.text,
            doc.regions,
            config.escapeTags,
            config.codeTags,
        );
    });
}
