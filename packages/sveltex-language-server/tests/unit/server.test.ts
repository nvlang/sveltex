// Integration tests for the SvelTeX language server (`src/core/server.ts`).
//
// The whole server is spawned as a child process and driven end to end: the
// `initialize` handshake, region-aware request routing, and the math-region
// forwarding are all exercised. Two transports are covered — stdio (the bulk
// of the tests) and Node IPC (the transport the `vscode-sveltex` extension's
// `vscode-languageclient` uses), so the path the VS Code extension actually
// takes is verified too. The embedded `svelte-language-server` the SvelTeX
// server spawns is incidental here.

import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    IPCMessageReader,
    IPCMessageWriter,
    StreamMessageReader,
    StreamMessageWriter,
    createProtocolConnection,
    type MessageConnection,
    type ProtocolConnection,
} from 'vscode-languageserver-protocol/lib/node/main.js';
import type {
    CompletionItem,
    CompletionList,
    DocumentSymbol,
    Hover,
    InitializeResult,
    SemanticTokens,
} from 'vscode-languageserver-protocol';

/** Absolute path of the compiled `bin/server.js`. */
const SERVER_BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'bin',
    'server.js',
);

/** Live verbatim tag list pushed to the client via `sveltex/resolvedTags`. */
interface ResolvedTags {
    verbatimTags: string[];
    latexTags: string[];
}

/** A spawned SvelTeX language server and its stdio LSP connection. */
interface Spawned {
    connection: ProtocolConnection;
    child: ChildProcess;
    initializeResult: InitializeResult;
    /** Resolves with the first `sveltex/resolvedTags` notification. */
    firstResolvedTags: Promise<ResolvedTags>;
}

/**
 * Attaches no-op `'error'` listeners to a spawned server and its pipes.
 *
 * A server killed during teardown can make Node emit `'error'` events on the
 * child process or its stdio streams (e.g. `EPIPE` when a message is written
 * to an already-exiting child). Without listeners those become unhandled
 * errors that fail the whole test file even though every test passed.
 */
function silenceChildErrors(child: ChildProcess): void {
    child.on('error', () => undefined);
    child.stdin?.on('error', () => undefined);
    child.stdout?.on('error', () => undefined);
    child.stderr?.on('error', () => undefined);
}

/** Spawns `bin/server.js` and completes the `initialize` handshake. */
async function spawn(): Promise<Spawned> {
    const child = fork(SERVER_BIN, ['--stdio'], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        execArgv: [],
    });
    silenceChildErrors(child);
    if (!child.stdout || !child.stdin) {
        throw new Error('child process is missing stdio streams');
    }
    const connection = createProtocolConnection(
        new StreamMessageReader(child.stdout),
        new StreamMessageWriter(child.stdin),
    );
    // Swallow child-originated traffic (diagnostics, log messages, the
    // embedded server's registration requests). The catch-all
    // `onNotification`/`onRequest` overloads live on `MessageConnection`, not
    // the narrower `ProtocolConnection` view — the runtime object is a
    // `MessageConnection`, so this cast is sound.
    const star = connection as unknown as MessageConnection;
    // Capture the first `sveltex/resolvedTags` notification before the
    // catch-all swallows everything — method-specific handlers in
    // vscode-jsonrpc take precedence over the catch-all.
    let resolveFirstTags: (tags: ResolvedTags) => void;
    const firstResolvedTags = new Promise<ResolvedTags>((resolve) => {
        resolveFirstTags = resolve;
    });
    star.onNotification('sveltex/resolvedTags', (params: unknown) => {
        resolveFirstTags(params as ResolvedTags);
    });
    star.onNotification(() => undefined);
    star.onRequest(() => null);
    connection.listen();
    const initializeResult = await connection.sendRequest<InitializeResult>(
        'initialize',
        {
            processId: process.pid,
            rootUri: null,
            workspaceFolders: null,
            capabilities: {},
        },
    );
    await connection.sendNotification('initialized', {});
    return { connection, child, initializeResult, firstResolvedTags };
}

/** Resolves after `ms` milliseconds. */
async function delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Shuts a spawned server down.
 *
 * The graceful LSP `shutdown`/`exit` is raced against a short timeout: the
 * server forks its own `svelte-language-server` child, which can be slow to
 * wind down under load, and teardown must never hang the test. Whatever the
 * race outcome, the connection is disposed and the child force-killed.
 */
async function stop(server: Spawned): Promise<void> {
    try {
        await Promise.race([
            server.connection.sendRequest('shutdown').then(async () => {
                await server.connection.sendNotification('exit');
            }),
            delay(2_000),
        ]);
    } catch {
        // Already gone, or the graceful shutdown lost the race.
    }
    server.connection.dispose();
    server.child.kill();
}

/** Opens a `.sveltex` document and waits out the server's reparse debounce. */
async function open(server: Spawned, uri: string, text: string): Promise<void> {
    await server.connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri, languageId: 'sveltex', version: 1, text },
    });
    // `server.ts` debounces reparses (150 ms); wait comfortably past it.
    await delay(350);
}

/** Normalises a completion response to a flat item array. */
function items(
    result: CompletionItem[] | CompletionList | null,
): CompletionItem[] {
    if (!result) return [];
    return Array.isArray(result) ? result : result.items;
}

describe('SvelTeX language server (spawned over stdio)', () => {
    let server: Spawned;

    beforeAll(async () => {
        server = await spawn();
    });

    afterAll(async () => {
        await stop(server);
    });

    it('advertises `\\` and `{` as completion trigger characters', () => {
        const triggers =
            server.initializeResult.capabilities.completionProvider
                ?.triggerCharacters ?? [];
        expect(triggers).toContain('\\');
        expect(triggers).toContain('{');
    });

    it('advertises the native Markdown feature providers', () => {
        const caps = server.initializeResult.capabilities;
        expect(caps.documentSymbolProvider).toBe(true);
        expect(caps.foldingRangeProvider).toBe(true);
        expect(caps.selectionRangeProvider).toBe(true);
    });

    it('reports its server name', () => {
        expect(server.initializeResult.serverInfo?.name).toBe(
            'sveltex-language-server',
        );
    });

    it('computes a heading outline as document symbols', async () => {
        const uri = 'file:///tmp/symbols.sveltex';
        await open(server, uri, '# Title\n\n## Section\n\ntext\n');
        const symbols = await server.connection.sendRequest<
            DocumentSymbol[] | null
        >('textDocument/documentSymbol', { textDocument: { uri } });
        expect(symbols?.length).toBeGreaterThan(0);
        expect(symbols?.[0]?.name).toContain('Title');
    });

    it('forwards completion inside a `$…$` math region to the math server', async () => {
        const uri = 'file:///tmp/math.sveltex';
        // `$\alp$` — caret right after `\alp` (line 0, character 16).
        await open(server, uri, 'Inline math: $\\alp$ here.\n');
        const result = await server.connection.sendRequest<
            CompletionItem[] | CompletionList | null
        >('textDocument/completion', {
            textDocument: { uri },
            position: { line: 0, character: 18 },
        });
        expect(items(result).map((i) => i.label)).toContain('\\alpha');
    });

    it('forwards hover inside a `$$…$$` math region', async () => {
        const uri = 'file:///tmp/math-hover.sveltex';
        await open(server, uri, '$$\\frac{1}{2}$$\n');
        // Hover over `\frac` (inside `$$…$$`, after the two opening dollars).
        const hover = await server.connection.sendRequest<Hover | null>(
            'textDocument/hover',
            {
                textDocument: { uri },
                position: { line: 0, character: 4 },
            },
        );
        expect(hover).not.toBeNull();
        // The hover range maps back to `.sveltex` coordinates: `\frac` begins
        // at character 2 (just past `$$`).
        expect(hover?.range?.start.character).toBe(2);
    });

    it('offers environment names for `\\begin{` inside a math region', async () => {
        const uri = 'file:///tmp/math-env.sveltex';
        await open(server, uri, '$$\\begin{ali$$\n');
        const result = await server.connection.sendRequest<
            CompletionItem[] | CompletionList | null
        >('textDocument/completion', {
            textDocument: { uri },
            position: { line: 0, character: 12 },
        });
        const labels = items(result).map((i) => i.label);
        // `aligned` is a math environment; the bare name is inserted.
        expect(labels).toContain('aligned');
    });

    it('does not forward completion in a plain Markdown region to the math server', async () => {
        const uri = 'file:///tmp/markdown.sveltex';
        await open(server, uri, 'Just plain prose, no math.\n');
        // A Markdown region is routed to the embedded Svelte server, not the
        // math server. That server may be slow to answer for a file outside a
        // real project, so race the request against a short timeout: either
        // outcome proves the request did NOT take the instant math path —
        // and if it does resolve, it must not carry the math server's `\`
        // commands.
        const completion = server.connection.sendRequest<
            CompletionItem[] | CompletionList | null
        >('textDocument/completion', {
            textDocument: { uri },
            position: { line: 0, character: 5 },
        });
        const timeout = delay(2_000).then(() => 'timeout' as const);
        const outcome = await Promise.race([completion, timeout]);
        if (outcome !== 'timeout') {
            expect(items(outcome).map((i) => i.label)).not.toContain('\\alpha');
        }
    });

    it('advertises a semantic-tokens provider with a non-empty legend', () => {
        const provider =
            server.initializeResult.capabilities.semanticTokensProvider;
        expect(provider).toBeDefined();
        // `SemanticTokensProvider` is `{ legend, full?, range? }` in the
        // protocol types; narrow it before reading the legend.
        if (!provider || !('legend' in provider)) {
            throw new Error('semantic-tokens provider missing legend');
        }
        expect(provider.legend.tokenTypes.length).toBeGreaterThan(0);
        expect(provider.legend.tokenTypes).toContain('string');
        // `full: true` (not just an options object) is what the
        // `vscode-languageclient` reference impl requires for end-to-end
        // requests to fire.
        expect(provider.full).toBeTruthy();
    });

    it('returns an empty token stream for the built-in `<tex>` tag', async () => {
        // The five standard verbatim tags (`tex`/`latex`/`tikz`/`verb`/
        // `verbatim`) are intentionally skipped by the encoder: the editor
        // grammar already paints their bodies (LaTeX or fenced-code), and
        // a uniform `string` semantic token would replace that with a flat
        // colour. This test pins that contract — the request still succeeds
        // (returns an empty data array, not `null`) so the wire path is
        // alive; the unit tests in `semantic-tokens.test.ts` cover the
        // emitting path against custom tags.
        const uri = 'file:///tmp/semtok-tex.sveltex';
        await open(server, uri, '<tex>\n\\node {x};\n</tex>\n');
        const result = await server.connection.sendRequest<SemanticTokens>(
            'textDocument/semanticTokens/full',
            { textDocument: { uri } },
        );
        expect(result).not.toBeNull();
        expect(result.data).toEqual([]);
    });

    it('pushes `sveltex/resolvedTags` after `initialized`', async () => {
        // Race the notification against a timeout: receiving it proves the
        // server pushes its tag list to the client. The values match the
        // built-in defaults (no SvelTeX config was loaded — rootUri is null).
        const tags = await Promise.race([
            server.firstResolvedTags,
            delay(2_000).then(() => null),
        ]);
        expect(tags).not.toBeNull();
        expect(tags?.verbatimTags).toEqual(
            expect.arrayContaining(['tex', 'verbatim']),
        );
        expect(tags?.latexTags).toEqual(expect.arrayContaining(['tex']));
    });
});

describe('SvelTeX language server — Node IPC transport', () => {
    // The `vscode-sveltex` extension launches `bin/server.js` with
    // `vscode-languageclient`'s `TransportKind.ipc`, which forks the server
    // with a `--node-ipc` argument and an IPC channel. This block reproduces
    // exactly that launch, so the transport the VS Code extension relies on is
    // verified — not just the stdio path.
    let server: Spawned;

    beforeAll(async () => {
        const child = fork(SERVER_BIN, ['--node-ipc'], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            execArgv: [],
        });
        silenceChildErrors(child);
        const connection = createProtocolConnection(
            new IPCMessageReader(child),
            new IPCMessageWriter(child),
        );
        const star = connection as unknown as MessageConnection;
        let resolveFirstTags: (tags: ResolvedTags) => void;
        const firstResolvedTags = new Promise<ResolvedTags>((resolve) => {
            resolveFirstTags = resolve;
        });
        star.onNotification('sveltex/resolvedTags', (params: unknown) => {
            resolveFirstTags(params as ResolvedTags);
        });
        star.onNotification(() => undefined);
        star.onRequest(() => null);
        connection.listen();
        const initializeResult = await connection.sendRequest<InitializeResult>(
            'initialize',
            {
                processId: process.pid,
                rootUri: null,
                workspaceFolders: null,
                capabilities: {},
            },
        );
        await connection.sendNotification('initialized', {});
        server = { connection, child, initializeResult, firstResolvedTags };
    });

    afterAll(async () => {
        await stop(server);
    });

    it('completes the initialize handshake over IPC', () => {
        expect(server.initializeResult.serverInfo?.name).toBe(
            'sveltex-language-server',
        );
    });

    it('answers math completion over the IPC transport', async () => {
        const uri = 'file:///tmp/ipc-math.sveltex';
        await open(server, uri, 'Math: $\\bet$ done.\n');
        const result = await server.connection.sendRequest<
            CompletionItem[] | CompletionList | null
        >('textDocument/completion', {
            textDocument: { uri },
            position: { line: 0, character: 11 },
        });
        expect(items(result).map((i) => i.label)).toContain('\\beta');
    });
});
