// Unit + integration tests for the server core (`src/core/server.ts`).
//
// `resolveBackend` is tested directly. The full server is tested by spawning
// the real `bin/server.js` as a child process and speaking LSP with it over
// stdio — the same way `@nvl/sveltex-language-server` (and any editor) drives
// it — so the `initialize` handshake, capabilities, document sync and the
// completion/hover handlers are all exercised end to end.

import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    StreamMessageReader,
    StreamMessageWriter,
    createProtocolConnection,
    type ProtocolConnection,
} from 'vscode-languageserver-protocol/lib/node/main.js';
import type {
    CompletionList,
    Hover,
    InitializeResult,
} from 'vscode-languageserver-protocol';
import { resolveBackend } from '../../src/core/server.js';

describe('resolveBackend', () => {
    it('reads `katex` from initializationOptions', () => {
        expect(
            resolveBackend({
                processId: null,
                rootUri: null,
                capabilities: {},
                initializationOptions: { backend: 'katex' },
            }),
        ).toBe('katex');
    });

    it('reads `mathjax` from initializationOptions', () => {
        expect(
            resolveBackend({
                processId: null,
                rootUri: null,
                capabilities: {},
                initializationOptions: { backend: 'mathjax' },
            }),
        ).toBe('mathjax');
    });

    it('defaults to mathjax when no backend is given', () => {
        expect(
            resolveBackend({
                processId: null,
                rootUri: null,
                capabilities: {},
            }),
        ).toBe('mathjax');
    });

    it('defaults to mathjax for an unrecognised backend value', () => {
        expect(
            resolveBackend({
                processId: null,
                rootUri: null,
                capabilities: {},
                initializationOptions: { backend: 'plaintex' },
            }),
        ).toBe('mathjax');
    });

    it('defaults to mathjax when initializationOptions is not an object', () => {
        expect(
            resolveBackend({
                processId: null,
                rootUri: null,
                capabilities: {},
                initializationOptions: 'nonsense',
            }),
        ).toBe('mathjax');
    });
});

/** Absolute path of the compiled `bin/server.js`. */
const SERVER_BIN = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'bin',
    'server.js',
);

/** A live stdio LSP connection to a spawned math language server. */
interface SpawnedServer {
    connection: ProtocolConnection;
    child: ChildProcess;
}

/** Spawns `bin/server.js` and completes the `initialize` handshake. */
async function spawnServer(
    backend: 'katex' | 'mathjax',
): Promise<{ server: SpawnedServer; initializeResult: InitializeResult }> {
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
    connection.listen();
    const initializeResult = await connection.sendRequest<InitializeResult>(
        'initialize',
        {
            processId: process.pid,
            rootUri: null,
            capabilities: {},
            initializationOptions: { backend },
        },
    );
    await connection.sendNotification('initialized', {});
    return { server: { connection, child }, initializeResult };
}

/** Shuts a spawned server down gracefully. */
async function stopServer(server: SpawnedServer): Promise<void> {
    try {
        await server.connection.sendRequest('shutdown');
        await server.connection.sendNotification('exit');
    } catch {
        // The child may already be gone.
    }
    server.connection.dispose();
    if (server.child.exitCode === null) server.child.kill();
}

describe('server (spawned over stdio)', () => {
    let katexServer: SpawnedServer;
    let mathjaxServer: SpawnedServer;
    let katexInit: InitializeResult;

    beforeAll(async () => {
        const katex = await spawnServer('katex');
        const mathjax = await spawnServer('mathjax');
        katexServer = katex.server;
        mathjaxServer = mathjax.server;
        katexInit = katex.initializeResult;
    });

    afterAll(async () => {
        await stopServer(katexServer);
        await stopServer(mathjaxServer);
    });

    it('advertises completion (on `\\` and `{`) and hover capabilities', () => {
        const caps = katexInit.capabilities;
        expect(caps.hoverProvider).toBe(true);
        expect(caps.completionProvider?.triggerCharacters).toEqual(['\\', '{']);
    });

    it('reports its server name', () => {
        expect(katexInit.serverInfo?.name).toBe('sveltex-math-language-server');
    });

    it('answers completion for an opened document', async () => {
        const uri = 'mem://completion.tex';
        await katexServer.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId: 'latex',
                version: 1,
                text: '\\alp',
            },
        });
        const result = await katexServer.connection.sendRequest<CompletionList>(
            'textDocument/completion',
            { textDocument: { uri }, position: { line: 0, character: 4 } },
        );
        expect(result.items.map((i) => i.label)).toContain('\\alpha');
    });

    it('answers hover for a command in an opened document', async () => {
        const uri = 'mem://hover.tex';
        await katexServer.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId: 'latex',
                version: 1,
                text: '\\frac{1}{2}',
            },
        });
        const hover = await katexServer.connection.sendRequest<Hover | null>(
            'textDocument/hover',
            { textDocument: { uri }, position: { line: 0, character: 2 } },
        );
        expect(hover).not.toBeNull();
    });

    it('tracks incremental document changes', async () => {
        const uri = 'mem://change.tex';
        await katexServer.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId: 'latex',
                version: 1,
                text: 'x',
            },
        });
        // Replace the whole text with `\bet`.
        await katexServer.connection.sendNotification(
            'textDocument/didChange',
            {
                textDocument: { uri, version: 2 },
                contentChanges: [{ text: '\\bet' }],
            },
        );
        const result = await katexServer.connection.sendRequest<CompletionList>(
            'textDocument/completion',
            { textDocument: { uri }, position: { line: 0, character: 4 } },
        );
        expect(result.items.map((i) => i.label)).toContain('\\beta');
    });

    it('returns an empty completion list for an unknown document', async () => {
        const result = await katexServer.connection.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument: { uri: 'mem://never-opened.tex' },
                position: { line: 0, character: 0 },
            },
        );
        expect(result.items).toEqual([]);
    });

    it('honours the backend: the MathJax server offers `\\ce`', async () => {
        const uri = 'mem://backend.tex';
        await mathjaxServer.connection.sendNotification(
            'textDocument/didOpen',
            {
                textDocument: {
                    uri,
                    languageId: 'latex',
                    version: 1,
                    text: '\\ce',
                },
            },
        );
        const result =
            await mathjaxServer.connection.sendRequest<CompletionList>(
                'textDocument/completion',
                { textDocument: { uri }, position: { line: 0, character: 3 } },
            );
        expect(result.items.map((i) => i.label)).toContain('\\ce');
    });
});
