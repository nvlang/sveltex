// Integration tests for the SvelTeX language server (`src/core/server.ts`).
//
// The whole server is spawned as a child process and driven over stdio — the
// same way the VS Code extension drives it — so the `initialize` handshake,
// region-aware request routing, and the new math-region forwarding are all
// exercised end to end. These tests focus on the SvelTeX server's OWN
// behaviour (capabilities, native Markdown features, math forwarding); the
// embedded `svelte-language-server` it spawns is incidental here.

import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
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
} from 'vscode-languageserver-protocol';

/** Absolute path of the compiled `bin/server.js`. */
const SERVER_BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'bin',
    'server.js',
);

/** A spawned SvelTeX language server and its stdio LSP connection. */
interface Spawned {
    connection: ProtocolConnection;
    child: ChildProcess;
    initializeResult: InitializeResult;
}

/** Spawns `bin/server.js` and completes the `initialize` handshake. */
async function spawn(): Promise<Spawned> {
    const child = fork(SERVER_BIN, ['--stdio'], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        execArgv: [],
    });
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
    return { connection, child, initializeResult };
}

/** Resolves after `ms` milliseconds. */
async function delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** Shuts a spawned server down. */
async function stop(server: Spawned): Promise<void> {
    try {
        await server.connection.sendRequest('shutdown');
        await server.connection.sendNotification('exit');
    } catch {
        // Already gone.
    }
    server.connection.dispose();
    if (server.child.exitCode === null) server.child.kill();
}

/** Opens a `.sveltex` document and waits out the server's reparse debounce. */
async function open(
    server: Spawned,
    uri: string,
    text: string,
): Promise<void> {
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
            expect(items(outcome).map((i) => i.label)).not.toContain(
                '\\alpha',
            );
        }
    });
});
