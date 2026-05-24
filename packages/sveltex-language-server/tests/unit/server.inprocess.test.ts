// In-process unit tests for `createServer` (`src/core/server.ts`).
//
// `server.test.ts` already drives the server end-to-end, but it *spawns* the
// server as a child process, so v8 cannot attribute that execution to the
// source file — it reports 0% coverage. This suite instead calls
// `createServer(connection)` directly in the test process, with a hand-built
// fake `Connection` that captures every registered handler so the tests can
// invoke them and assert on what flows back out.
//
// The spawning collaborators are module-mocked so nothing forks:
//   - `./svelte-proxy.js` → a `FakeSvelteProxy` whose every method is a
//     controllable `vi.fn()`, recorded into `proxies` so a test can drive the
//     child's responses and toggle `isRunning`.
//   - `./region-forwarding.js` → a `FakeRegionForwarder` recorded into
//     `forwarders`, with controllable `forwardHover` / `forwardCompletion`.
//   - `./config.js` is partially mocked: `loadConfigSnapshot` is a spy that
//     returns whatever the test queues, while everything else (the real
//     `defaultConfigSnapshot`, `collectConfigDependencies`, …) is preserved so
//     the watcher-rearm path runs against the real filesystem.
//
// The region detector, virtual-document builder, source map, remappers, and the
// native Markdown / frontmatter / semantic-token computations are all REAL, so
// position mapping (mapped vs unmapped) is exercised authentically.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';
import { PublishDiagnosticsNotification } from 'vscode-languageserver-protocol';
import type {
    Connection,
    InitializeParams,
    InitializeResult,
} from 'vscode-languageserver';
import {
    defaultConfigSnapshot,
    type SveltexConfigSnapshot,
} from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Mocks for the spawning collaborators.
//
// `vi.mock` factories are hoisted above the module's top-level statements, so
// every value a factory closes over must be created in a `vi.hoisted` block
// (also hoisted) rather than as a plain `const`.
// ---------------------------------------------------------------------------

/** Handlers passed to a `SvelteProxy` at construction. */
interface ProxyHandlers {
    onNotification: (method: string, params: unknown) => void;
    onRequest: (method: string, params: unknown) => Promise<unknown>;
}

/** A fake `SvelteProxy`; every instance is recorded in `proxies`. */
interface FakeSvelteProxy {
    handlers: ProxyHandlers;
    isRunning: boolean;
    setServerPath: MockInstance;
    start: MockInstance;
    sendRequest: MockInstance;
    sendNotification: MockInstance;
    stop: MockInstance;
}

/** A fake `RegionForwarder`; every instance is recorded in `forwarders`. */
interface FakeRegionForwarder {
    config: SveltexConfigSnapshot;
    log: ((m: string) => void) | undefined;
    updateConfig: MockInstance;
    setMathServerPath: MockInstance;
    forwardHover: MockInstance;
    forwardCompletion: MockInstance;
    stop: MockInstance;
}

const hoisted = vi.hoisted(() => {
    const proxies: FakeSvelteProxy[] = [];
    const forwarders: FakeRegionForwarder[] = [];
    return {
        proxies,
        forwarders,
        loadConfigSnapshot: vi.fn(),
        // Each real `fs.watch` call records its returned watcher here, so a
        // test can emit an `'error'` event on it to exercise the watcher's
        // error handler. Cleared in `beforeEach`.
        watchers: [] as import('node:fs').FSWatcher[],
        // Defaults to the real dependency scan; a test can make it throw to
        // drive the `rearmConfigWatchers` catch fallback.
        collectConfigDependencies: vi.fn(),
        // Defined lazily so each instance gets its own fresh `vi.fn()`s and is
        // pushed to the recording array at construction time. The async fakes
        // use `.mockResolvedValue(...)` (rather than an inline async/promise
        // body) so they satisfy both the require-await and promise-async rules.
        FakeSvelteProxy: class {
            public handlers: ProxyHandlers;
            public isRunning = false;
            public setServerPath = vi.fn();
            public start = vi.fn().mockResolvedValue({ capabilities: {} });
            public sendRequest = vi.fn().mockResolvedValue(null);
            public sendNotification = vi.fn().mockResolvedValue(undefined);
            public stop = vi.fn().mockResolvedValue(undefined);
            public constructor(handlers: ProxyHandlers) {
                this.handlers = handlers;
                proxies.push(this);
            }
        },
        FakeRegionForwarder: class {
            public config: SveltexConfigSnapshot;
            public log: ((m: string) => void) | undefined;
            public updateConfig = vi.fn((c: SveltexConfigSnapshot) => {
                this.config = c;
            });
            public setMathServerPath = vi.fn();
            public forwardHover = vi.fn().mockResolvedValue(null);
            public forwardCompletion = vi.fn().mockResolvedValue(null);
            public stop = vi.fn().mockResolvedValue(undefined);
            public constructor(
                config: SveltexConfigSnapshot,
                log?: (m: string) => void,
            ) {
                this.config = config;
                this.log = log;
                forwarders.push(this);
            }
        },
    };
});

const { proxies, forwarders, loadConfigSnapshot, watchers } = hoisted;
const collectConfigDependenciesMock = hoisted.collectConfigDependencies;

// Wrap `node:fs`'s `watch` so the watchers `server.ts` arms are recorded (and
// can have an `'error'` emitted at them); everything else in `node:fs` stays
// real, which the (partially-mocked) `config.js` relies on.
vi.mock('node:fs', async () => {
    const actual =
        await vi.importActual<typeof import('node:fs')>('node:fs');
    return {
        ...actual,
        watch: (
            ...args: Parameters<typeof actual.watch>
        ): ReturnType<typeof actual.watch> => {
            const watcher = actual.watch(...args);
            hoisted.watchers.push(watcher);
            return watcher;
        },
    };
});

vi.mock('../../src/core/svelte-proxy.js', () => ({
    SvelteProxy: hoisted.FakeSvelteProxy,
}));

vi.mock('../../src/core/region-forwarding.js', async () => {
    // Keep the real `isLatexVerbatimRegion` — `server.ts` uses it directly to
    // decide whether a verbatim region is forwardable.
    const actual = await vi.importActual<
        typeof import('../../src/core/region-forwarding.js')
    >('../../src/core/region-forwarding.js');
    return {
        ...actual,
        RegionForwarder: hoisted.FakeRegionForwarder,
    };
});

// `loadConfigSnapshot` and `collectConfigDependencies` are the `config.js`
// exports we control; the rest is real so the watcher-rearm path exercises the
// genuine dependency scan.
vi.mock('../../src/core/config.js', async () => {
    const actual = await vi.importActual<
        typeof import('../../src/core/config.js')
    >('../../src/core/config.js');
    // Default the spy to the real implementation; tests override per-case.
    hoisted.collectConfigDependencies.mockImplementation(
        actual.collectConfigDependencies,
    );
    return {
        ...actual,
        loadConfigSnapshot: hoisted.loadConfigSnapshot,
        collectConfigDependencies: hoisted.collectConfigDependencies,
    };
});

// Imported *after* the mocks are declared so `createServer` picks them up.
const { createServer } = await import('../../src/core/server.js');

// ---------------------------------------------------------------------------
// Fake connection.
// ---------------------------------------------------------------------------

/** A registered request/notification handler, keyed by its registration name. */
type Handler = (...args: unknown[]) => unknown;

/**
 * A fake LSP {@link Connection}. Each `onXxx` registration captures the handler
 * into `handlers`; the message-sending surface is `vi.fn()`s the tests inspect.
 */
interface FakeConnection {
    connection: Connection;
    handlers: Map<string, Handler>;
    sendRequest: MockInstance;
    sendNotification: MockInstance;
    sendDiagnostics: MockInstance;
    consoleInfo: MockInstance;
    consoleError: MockInstance;
    /** Invokes a captured handler by name; the caller narrows the result. */
    invoke: (name: string, ...args: unknown[]) => unknown;
}

function makeConnection(): FakeConnection {
    const handlers = new Map<string, Handler>();
    const register =
        (name: string) =>
        (handler: Handler): { dispose: () => void } => {
            handlers.set(name, handler);
            return { dispose: () => undefined };
        };

    const sendRequest = vi.fn().mockResolvedValue(null);
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const sendDiagnostics = vi.fn().mockResolvedValue(undefined);
    const consoleInfo = vi.fn();
    const consoleError = vi.fn();

    const connection = {
        onInitialize: register('onInitialize'),
        onInitialized: register('onInitialized'),
        onShutdown: register('onShutdown'),
        onExit: register('onExit'),
        onDidChangeWatchedFiles: register('onDidChangeWatchedFiles'),
        onDidOpenTextDocument: register('onDidOpenTextDocument'),
        onDidChangeTextDocument: register('onDidChangeTextDocument'),
        onDidCloseTextDocument: register('onDidCloseTextDocument'),
        onHover: register('onHover'),
        onCompletion: register('onCompletion'),
        onCompletionResolve: register('onCompletionResolve'),
        onDefinition: register('onDefinition'),
        onReferences: register('onReferences'),
        onDocumentHighlight: register('onDocumentHighlight'),
        onSignatureHelp: register('onSignatureHelp'),
        onRenameRequest: register('onRenameRequest'),
        onPrepareRename: register('onPrepareRename'),
        onCodeAction: register('onCodeAction'),
        onDocumentLinks: register('onDocumentLinks'),
        onDocumentSymbol: register('onDocumentSymbol'),
        onFoldingRanges: register('onFoldingRanges'),
        onSelectionRanges: register('onSelectionRanges'),
        languages: {
            semanticTokens: { on: register('semanticTokens') },
        },
        console: { info: consoleInfo, error: consoleError },
        sendRequest,
        sendNotification,
        sendDiagnostics,
    } as unknown as Connection;

    return {
        connection,
        handlers,
        sendRequest,
        sendNotification,
        sendDiagnostics,
        consoleInfo,
        consoleError,
        invoke(name: string, ...args: unknown[]): unknown {
            const handler = handlers.get(name);
            if (!handler) throw new Error(`no handler registered: ${name}`);
            return handler(...args);
        },
    };
}

/** Minimal `initialize` params with no workspace root. */
function initParams(over: Partial<InitializeParams> = {}): InitializeParams {
    return {
        processId: null,
        rootUri: null,
        capabilities: {},
        ...over,
    };
}

/** Drives the captured `onInitialize` handler and returns its typed result. */
async function initialize(
    h: FakeConnection,
    over: Partial<InitializeParams> = {},
): Promise<InitializeResult> {
    return (await h.invoke('onInitialize', initParams(over))) as InitializeResult;
}

/** A recorded `(method, params)` call, typed away from the mock's `any[]`. */
type MethodCall = [method: string, params?: unknown];

/** All `(method, params)` calls recorded on a `vi.fn()`. */
function callsOf(fn: MockInstance): MethodCall[] {
    return fn.mock.calls as MethodCall[];
}

/** The `params` of the most recent call to `fn` whose method is `method`. */
function lastParamsFor(fn: MockInstance, method: string): unknown {
    const call = [...callsOf(fn)].reverse().find((c) => c[0] === method);
    if (!call) throw new Error(`no call to ${method}`);
    return call[1];
}

/** The methods of every call recorded on `fn`, in order. */
function methodsOf(fn: MockInstance): string[] {
    return callsOf(fn).map((c) => c[0]);
}

/** Shape of the `sveltex/resolvedTags` notification payload. */
interface ResolvedTags {
    verbatimTags: string[];
    latexTags: string[];
    escapeTags: string[];
    codeTags: string[];
    noopTags: string[];
}

/** Opens a `.sveltex` document through the captured handler. */
function open(
    h: FakeConnection,
    uri: string,
    text: string,
    version = 1,
): void {
    h.invoke('onDidOpenTextDocument', {
        textDocument: { uri, languageId: 'sveltex', version, text },
    });
}

/** The single `SvelteProxy` the current server created. */
function getProxy(): FakeSvelteProxy {
    const proxy = proxies.at(-1);
    if (!proxy) throw new Error('no SvelteProxy was constructed');
    return proxy;
}

/** The single `RegionForwarder` the current server created. */
function getForwarder(): FakeRegionForwarder {
    const forwarder = forwarders.at(-1);
    if (!forwarder) throw new Error('no RegionForwarder was constructed');
    return forwarder;
}

/** The first armed config watcher. */
function getWatcher(): import('node:fs').FSWatcher {
    const watcher = watchers[0];
    if (!watcher) throw new Error('no watcher was armed');
    return watcher;
}

beforeEach(() => {
    proxies.length = 0;
    forwarders.length = 0;
    watchers.length = 0;
    loadConfigSnapshot.mockReset();
    loadConfigSnapshot.mockResolvedValue(defaultConfigSnapshot());
    // Keep the real dependency-scan implementation (set in the mock factory);
    // clear only the call record. Throwing tests use `mockImplementationOnce`.
    collectConfigDependenciesMock.mockClear();
});

// ---------------------------------------------------------------------------
// initialize / initialized
// ---------------------------------------------------------------------------

describe('initialize', () => {
    it('initializes without a workspace folder (built-in defaults)', async () => {
        const h = makeConnection();
        createServer(h.connection);
        const result = await initialize(h);
        // No workspace root → config never loaded, watchers never armed.
        expect(loadConfigSnapshot).not.toHaveBeenCalled();
        // The forwarder still gets the (default) config.
        expect(forwarders[0]?.updateConfig).toHaveBeenCalledOnce();
        // Native capabilities are always advertised.
        expect(result.capabilities.textDocumentSync).toBeDefined();
        expect(result.capabilities.hoverProvider).toBe(true);
        expect(result.capabilities.documentSymbolProvider).toBe(true);
        expect(result.serverInfo?.name).toBe('sveltex-language-server');
        // Default (non-vscode) client → semantic tokens advertised.
        expect(result.capabilities.semanticTokensProvider).toBeDefined();
        // Trigger characters always include `\` and `{`.
        const triggers =
            result.capabilities.completionProvider?.triggerCharacters ?? [];
        expect(triggers).toContain('\\');
        expect(triggers).toContain('{');
    });

    it('loads config and arms watchers when a workspace folder is present', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-srv-'));
        writeFileSync(join(dir, 'svelte.config.js'), 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath: join(dir, 'svelte.config.js'),
        });
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [
                        { uri: `file://${dir}`, name: 'ws' },
                    ],
                });
            expect(loadConfigSnapshot).toHaveBeenCalledOnce();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("does not advertise semantic tokens for client 'vscode'", async () => {
        const h = makeConnection();
        createServer(h.connection);
        const result = await initialize(h, { initializationOptions: { client: 'vscode' } });
        expect(result.capabilities.semanticTokensProvider).toBeUndefined();
    });

    it('folds in the child completion trigger characters and proxied capabilities', async () => {
        const h = makeConnection();
        createServer(h.connection);
        // The proxy instance exists after `createServer` ran; configure its
        // `start()` to resolve with a rich capability set.
        const proxy = getProxy();
        proxy.start.mockResolvedValue({
            capabilities: {
                completionProvider: { triggerCharacters: ['.', '@'] },
                definitionProvider: true,
                referencesProvider: true,
                documentLinkProvider: { resolveProvider: false },
                // An explicitly-undefined capability must be dropped by
                // `pickDefined`, not surface as `present-and-undefined`.
                renameProvider: undefined,
            },
        });
        const result = await initialize(h);
        const triggers =
            result.capabilities.completionProvider?.triggerCharacters ?? [];
        expect(triggers).toEqual(expect.arrayContaining(['.', '@', '\\', '{']));
        expect(result.capabilities.definitionProvider).toBe(true);
        expect(result.capabilities.referencesProvider).toBe(true);
        expect(result.capabilities.documentLinkProvider).toEqual({
            resolveProvider: false,
        });
        // `renameProvider` was undefined → omitted entirely.
        expect('renameProvider' in result.capabilities).toBe(false);
    });

    it('logs an error and degrades when the Svelte child fails to start', async () => {
        const h = makeConnection();
        createServer(h.connection);
        getProxy().start.mockRejectedValue(new Error('spawn failed'));
        const result = await initialize(h);
        expect(h.consoleError).toHaveBeenCalledWith(
            expect.stringContaining('Failed to start svelte-language-server'),
        );
        // Native capabilities still advertised even with no child.
        expect(result.capabilities.hoverProvider).toBe(true);
        // No proxied capabilities (child gave none).
        expect(result.capabilities.definitionProvider).toBeUndefined();
    });

    it('forwards the resolved server paths to the proxy and forwarder', async () => {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h, {
                initializationOptions: {
                    serverPaths: {
                        svelteLanguageServer: '/abs/svelte.js',
                        mathLanguageServer: '/abs/math.js',
                    },
                },
            });
        expect(getProxy().setServerPath).toHaveBeenCalledWith('/abs/svelte.js');
        expect(getForwarder().setMathServerPath).toHaveBeenCalledWith(
            '/abs/math.js',
        );
    });
});

describe('logInfo wiring', () => {
    it('routes child-server log lines to the output channel, tagged', async () => {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        // `logInfo` is the `ForwarderLog` handed to the RegionForwarder; the
        // fake captured it as `.log`. Invoking it exercises the closure.
        getForwarder().log?.('math server started');
        expect(h.consoleInfo).toHaveBeenCalledWith(
            '[sveltex] math server started',
        );
    });
});

describe('initialized', () => {
    it('pushes the resolved tag list', async () => {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        h.invoke('onInitialized', {});
        const tags = lastParamsFor(
            h.sendNotification,
            'sveltex/resolvedTags',
        ) as ResolvedTags;
        expect(tags.verbatimTags).toContain('tex');
        expect(tags.latexTags).toContain('tex');
    });
});

// ---------------------------------------------------------------------------
// Document synchronization
// ---------------------------------------------------------------------------

describe('document synchronization', () => {
    async function ready(): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        getProxy().isRunning = true;
        return h;
    }

    it('opens a `.sveltex` document and forwards didOpen to the proxy', async () => {
        const h = await ready();
        open(h, 'file:///doc.sveltex', '# Title\n');
        const params = lastParamsFor(
            getProxy().sendNotification,
            'textDocument/didOpen',
        );
        expect(params).toMatchObject({
            textDocument: {
                uri: 'file:///doc.sveltex.svelte',
                languageId: 'svelte',
            },
        });
    });

    it('ignores a non-`.sveltex` document on open', async () => {
        const h = await ready();
        getProxy().sendNotification.mockClear();
        open(h, 'file:///other.txt', 'hi');
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('forwards a full-text change to the proxy', async () => {
        const h = await ready();
        open(h, 'file:///doc.sveltex', 'a');
        getProxy().sendNotification.mockClear();
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri: 'file:///doc.sveltex', version: 2 },
            contentChanges: [{ text: '# New\n' }],
        });
        const params = lastParamsFor(
            getProxy().sendNotification,
            'textDocument/didChange',
        );
        expect(params).toMatchObject({ textDocument: { version: 2 } });
    });

    it('ignores a change to a non-`.sveltex` URI', async () => {
        const h = await ready();
        getProxy().sendNotification.mockClear();
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri: 'file:///x.txt', version: 2 },
            contentChanges: [{ text: 'whatever' }],
        });
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('ignores a change to an unopened document', async () => {
        const h = await ready();
        getProxy().sendNotification.mockClear();
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri: 'file:///never-opened.sveltex', version: 2 },
            contentChanges: [{ text: 'x' }],
        });
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('ignores a change with no content entries', async () => {
        const h = await ready();
        open(h, 'file:///doc.sveltex', 'a');
        getProxy().sendNotification.mockClear();
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri: 'file:///doc.sveltex', version: 2 },
            contentChanges: [],
        });
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('ignores a change whose last entry has no `text` field', async () => {
        const h = await ready();
        open(h, 'file:///doc.sveltex', 'a');
        getProxy().sendNotification.mockClear();
        // A ranged change without a `text` property (not Full sync) is skipped.
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri: 'file:///doc.sveltex', version: 2 },
            contentChanges: [
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 0 },
                    },
                },
            ],
        });
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('closes a `.sveltex` document and forwards didClose', async () => {
        const h = await ready();
        open(h, 'file:///doc.sveltex', 'a');
        getProxy().sendNotification.mockClear();
        h.invoke('onDidCloseTextDocument', {
            textDocument: { uri: 'file:///doc.sveltex' },
        });
        expect(getProxy().sendNotification).toHaveBeenCalledWith(
            'textDocument/didClose',
            expect.objectContaining({
                textDocument: { uri: 'file:///doc.sveltex.svelte' },
            }),
        );
    });

    it('ignores a close of a non-`.sveltex` URI', async () => {
        const h = await ready();
        getProxy().sendNotification.mockClear();
        h.invoke('onDidCloseTextDocument', {
            textDocument: { uri: 'file:///x.txt' },
        });
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
    });

    it('respects a custom extensions list (and its empty-list fallback)', async () => {
        // Config with an empty `extensions` list → falls back to `.sveltex`.
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            extensions: [],
        });
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-ext-'));
        writeFileSync(join(dir, 'svelte.config.js'), 'export default {};\n');
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            getProxy().isRunning = true;
            // `.sveltex` still recognised via the default fallback.
            open(h, 'file:///fallback.sveltex', '# Hi\n');
            expect(getProxy().sendNotification).toHaveBeenCalledWith(
                'textDocument/didOpen',
                expect.anything(),
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Proxied, position-mapped language features
// ---------------------------------------------------------------------------

describe('proxied position requests', () => {
    const URI = 'file:///doc.sveltex';

    async function withDoc(text: string): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        getProxy().isRunning = true;
        open(h, URI, text);
        return h;
    }

    const mappable = { line: 0, character: 0 }; // start of a markdown doc maps
    // A document with a trailing non-LaTeX `<verb>` region. `<verb>` is an
    // `escape` tag, so the region is blanked out of the virtual document AND is
    // NOT forwardable — a position inside it therefore reaches
    // `proxyPositionRequest` and fails to map, exercising the "dropped" path.
    const MIXED = 'Hello world\n<verb>raw text</verb>\n';
    const unmappable = { line: 1, character: 8 }; // inside the `<verb>` body

    it('hover: forwards a mapped position and remaps the result', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().sendRequest.mockResolvedValue({
            contents: 'docs',
        });
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(getProxy().sendRequest).toHaveBeenCalledWith(
            'textDocument/hover',
            expect.objectContaining({
                textDocument: { uri: 'file:///doc.sveltex.svelte' },
            }),
        );
        // No range → remapHover returns the hover as-is.
        expect(hover).toEqual({ contents: 'docs' });
    });

    it('hover: forwards a math region to the region forwarder', async () => {
        const h = await withDoc('$\\alpha$\n');
        getForwarder().forwardHover.mockResolvedValue({ contents: 'math' });
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: { line: 0, character: 3 }, // inside `$…$`
        });
        expect(getForwarder().forwardHover).toHaveBeenCalled();
        expect(hover).toEqual({ contents: 'math' });
        // The Svelte proxy was NOT consulted for a forwarded region.
        expect(getProxy().sendRequest).not.toHaveBeenCalled();
    });

    it('hover: forwards a LaTeX verbatim region to the region forwarder', async () => {
        const h = await withDoc('<tex>\\draw</tex>\n');
        getForwarder().forwardHover.mockResolvedValue({ contents: 'tex' });
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: { line: 0, character: 7 }, // inside `<tex>…`
        });
        expect(getForwarder().forwardHover).toHaveBeenCalled();
        expect(hover).toEqual({ contents: 'tex' });
    });

    it('hover: answers a frontmatter region natively', async () => {
        const h = await withDoc('---\ntitle: x\n---\n# H\n');
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: { line: 1, character: 2 }, // on the `title` key
        });
        // Native frontmatter hover answered without the proxy or forwarder.
        expect(getForwarder().forwardHover).not.toHaveBeenCalled();
        expect(getProxy().sendRequest).not.toHaveBeenCalled();
        expect(hover).not.toBeNull();
    });

    it('hover: returns null when the position does not map', async () => {
        // A position inside a blanked, non-forwardable `<verb>` region maps to
        // nothing, so the proxied hover is dropped.
        const h = await withDoc(MIXED);
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: unmappable,
        });
        expect(hover).toBeNull();
    });

    it('hover: a caret at the very end of the document lands in the last region', async () => {
        // `'text $\alpha$'` ends with a math region; a caret exactly at the
        // document end falls through `regionAt`'s loop to `.at(-1)` — the math
        // region — which is forwardable.
        const h = await withDoc('text $\\alpha$');
        getForwarder().forwardHover.mockResolvedValue({ contents: 'end' });
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: { line: 0, character: 13 }, // offset === text.length
        });
        expect(getForwarder().forwardHover).toHaveBeenCalled();
        expect(hover).toEqual({ contents: 'end' });
    });

    it('hover: returns null when the document is unknown', async () => {
        const h = await withDoc('Plain.\n');
        const hover = await h.invoke('onHover', {
            textDocument: { uri: 'file:///unknown.sveltex' },
            position: mappable,
        });
        expect(hover).toBeNull();
    });

    it('hover: returns null when the proxy is not running', async () => {
        const h = await withDoc('Plain.\n');
        getProxy().isRunning = false;
        const hover = await h.invoke('onHover', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(hover).toBeNull();
    });

    it('completion: forwards a mapped position and remaps', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().sendRequest.mockResolvedValue([{ label: 'foo' }]);
        const result = await h.invoke('onCompletion', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(Array.isArray(result)).toBe(true);
    });

    it('completion: returns null when the document is unknown', async () => {
        // No region lookup happens (the `if (doc)` guard is false); the request
        // falls through to `proxyPositionRequest`, which has no document.
        const h = await withDoc('Hello world\n');
        const result = await h.invoke('onCompletion', {
            textDocument: { uri: 'file:///unknown.sveltex' },
            position: mappable,
        });
        expect(result).toBeNull();
    });

    it('completion: forwards a math region (marked native)', async () => {
        const h = await withDoc('$\\alpha$\n');
        getForwarder().forwardCompletion.mockResolvedValue([
            { label: '\\alpha' },
        ]);
        const result = await h.invoke('onCompletion', {
            textDocument: { uri: URI },
            position: { line: 0, character: 3 },
        });
        const items = Array.isArray(result) ? result : [];
        expect(items[0]).toMatchObject({
            label: '\\alpha',
            data: { sveltexOrigin: 'sveltex-native' },
        });
    });

    it('completion: answers a frontmatter region natively', async () => {
        const h = await withDoc('---\ntitle: x\n---\n# H\n');
        const result = await h.invoke('onCompletion', {
            textDocument: { uri: URI },
            position: { line: 1, character: 2 },
        });
        // Native frontmatter completion, not the proxy.
        expect(getProxy().sendRequest).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
    });

    it('completion: returns null when the position does not map', async () => {
        const h = await withDoc(MIXED);
        const result = await h.invoke('onCompletion', {
            textDocument: { uri: URI },
            position: unmappable,
        });
        expect(result).toBeNull();
    });

    it('completionResolve: returns a native item unchanged', async () => {
        const h = await withDoc('Plain.\n');
        const item = {
            label: 'x',
            data: { sveltexOrigin: 'sveltex-native' },
        };
        const resolved = await h.invoke(
            'onCompletionResolve',
            item,
        );
        expect(resolved).toBe(item);
        expect(getProxy().sendRequest).not.toHaveBeenCalled();
    });

    it('completionResolve: returns the item unchanged when proxy is down', async () => {
        const h = await withDoc('Plain.\n');
        getProxy().isRunning = false;
        const item = { label: 'x' };
        const resolved = await h.invoke(
            'onCompletionResolve',
            item,
        );
        expect(resolved).toBe(item);
    });

    it('completionResolve: forwards a genuine Svelte item to the child', async () => {
        const h = await withDoc('Plain.\n');
        getProxy().sendRequest.mockResolvedValue({
            label: 'x',
            detail: 'resolved',
        });
        const resolved = await h.invoke(
            'onCompletionResolve',
            { label: 'x' },
        );
        expect(getProxy().sendRequest).toHaveBeenCalledWith(
            'completionItem/resolve',
            { label: 'x' },
        );
        expect(resolved).toEqual({ label: 'x', detail: 'resolved' });
    });

    it('definition: maps a result and drops it when proxy is down', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().sendRequest.mockResolvedValue(null);
        const def = await h.invoke('onDefinition', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(def).toBeNull();
        getProxy().isRunning = false;
        const def2 = await h.invoke('onDefinition', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(def2).toBeNull();
    });

    it('references: maps a result; null when unmapped', async () => {
        const h = await withDoc(MIXED);
        getProxy().sendRequest.mockResolvedValue([]);
        const refs = await h.invoke('onReferences', {
            textDocument: { uri: URI },
            position: mappable,
            context: { includeDeclaration: true },
        });
        expect(refs).toEqual([]);
        const refsNull = await h.invoke('onReferences', {
            textDocument: { uri: URI },
            position: unmappable,
            context: { includeDeclaration: true },
        });
        expect(refsNull).toBeNull();
    });

    it('documentHighlight: maps a result; null when unmapped', async () => {
        const h = await withDoc(MIXED);
        getProxy().sendRequest.mockResolvedValue([]);
        const hl = await h.invoke('onDocumentHighlight', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(hl).toEqual([]);
        const hlNull = await h.invoke('onDocumentHighlight', {
            textDocument: { uri: URI },
            position: unmappable,
        });
        expect(hlNull).toBeNull();
    });

    it('signatureHelp: maps a result; null when unmapped', async () => {
        const h = await withDoc(MIXED);
        getProxy().sendRequest.mockResolvedValue({ signatures: [] });
        const sig = await h.invoke('onSignatureHelp', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(sig).toEqual({ signatures: [] });
        const sigNull = await h.invoke('onSignatureHelp', {
            textDocument: { uri: URI },
            position: unmappable,
        });
        expect(sigNull).toBeNull();
    });

    it('rename: maps a workspace edit; null when unmapped', async () => {
        const h = await withDoc(MIXED);
        getProxy().sendRequest.mockResolvedValue({ changes: {} });
        const edit = await h.invoke('onRenameRequest', {
            textDocument: { uri: URI },
            position: mappable,
            newName: 'y',
        });
        expect(edit).not.toBeNull();
        const editNull = await h.invoke('onRenameRequest', {
            textDocument: { uri: URI },
            position: unmappable,
            newName: 'y',
        });
        expect(editNull).toBeNull();
    });

    it('prepareRename: null when unmapped, null when result is null, maps a bare Range', async () => {
        const h = await withDoc(MIXED);
        // (a) unmapped position → null
        const a = await h.invoke('onPrepareRename', {
            textDocument: { uri: URI },
            position: unmappable,
        });
        expect(a).toBeNull();
        // (b) proxy returns null → null
        getProxy().sendRequest.mockResolvedValue(null);
        const b = await h.invoke('onPrepareRename', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(b).toBeNull();
        // (c) proxy returns a bare Range that maps back to source
        getProxy().sendRequest.mockResolvedValue({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
        });
        const c = await h.invoke('onPrepareRename', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(c).not.toBeNull();
        // (d) proxy returns a Range that lands in the blanked region → it
        // fails to map back, so the `?? null` fallback is taken.
        getProxy().sendRequest.mockResolvedValue({
            start: { line: 1, character: 0 },
            end: { line: 1, character: 5 },
        });
        const d = await h.invoke('onPrepareRename', {
            textDocument: { uri: URI },
            position: mappable,
        });
        expect(d).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Code action & document links
// ---------------------------------------------------------------------------

describe('code action', () => {
    const URI = 'file:///doc.sveltex';

    async function withDoc(text: string): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        getProxy().isRunning = true;
        open(h, URI, text);
        return h;
    }

    it('returns null when the document is unknown', async () => {
        const h = await withDoc('Hello world\n');
        const result = await h.invoke('onCodeAction', {
            textDocument: { uri: 'file:///nope.sveltex' },
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
            },
            context: { diagnostics: [] },
        });
        expect(result).toBeNull();
    });

    it('returns null when the proxy is down', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().isRunning = false;
        const result = await h.invoke('onCodeAction', {
            textDocument: { uri: URI },
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
            },
            context: { diagnostics: [] },
        });
        expect(result).toBeNull();
    });

    it('returns null when the range does not map (non-delegated region)', async () => {
        const h = await withDoc('$\\alpha$\n');
        const result = await h.invoke('onCodeAction', {
            textDocument: { uri: URI },
            // A range entirely inside the blanked `$…$` math region.
            range: {
                start: { line: 0, character: 2 },
                end: { line: 0, character: 5 },
            },
            context: { diagnostics: [] },
        });
        expect(result).toBeNull();
    });

    it('maps the range + context diagnostics and remaps the result', async () => {
        // `'Hello world\n<verb>raw text</verb>\n'`: a markdown line 0 (mappable)
        // and a blanked, non-forwardable `<verb>` region on line 1 (unmappable).
        const h = await withDoc('Hello world\n<verb>raw text</verb>\n');
        getProxy().sendRequest.mockResolvedValue([]);
        const result = await h.invoke('onCodeAction', {
            textDocument: { uri: URI },
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 },
            },
            context: {
                diagnostics: [
                    {
                        // A diagnostic in a delegated range → mapped.
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 5 },
                        },
                        message: 'keep me',
                    },
                    {
                        // A diagnostic inside the blanked `<verb>` body → its
                        // range fails to map and the diagnostic is dropped.
                        range: {
                            start: { line: 1, character: 8 },
                            end: { line: 1, character: 10 },
                        },
                        message: 'drop me',
                    },
                ],
            },
        });
        const params = lastParamsFor(
            getProxy().sendRequest,
            'textDocument/codeAction',
        );
        // The range was mapped to the virtual URI, and only the mappable
        // diagnostic survived (the one in the blanked region was dropped).
        expect(params).toMatchObject({
            textDocument: { uri: 'file:///doc.sveltex.svelte' },
            context: { diagnostics: [{ message: 'keep me' }] },
        });
        const { context } = params as {
            context: { diagnostics: unknown[] };
        };
        expect(context.diagnostics).toHaveLength(1);
        expect(result).toEqual([]);
    });
});

describe('document links', () => {
    const URI = 'file:///doc.sveltex';

    async function withDoc(text: string): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        getProxy().isRunning = true;
        open(h, URI, text);
        return h;
    }

    it('returns null when the document is unknown', async () => {
        const h = await withDoc('Hello world\n');
        const result = await h.invoke('onDocumentLinks', {
            textDocument: { uri: 'file:///nope.sveltex' },
        });
        expect(result).toBeNull();
    });

    it('returns null when the proxy is down', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().isRunning = false;
        const result = await h.invoke('onDocumentLinks', {
            textDocument: { uri: URI },
        });
        expect(result).toBeNull();
    });

    it('forwards to the proxy and remaps', async () => {
        const h = await withDoc('Hello world\n');
        getProxy().sendRequest.mockResolvedValue([]);
        const result = await h.invoke('onDocumentLinks', {
            textDocument: { uri: URI },
        });
        expect(getProxy().sendRequest).toHaveBeenCalledWith(
            'textDocument/documentLink',
            { textDocument: { uri: 'file:///doc.sveltex.svelte' } },
        );
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Native Markdown features + semantic tokens
// ---------------------------------------------------------------------------

describe('native Markdown features', () => {
    const URI = 'file:///doc.sveltex';

    async function withDoc(text: string): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        open(h, URI, text);
        return h;
    }

    it('documentSymbol: returns symbols for a known doc, null otherwise', async () => {
        const h = await withDoc('# Title\n\n## Section\n');
        const symbols = h.invoke('onDocumentSymbol', {
            textDocument: { uri: URI },
        });
        expect(Array.isArray(symbols)).toBe(true);
        const none = h.invoke('onDocumentSymbol', {
            textDocument: { uri: 'file:///nope.sveltex' },
        });
        expect(none).toBeNull();
    });

    it('foldingRanges: returns ranges for a known doc, null otherwise', async () => {
        const h = await withDoc('# A\ntext\n\n# B\ntext\n');
        const ranges = h.invoke('onFoldingRanges', {
            textDocument: { uri: URI },
        });
        expect(Array.isArray(ranges)).toBe(true);
        const none = h.invoke('onFoldingRanges', {
            textDocument: { uri: 'file:///nope.sveltex' },
        });
        expect(none).toBeNull();
    });

    it('selectionRanges: returns ranges for a known doc, null otherwise', async () => {
        const h = await withDoc('# Title\n\ntext\n');
        const ranges = h.invoke('onSelectionRanges', {
            textDocument: { uri: URI },
            positions: [{ line: 0, character: 2 }],
        });
        expect(Array.isArray(ranges)).toBe(true);
        const none = h.invoke('onSelectionRanges', {
            textDocument: { uri: 'file:///nope.sveltex' },
            positions: [{ line: 0, character: 0 }],
        });
        expect(none).toBeNull();
    });

    it('semanticTokens: returns tokens for a known doc, empty otherwise', async () => {
        // Configure escape tags so there is something to tokenize.
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            verbatimTags: ['verb'],
            escapeTags: ['verb'],
        });
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-sem-'));
        writeFileSync(join(dir, 'svelte.config.js'), 'export default {};\n');
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            open(h, URI, '<verb>literal</verb>\n');
            const tokens = h.invoke('semanticTokens', {
                textDocument: { uri: URI },
            }) as { data: number[] };
            expect(tokens.data).toBeInstanceOf(Array);
            // Unknown doc → empty token set, not null.
            const empty = h.invoke('semanticTokens', {
                textDocument: { uri: 'file:///nope.sveltex' },
            }) as { data: number[] };
            expect(empty).toEqual({ data: [] });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Child notifications routed back out
// ---------------------------------------------------------------------------

describe('child notification handling', () => {
    const URI = 'file:///doc.sveltex';

    async function ready(): Promise<FakeConnection> {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        getProxy().isRunning = true;
        return h;
    }

    it('maps and re-emits publishDiagnostics for an open doc', async () => {
        const h = await ready();
        open(h, URI, 'Hello world\n');
        // Simulate the child pushing diagnostics on the virtual `.svelte` URI.
        getProxy().handlers.onNotification(
            PublishDiagnosticsNotification.method,
            {
                uri: 'file:///doc.sveltex.svelte',
                version: 3,
                diagnostics: [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 5 },
                        },
                        message: 'oops',
                    },
                ],
            },
        );
        expect(h.sendDiagnostics).toHaveBeenCalledWith(
            expect.objectContaining({
                uri: URI,
                version: 3,
            }),
        );
    });

    it('maps publishDiagnostics without a version field', async () => {
        const h = await ready();
        open(h, URI, 'Hello world\n');
        getProxy().handlers.onNotification(
            PublishDiagnosticsNotification.method,
            { uri: 'file:///doc.sveltex.svelte', diagnostics: [] },
        );
        const call = h.sendDiagnostics.mock.calls.at(-1)?.[0] as Record<
            string,
            unknown
        >;
        expect(call['uri']).toBe(URI);
        expect('version' in call).toBe(false);
    });

    it('drops publishDiagnostics for an unknown doc', async () => {
        const h = await ready();
        getProxy().handlers.onNotification(
            PublishDiagnosticsNotification.method,
            { uri: 'file:///never.svelte', diagnostics: [] },
        );
        expect(h.sendDiagnostics).not.toHaveBeenCalled();
    });

    it('passes a non-diagnostics notification straight through', async () => {
        const h = await ready();
        getProxy().handlers.onNotification('window/logMessage', {
            message: 'hi',
        });
        expect(h.sendNotification).toHaveBeenCalledWith('window/logMessage', {
            message: 'hi',
        });
    });

    it('relays a child-originated server-to-client request', async () => {
        const h = await ready();
        h.sendRequest.mockResolvedValue({ ok: true });
        const out = await getProxy().handlers.onRequest(
            'client/registerCapability',
            { registrations: [] },
        );
        expect(h.sendRequest).toHaveBeenCalledWith(
            'client/registerCapability',
            { registrations: [] },
        );
        expect(out).toEqual({ ok: true });
    });
});

// ---------------------------------------------------------------------------
// Config reload (watched files, debounce, single-flight, resync)
// ---------------------------------------------------------------------------

describe('config reload', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    /** Boots a server with a real workspace dir + config file. */
    async function boot(): Promise<{
        h: FakeConnection;
        dir: string;
        configPath: string;
    }> {
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-reload-'));
        const configPath = join(dir, 'svelte.config.js');
        writeFileSync(configPath, 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath,
        });
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h, {
                workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
            });
        getProxy().isRunning = true;
        return { h, dir, configPath };
    }

    it('ignores watched-file events with no workspace root', async () => {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        loadConfigSnapshot.mockClear();
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.advanceTimersByTimeAsync(300);
        expect(loadConfigSnapshot).not.toHaveBeenCalled();
    });

    it('debounces a burst of watched-file events into one reload', async () => {
        const { h, dir } = await boot();
        loadConfigSnapshot.mockClear();
        // Three events in quick succession → one trailing reload.
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.advanceTimersByTimeAsync(250);
        expect(loadConfigSnapshot).toHaveBeenCalledOnce();
        rmSync(dir, { recursive: true, force: true });
    });

    it('coalesces an event arriving mid-reload into one trailing pass', async () => {
        const { h, dir } = await boot();
        loadConfigSnapshot.mockClear();
        // Make the first reload hang so a second event lands while in-flight.
        let releaseFirst: () => void = () => undefined;
        const firstGate = new Promise<void>((r) => {
            releaseFirst = r;
        });
        loadConfigSnapshot
            .mockImplementationOnce(async () => {
                await firstGate;
                return { ...defaultConfigSnapshot() };
            })
            .mockResolvedValue({ ...defaultConfigSnapshot() });

        // Kick the first reload.
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.advanceTimersByTimeAsync(200);
        // First reload is now in flight (awaiting firstGate). Fire another
        // burst — it must be queued, not started concurrently.
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.advanceTimersByTimeAsync(200);
        // Release the first; the pump should then drain the queued pass.
        releaseFirst();
        await vi.runAllTimersAsync();
        // Exactly two loads total: the first and the single coalesced trailing.
        expect(loadConfigSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2);
        rmSync(dir, { recursive: true, force: true });
    });

    it('resyncs open documents on reload (close + reopen in the proxy)', async () => {
        const { h, dir } = await boot();
        open(h, 'file:///doc.sveltex', '# Title\n');
        getProxy().sendNotification.mockClear();
        loadConfigSnapshot.mockResolvedValue({ ...defaultConfigSnapshot() });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.runAllTimersAsync();
        // The resync closes then reopens the virtual document.
        const methods = methodsOf(getProxy().sendNotification);
        expect(methods).toContain('textDocument/didClose');
        expect(methods).toContain('textDocument/didOpen');
        // And the client is told the (possibly new) tag list.
        expect(h.sendNotification).toHaveBeenCalledWith(
            'sveltex/resolvedTags',
            expect.anything(),
        );
        rmSync(dir, { recursive: true, force: true });
    });

    it('resync skips a document closed before its iteration is reached', async () => {
        const { h, dir } = await boot();
        open(h, 'file:///a.sveltex', '# A\n');
        open(h, 'file:///b.sveltex', '# B\n');
        // While the resync processes `a` (the first URI in the snapshot),
        // simulate the editor closing `b` — so when the loop reaches `b`, its
        // `documents.get(b)` misses and the `!existing` guard fires.
        let closedB = false;
        // A synchronous void return is fine: the server `await`s this
        // notification, and `await undefined` resolves immediately.
        getProxy().sendNotification.mockImplementation((method: string): void => {
            if (!closedB && method === 'textDocument/didClose') {
                closedB = true;
                h.invoke('onDidCloseTextDocument', {
                    textDocument: { uri: 'file:///b.sveltex' },
                });
            }
        });
        // Drop the initial opens' notifications so only resync-era calls count.
        getProxy().sendNotification.mockClear();
        loadConfigSnapshot.mockResolvedValue({ ...defaultConfigSnapshot() });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.runAllTimersAsync();
        // No throw; `b` was closed before its turn so it is never re-opened.
        expect(closedB).toBe(true);
        const opens = callsOf(getProxy().sendNotification).filter((c) => {
            if (c[0] !== 'textDocument/didOpen') return false;
            const params = c[1] as { textDocument?: { uri?: string } };
            return params.textDocument?.uri === 'file:///b.sveltex.svelte';
        });
        expect(opens.length).toBe(0);
        rmSync(dir, { recursive: true, force: true });
    });

    it('resync TOCTOU: a didClose between close and reopen skips the reopen', async () => {
        const { h, dir } = await boot();
        open(h, 'file:///doc.sveltex', '# Title\n');
        // Simulate the editor closing the doc *between* the awaited proxy
        // close and the re-open: the close notification handler removes the
        // entry, so the `!documents.has` guard fires and the reopen is skipped.
        // A one-shot flag prevents the re-entrant close from recursing (the
        // editor-close itself issues another `textDocument/didClose`).
        let injected = false;
        getProxy().sendNotification.mockImplementation((method: string): void => {
            if (method === 'textDocument/didClose' && !injected) {
                injected = true;
                h.invoke('onDidCloseTextDocument', {
                    textDocument: { uri: 'file:///doc.sveltex' },
                });
            }
        });
        // Drop the initial open's notification so only resync-era calls count.
        getProxy().sendNotification.mockClear();
        loadConfigSnapshot.mockResolvedValue({ ...defaultConfigSnapshot() });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.runAllTimersAsync();
        // The reopen for this doc must not have fired: the doc was gone by the
        // time the resync re-checked liveness after its `proxyDidClose` await.
        const opens = methodsOf(getProxy().sendNotification).filter(
            (m) => m === 'textDocument/didOpen',
        );
        expect(opens.length).toBe(0);
        rmSync(dir, { recursive: true, force: true });
    });

    it('resync stops re-opening when the proxy goes down mid-pass', async () => {
        const { h, dir } = await boot();
        open(h, 'file:///doc.sveltex', '# Title\n');
        // Proxy stops running before the resync runs → resync `continue`s past
        // every doc without notifying.
        getProxy().isRunning = false;
        getProxy().sendNotification.mockClear();
        loadConfigSnapshot.mockResolvedValue({ ...defaultConfigSnapshot() });
        h.invoke('onDidChangeWatchedFiles', { changes: [] });
        await vi.runAllTimersAsync();
        expect(getProxy().sendNotification).not.toHaveBeenCalled();
        rmSync(dir, { recursive: true, force: true });
    });
});

// ---------------------------------------------------------------------------
// Watcher rearm (real fs.watch)
// ---------------------------------------------------------------------------

describe('watcher rearm + real fs.watch', () => {
    it('arms a real watcher that fires a reload on a matching filename', async () => {
        // Real timers + real `fs.watch`: this is the one test that exercises
        // the genuine watcher callback (`names.has(filename)` → schedule).
        vi.useRealTimers();
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-watch-'));
        const configPath = join(dir, 'svelte.config.js');
        writeFileSync(configPath, 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath,
        });
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h, {
                workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
            });
        getProxy().isRunning = true;
        loadConfigSnapshot.mockClear();
        try {
            // Touch the watched config file → the real fs watcher schedules a
            // debounced (200 ms) reload. Poll until it fires.
            writeFileSync(configPath, 'export default { changed: true };\n');
            await vi.waitFor(
                () => {
                    expect(loadConfigSnapshot).toHaveBeenCalled();
                },
                { timeout: 4000, interval: 25 },
            );
        } finally {
            // Shut down (clears the debounce timer, closes the watcher) and let
            // any trailing debounced reload settle, so no async tail survives
            // into v8 coverage finalization.
            await h.invoke('onShutdown');
            await new Promise<void>((r) => {
                setTimeout(r, 350);
            });
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('does not arm watchers when the config has no path', async () => {
        // `loadConfigSnapshot` returns a snapshot with `configPath: undefined`
        // even though a workspace root exists → `rearmConfigWatchers` returns
        // early without creating any watcher.
        vi.useRealTimers();
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-nopath-'));
        writeFileSync(join(dir, 'svelte.config.js'), 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath: undefined,
        });
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            // No watcher armed; shutdown is still clean.
            await h.invoke('onShutdown');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('falls back to watching the config file when the dependency scan throws', async () => {
        // Force `collectConfigDependencies` to throw → the catch fallback uses
        // `[configPath]` and the watcher is armed on that file's real
        // directory.
        vi.useRealTimers();
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-depscan-'));
        const configPath = join(dir, 'svelte.config.js');
        writeFileSync(configPath, 'export default {};\n');
        collectConfigDependenciesMock.mockImplementationOnce(() => {
            throw new Error('scan blew up');
        });
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath,
        });
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            // The catch fallback ran (the scan was attempted once) and a
            // watcher was still armed on the config's directory.
            expect(collectConfigDependenciesMock).toHaveBeenCalledWith(
                configPath,
            );
            expect(watchers.length).toBeGreaterThan(0);
            await h.invoke('onShutdown');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('swallows a watcher `error` event', async () => {
        // The watcher's own `error` handler must not crash the server.
        vi.useRealTimers();
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-watcherr-'));
        const configPath = join(dir, 'svelte.config.js');
        writeFileSync(configPath, 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath,
        });
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            expect(watchers.length).toBeGreaterThan(0);
            // Emitting `'error'` hits the registered no-op handler; with no
            // handler this would throw as an unhandled error.
            expect(() => getWatcher().emit('error')).not.toThrow();
            await h.invoke('onShutdown');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

describe('shutdown', () => {
    it('clears the timer, closes watchers, and stops the children', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'sveltex-shutdown-'));
        const configPath = join(dir, 'svelte.config.js');
        writeFileSync(configPath, 'export default {};\n');
        loadConfigSnapshot.mockResolvedValue({
            ...defaultConfigSnapshot(),
            configPath,
        });
        try {
            const h = makeConnection();
            createServer(h.connection);
            await initialize(h, {
                    workspaceFolders: [{ uri: `file://${dir}`, name: 'ws' }],
                });
            // Schedule a reload so there is a live debounce timer to clear.
            h.invoke('onDidChangeWatchedFiles', { changes: [] });
            await h.invoke('onShutdown');
            expect(getProxy().stop).toHaveBeenCalledOnce();
            expect(getForwarder().stop).toHaveBeenCalledOnce();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('is safe to shut down with no timer and no watchers', async () => {
        const h = makeConnection();
        createServer(h.connection);
        await initialize(h);
        await h.invoke('onShutdown');
        expect(getProxy().stop).toHaveBeenCalledOnce();
    });
});
