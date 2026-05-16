// File description: `LspProxy` — a generic JSON-RPC client to a child language
// server, spawned over stdio.
//
// `svelte-proxy.ts` already proxies the embedded `svelte-language-server`, but
// it is specific to that one server (it resolves its `bin/server.js`). The math
// language server (`@nvl/sveltex-math-language-server`) and TexLab need the same
// "spawn a child, speak LSP over stdio" treatment, so this module factors that
// out behind a small, server-agnostic API.
//
// Two flavours of child are supported:
//
//   - a Node module run with `child_process.fork` (`--stdio`), for the bundled
//     math language server, and
//   - a native executable run with `child_process.spawn`, for the TexLab
//     binary found on `PATH`.
//
// Both end up as a `ChildProcessWithoutNullStreams`-like object exposing
// `stdin`/`stdout`/`stderr`; the proxy speaks LSP over those pipes.

import {
    fork,
    spawn,
    type ChildProcess,
} from 'node:child_process';
// `vscode-languageserver-protocol`'s `./node` subpath alias is not resolvable
// under `Node16` resolution (the package predates the npm `exports` field), so
// the Node entry point is imported via its concrete file path — the same
// approach `svelte-proxy.ts` uses.
import {
    StreamMessageReader,
    StreamMessageWriter,
    createProtocolConnection,
    type ProtocolConnection,
} from 'vscode-languageserver-protocol/lib/node/main.js';
import {
    ExitNotification,
    InitializedNotification,
    InitializeRequest,
    ShutdownRequest,
    type InitializeParams,
    type InitializeResult,
    type MessageConnection,
    type StarNotificationHandler,
    type StarRequestHandler,
} from 'vscode-languageserver-protocol';

/**
 * How a child language server is launched.
 *
 * - `fork`: run a Node module (`module`) with `child_process.fork` and a
 *   `--stdio` argument — used for the bundled math language server.
 * - `spawn`: run a native executable (`command`) with `child_process.spawn` —
 *   used for the TexLab binary.
 */
export type LspSpawnSpec =
    | { kind: 'fork'; module: string; args?: readonly string[] }
    | { kind: 'spawn'; command: string; args?: readonly string[] };

/**
 * Handlers for messages a child sends back unprompted (diagnostics, log
 * messages, server-to-client requests). Both are optional: a proxy whose child
 * never pushes notifications needs neither.
 */
export interface LspProxyHandlers {
    /** Invoked for every notification the child sends. */
    onNotification?: (method: string, params: unknown) => void;
    /** Invoked for every server-to-client request the child sends. */
    onRequest?: (method: string, params: unknown) => Promise<unknown>;
}

/**
 * A live connection to a child language server.
 *
 * Lifecycle: {@link LspProxy.start} launches the child and performs the LSP
 * `initialize` handshake; {@link LspProxy.sendRequest} /
 * {@link LspProxy.sendNotification} forward messages; {@link LspProxy.stop}
 * shuts it down gracefully.
 */
export class LspProxy {
    #child: ChildProcess | undefined;
    #connection: ProtocolConnection | undefined;
    #initializeResult: InitializeResult | undefined;
    readonly #spec: LspSpawnSpec;
    readonly #handlers: LspProxyHandlers;
    /** A short label used to prefix the child's stderr in host logs. */
    readonly #label: string;

    /**
     * @param spec - How to launch the child language server.
     * @param label - A short name for the server, used to tag its stderr.
     * @param handlers - Optional handlers for child-originated traffic.
     */
    public constructor(
        spec: LspSpawnSpec,
        label: string,
        handlers: LspProxyHandlers = {},
    ) {
        this.#spec = spec;
        this.#label = label;
        this.#handlers = handlers;
    }

    /** The `InitializeResult` the child returned (available after `start`). */
    public get initializeResult(): InitializeResult | undefined {
        return this.#initializeResult;
    }

    /** Whether the child process is running and initialized. */
    public get isRunning(): boolean {
        return this.#connection !== undefined;
    }

    /**
     * Launches the child language server and completes the `initialize`
     * handshake.
     *
     * @param initializeParams - The `initialize` params to send the child.
     * @returns The child's `InitializeResult`.
     * @throws If the child cannot be spawned or its stdio is unavailable.
     */
    public async start(
        initializeParams: InitializeParams,
    ): Promise<InitializeResult> {
        const child = this.#spawnChild();
        this.#child = child;

        if (!child.stdout || !child.stdin) {
            throw new Error(
                `Failed to obtain stdio streams for ${this.#label} child process.`,
            );
        }
        // Surface the child's stderr for debugging without crashing the host.
        child.stderr?.on('data', (chunk: Buffer) => {
            process.stderr.write(`[${this.#label}] ${chunk.toString()}`);
        });

        const connection = createProtocolConnection(
            new StreamMessageReader(child.stdout),
            new StreamMessageWriter(child.stdin),
        );
        this.#connection = connection;

        // Route child-originated traffic to the host's handlers. The catch-all
        // `onNotification`/`onRequest` overloads live on `MessageConnection`
        // but are not surfaced by the narrower `ProtocolConnection` type; the
        // runtime object is a `MessageConnection`, so this view is sound.
        const starConnection = connection as unknown as MessageConnection;
        const onChildNotification: StarNotificationHandler = (
            method,
            params,
        ) => {
            this.#handlers.onNotification?.(method, params);
        };
        const onChildRequest: StarRequestHandler = async (method, params) => {
            if (this.#handlers.onRequest) {
                return this.#handlers.onRequest(method, params);
            }
            return null;
        };
        starConnection.onNotification(onChildNotification);
        starConnection.onRequest(onChildRequest);
        connection.onClose(() => {
            this.#connection = undefined;
        });
        connection.onError(() => {
            // Errors are logged by the reader; nothing actionable here.
        });

        connection.listen();

        const result = await connection.sendRequest(
            InitializeRequest.type,
            initializeParams,
        );
        this.#initializeResult = result;
        await connection.sendNotification(InitializedNotification.type, {});
        return result;
    }

    /** Spawns the child process per {@link LspSpawnSpec}. */
    #spawnChild(): ChildProcess {
        if (this.#spec.kind === 'fork') {
            return fork(this.#spec.module, [...(this.#spec.args ?? [])], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                execArgv: [],
            });
        }
        return spawn(this.#spec.command, [...(this.#spec.args ?? [])], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }

    /**
     * Forwards a request to the child and resolves with its response.
     *
     * @throws If the proxy is not running.
     */
    public async sendRequest<R = unknown>(
        method: string,
        params: unknown,
    ): Promise<R> {
        if (!this.#connection) {
            throw new Error(`${this.#label} proxy is not running.`);
        }
        return this.#connection.sendRequest<R>(method, params);
    }

    /**
     * Forwards a notification to the child.
     *
     * No-op if the proxy is not running — notifications are fire-and-forget and
     * a not-yet-started child must not crash the host.
     */
    public async sendNotification(
        method: string,
        params: unknown,
    ): Promise<void> {
        if (!this.#connection) return;
        await this.#connection.sendNotification(method, params);
    }

    /**
     * Gracefully shuts the child down: LSP `shutdown` + `exit`, then disposes
     * the connection and kills the process if it has not exited.
     */
    public async stop(): Promise<void> {
        const connection = this.#connection;
        const child = this.#child;
        this.#connection = undefined;
        this.#child = undefined;
        if (connection) {
            try {
                await connection.sendRequest(ShutdownRequest.method);
                await connection.sendNotification(ExitNotification.method);
            } catch {
                // The child may already be gone; fall through to kill it.
            }
            connection.dispose();
        }
        if (child && child.exitCode === null) {
            child.kill();
        }
    }
}
