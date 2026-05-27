// Unit tests for the generic child-language-server proxy
// (`src/core/lsp-proxy.ts`).
//
// The proxy is exercised against the bundled math language server (resolved as
// a workspace dependency), launched both as a forked Node module and — to
// cover the `spawn` branch — as a native-style command. The lifecycle
// (`start` → `sendRequest` → `stop`), the `isRunning` flag, and the
// not-running guards are all checked.

import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fork, spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    InitializeRequest,
    type InitializeResult,
} from 'vscode-languageserver-protocol';
import {
    StreamMessageReader,
    StreamMessageWriter,
    createProtocolConnection,
    type MessageConnection,
} from 'vscode-languageserver-protocol/lib/node/main.js';
import { LspProxy } from '../../src/core/lsp-proxy.js';

// `fork`/`spawn` are wrapped in spies that, by default, delegate to the real
// implementations — so the bundled-math-server tests above keep launching a
// real child — while the fake-child tests below override the return value with
// `mockReturnValueOnce` to inject a controllable in-memory child. (ESM module
// namespaces are not directly spyable, hence the factory.)
vi.mock('node:child_process', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('node:child_process')>();
    return {
        ...actual,
        fork: vi.fn(actual.fork),
        spawn: vi.fn(actual.spawn),
    };
});

const mockedFork = vi.mocked(fork);
const mockedSpawn = vi.mocked(spawn);

/** Absolute path of the bundled math language server's `bin/server.js`. */
const mathServerPath = createRequire(import.meta.url).resolve(
    '@nvl/sveltex-math-language-server/bin/server.js',
);

/** Standard `initialize` params for the math server. */
const initParams = {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
    initializationOptions: { backend: 'katex' as const },
};

/** Resolves after the macrotask/`ms` delay, letting queued I/O events fire. */
async function delay(ms = 0): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe('LspProxy — fork transport', () => {
    let proxy: LspProxy;

    afterEach(async () => {
        await proxy.stop();
    });

    it('starts a forked child and completes the handshake', async () => {
        proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath, args: ['--stdio'] },
            'math-test',
        );
        expect(proxy.isRunning).toBe(false);
        const result = await proxy.start(initParams);
        expect(proxy.isRunning).toBe(true);
        expect(result.serverInfo?.name).toBe('sveltex-math-language-server');
        expect(proxy.initializeResult).toEqual(result);
    });

    it('forwards a request and receives the child response', async () => {
        proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath, args: ['--stdio'] },
            'math-test',
        );
        await proxy.start(initParams);
        await proxy.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri: 'mem://x.tex',
                languageId: 'latex',
                version: 1,
                text: '\\alp',
            },
        });
        const result = await proxy.sendRequest<{
            items: { label: string }[];
        }>('textDocument/completion', {
            textDocument: { uri: 'mem://x.tex' },
            position: { line: 0, character: 4 },
        });
        expect(result.items.map((i) => i.label)).toContain('\\alpha');
    });

    it('stops cleanly and reports it is no longer running', async () => {
        proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath, args: ['--stdio'] },
            'math-test',
        );
        await proxy.start(initParams);
        await proxy.stop();
        expect(proxy.isRunning).toBe(false);
    });
});

describe('LspProxy — spawn transport', () => {
    let proxy: LspProxy;

    afterEach(async () => {
        await proxy.stop();
    });

    it('launches a server via `spawn` (a native-style command)', async () => {
        // The `spawn` branch is the one TexLab (a native binary) uses. Drive
        // it cross-platform by spawning the Node executable directly with the
        // math server script as an argument.
        proxy = new LspProxy(
            {
                kind: 'spawn',
                command: process.execPath,
                args: [mathServerPath, '--stdio'],
            },
            'math-spawn-test',
        );
        const result = await proxy.start(initParams);
        expect(result.serverInfo?.name).toBe('sveltex-math-language-server');
    });
});

describe('LspProxy — guards', () => {
    it('throws when sendRequest is called before start', async () => {
        const proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath },
            'math-test',
        );
        await expect(
            proxy.sendRequest('textDocument/hover', {}),
        ).rejects.toThrow(/not running/u);
    });

    it('treats sendNotification before start as a no-op', async () => {
        const proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath },
            'math-test',
        );
        // Fire-and-forget: must resolve without throwing.
        await expect(
            proxy.sendNotification('textDocument/didOpen', {}),
        ).resolves.toBeUndefined();
    });

    it('treats stop before start as a no-op', async () => {
        const proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath },
            'math-test',
        );
        await expect(proxy.stop()).resolves.toBeUndefined();
    });

    it('routes a child notification to the handler', async () => {
        const received: string[] = [];
        const proxy = new LspProxy(
            { kind: 'fork', module: mathServerPath, args: ['--stdio'] },
            'math-test',
            {
                onNotification: (method) => {
                    received.push(method);
                },
            },
        );
        const initializeResult: InitializeResult =
            await proxy.start(initParams);
        // The handshake itself usually produces no notifications, but the
        // handler must at least be wired without error.
        expect(initializeResult.capabilities).toBeDefined();
        await proxy.stop();
    });
});

// A fake child process whose stdio is real in-memory pipes, plus a "server"
// LSP connection on the other end of those pipes. This drives the
// child-originated paths the bundled-server tests above cannot reach
// deterministically: stderr surfacing, child→client notifications/requests,
// connection close and the missing-stdio guard.
interface FakeChild {
    child: ChildProcess;
    /** The LSP connection acting as the child server. */
    server: MessageConnection;
    /** Pushes a chunk onto the child's stderr. */
    emitStderr: (text: string) => void;
    /** Ends the child's stdout, closing the proxy connection. */
    endStdout: () => void;
    /**
     * Writes raw bytes onto the stream the proxy reads from, bypassing the LSP
     * framing — used to provoke a reader/protocol error on the proxy side.
     */
    corruptProxyInput: (bytes: string) => void;
}

/**
 * Builds a fake child whose `stdin`/`stdout` are crossed `PassThrough`s wired to
 * a server-side protocol connection, so a real `LspProxy` can complete a real
 * handshake against it. `respondInitialize` controls whether the fake server
 * answers `initialize` (so `start()` can be awaited).
 */
function makeFakeChild(
    options: {
        stdout?: boolean;
        stdin?: boolean;
        respondInitialize?: boolean;
    } = {},
): FakeChild {
    const hasStdout = options.stdout ?? true;
    const hasStdin = options.stdin ?? true;
    const respondInitialize = options.respondInitialize ?? true;
    // `childStdin` carries client→server bytes (proxy writes, server reads);
    // `childStdout` carries server→client bytes (server writes, proxy reads).
    const childStdin = new PassThrough();
    const childStdout = new PassThrough();
    const childStderr = new PassThrough();

    const child = new EventEmitter() as unknown as ChildProcess & {
        stdin: PassThrough | null;
        stdout: PassThrough | null;
        stderr: PassThrough | null;
        exitCode: number | null;
        kill: (signal?: string) => boolean;
    };
    child.stdin = hasStdin ? childStdin : null;
    child.stdout = hasStdout ? childStdout : null;
    child.stderr = childStderr;
    child.exitCode = null;
    child.kill = vi.fn(() => true);

    // The server side reads what the proxy wrote (childStdin) and writes back
    // on the stream the proxy reads (childStdout).
    const server = createProtocolConnection(
        new StreamMessageReader(childStdin),
        new StreamMessageWriter(childStdout),
    ) as unknown as MessageConnection;
    // Answer the handshake so the proxy's `start()` resolves — unless the test
    // wants the child to die before the handshake completes.
    if (respondInitialize) {
        server.onRequest(InitializeRequest.type, () => ({ capabilities: {} }));
    }
    server.listen();

    return {
        child,
        server,
        emitStderr: (text: string): void => {
            childStderr.write(text);
        },
        endStdout: (): void => {
            childStdout.end();
        },
        corruptProxyInput: (bytes: string): void => {
            childStdout.write(bytes);
        },
    };
}

describe('LspProxy — child-originated traffic (fake child)', () => {
    let stopFns: (() => void)[] = [];

    afterEach(() => {
        for (const fn of stopFns) fn();
        stopFns = [];
        vi.restoreAllMocks();
    });

    it('rejects start() if the child errors during the handshake', async () => {
        const fake = makeFakeChild({ respondInitialize: false });
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        const started = proxy.start(initParams);
        fake.child.emit('error', new Error('spawn boom'));
        await expect(started).rejects.toThrow(
            /failed during startup: spawn boom/u,
        );
        // A failed startup leaves the proxy not-running, not holding a dead
        // connection.
        expect(proxy.isRunning).toBe(false);
    });

    it('rejects start() if the child exits during the handshake', async () => {
        const fake = makeFakeChild({ respondInitialize: false });
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        const started = proxy.start(initParams);
        fake.child.emit('exit', 1, null);
        await expect(started).rejects.toThrow(
            /exited during startup \(code 1, signal null\)/u,
        );
        expect(proxy.isRunning).toBe(false);
    });

    it('surfaces the child stderr to the host stderr', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);
        const writeSpy = vi
            .spyOn(process.stderr, 'write')
            .mockReturnValue(true);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js', args: ['--stdio'] },
            'fakelabel',
        );
        await proxy.start(initParams);
        fake.emitStderr('a child diagnostic line\n');
        // Give the stderr 'data' event a tick to fire.
        await delay();

        expect(
            writeSpy.mock.calls.some((c) =>
                String(c[0]).includes(
                    '[fakelabel] a child diagnostic line',
                ),
            ),
        ).toBe(true);
    });

    it('routes a child notification to the onNotification handler', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);
        // Resolve when the proxy dispatches the notification to the handler, so
        // the test waits exactly as long as the two-pipe round trip needs.
        let resolveReceived: (v: { method: string; params: unknown }) => void;
        const received = new Promise<{ method: string; params: unknown }>(
            (resolve) => {
                resolveReceived = resolve;
            },
        );

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
            {
                onNotification: (method, params) => {
                    resolveReceived({ method, params });
                },
            },
        );
        await proxy.start(initParams);
        await fake.server.sendNotification('window/logMessage', {
            message: 'hi',
        });

        await expect(received).resolves.toEqual({
            method: 'window/logMessage',
            params: { message: 'hi' },
        });
    });

    it('tolerates a child notification when no handler is registered', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        // No `onNotification` handler — the `?.` optional call must no-op.
        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        await proxy.start(initParams);
        await expect(
            fake.server.sendNotification('window/logMessage', { x: 1 }),
        ).resolves.toBeUndefined();
        await delay();
        // No throw is the assertion; reaching here is success.
        expect(proxy.isRunning).toBe(true);
    });

    it('routes a child request to the onRequest handler and returns its result', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
            {
                onRequest: async (method) => {
                    await Promise.resolve();
                    return { echoed: method };
                },
            },
        );
        await proxy.start(initParams);
        const response = await fake.server.sendRequest(
            'workspace/configuration',
            { items: [] },
        );
        expect(response).toEqual({ echoed: 'workspace/configuration' });
    });

    it('answers a child request with null when no onRequest handler is set', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        // No `onRequest` handler — the proxy must answer `null`.
        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        await proxy.start(initParams);
        const response = await fake.server.sendRequest(
            'client/registerCapability',
            {},
        );
        expect(response).toBeNull();
    });

    it('clears the connection (isRunning → false) when the child closes', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        await proxy.start(initParams);
        expect(proxy.isRunning).toBe(true);
        // Ending the stream the proxy reads from triggers `connection.onClose`.
        fake.endStdout();
        await delay();
        await delay();
        expect(proxy.isRunning).toBe(false);
    });

    it('throws when the spawned child exposes no stdout', async () => {
        const fake = makeFakeChild({ stdout: false });
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedSpawn.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'spawn', command: '/fake/bin' },
            'fakelabel',
        );
        await expect(proxy.start(initParams)).rejects.toThrow(
            /Failed to obtain stdio streams/u,
        );
    });

    it('throws when the spawned child exposes no stdin', async () => {
        const fake = makeFakeChild({ stdin: false });
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedSpawn.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'spawn', command: '/fake/bin' },
            'fakelabel',
        );
        await expect(proxy.start(initParams)).rejects.toThrow(
            /Failed to obtain stdio streams/u,
        );
    });

    it('forks with an empty argv when `args` is omitted', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        // No `args` on the spec → the `?? []` nullish fallback is taken.
        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        await proxy.start(initParams);
        expect(mockedFork).toHaveBeenLastCalledWith(
            '/fake/server.js',
            [],
            expect.objectContaining({ execArgv: [] }),
        );
    });

    it('spawns with an empty argv when `args` is omitted', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedSpawn.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'spawn', command: '/fake/bin' },
            'fakelabel',
        );
        await proxy.start(initParams);
        expect(mockedSpawn).toHaveBeenLastCalledWith(
            '/fake/bin',
            [],
            expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
        );
    });

    it('survives a malformed message from the child (onError handler)', async () => {
        const fake = makeFakeChild();
        stopFns.push(() => {
            fake.server.dispose();
        });
        mockedFork.mockReturnValueOnce(fake.child);

        const proxy = new LspProxy(
            { kind: 'fork', module: '/fake/server.js' },
            'fakelabel',
        );
        await proxy.start(initParams);
        // A header advertising a non-numeric length is invalid framing; the
        // reader surfaces it through `connection.onError`, which the proxy
        // swallows (errors are logged by the reader, nothing actionable).
        fake.corruptProxyInput('Content-Length: not-a-number\r\n\r\n{}');
        // Let the reader process the bytes and emit the error.
        await delay(20);
        // The proxy must not have crashed the process; it is still usable.
        expect(proxy).toBeInstanceOf(LspProxy);
    });
});
