// File description: `SvelteProxy` — spawns the real `svelte-language-server` as
// a child process and exposes a thin JSON-RPC client to it.
//
// `svelte-language-server` is not a clean embeddable library: its npm `exports`
// expose only `.` and `./bin/server.js`, and it drives TypeScript/CSS/HTML
// semantics itself. The official Svelte VS Code extension therefore spawns
// `bin/server.js` as a child process and proxies over JSON-RPC. We do the same:
// resolve `bin/server.js` from `node_modules`, `child_process.fork` it, and
// drive it over a stdio `ProtocolConnection`.

import { fork, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
// The `vscode-languageserver-protocol` package predates the npm `exports`
// field, so under `Node16` module resolution its `./node` subpath alias is not
// resolvable from TypeScript. The Node-flavoured entry point is imported via
// its concrete file path instead — that path has no `exports` gate and ships
// the stream message reader/writer plus `createProtocolConnection`.
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
 * Resolves the absolute path of `svelte-language-server`'s `bin/server.js`.
 *
 * The package's `exports` map intentionally exposes `./bin/server.js`, so a
 * plain module resolution works from this package's location — the standalone
 * and Zed scenarios, where the server runs out of `node_modules`.
 *
 * A host that has bundled `svelte-language-server` to a sibling file (the VS
 * Code extension does exactly this — see `packages/vscode-sveltex`) cannot rely
 * on `node_modules` existing and passes the bundled file's absolute path
 * explicitly via `override`.
 *
 * @param override - An explicit absolute path to use instead of resolving from
 * `node_modules`. When given, it is returned verbatim.
 * @throws If `override` is omitted and `svelte-language-server` is not
 * installed.
 */
export function resolveSvelteServerPath(override?: string): string {
    if (override) return override;
    const require = createRequire(import.meta.url);
    return require.resolve('svelte-language-server/bin/server.js');
}

/**
 * Handlers the host server registers with a {@link SvelteProxy} so that
 * messages _originating_ in the child (diagnostics, log messages, ...) can be
 * routed back out.
 */
export interface SvelteProxyHandlers {
    /**
     * Invoked for every notification the child sends (e.g.
     * `textDocument/publishDiagnostics`, `window/logMessage`).
     */
    onNotification: (method: string, params: unknown) => void;
    /**
     * Invoked for every server-to-client request the child sends (e.g.
     * `client/registerCapability`, `workspace/configuration`). The returned
     * value is sent back as the response.
     */
    onRequest: (method: string, params: unknown) => Promise<unknown>;
}

/**
 * A live connection to a child `svelte-language-server` process.
 *
 * Lifecycle: {@link SvelteProxy.start} forks the child and performs the LSP
 * `initialize` handshake; {@link SvelteProxy.sendRequest} /
 * {@link SvelteProxy.sendNotification} forward messages to it; {@link SvelteProxy.stop}
 * shuts it down gracefully.
 */
export class SvelteProxy {
    #child: ChildProcess | undefined;
    #connection: ProtocolConnection | undefined;
    #initializeResult: InitializeResult | undefined;
    readonly #handlers: SvelteProxyHandlers;
    /**
     * An explicit `svelte-language-server` `bin/server.js` path, or `undefined`
     * to resolve it from `node_modules`. Set via {@link setServerPath} before
     * {@link start}. See {@link resolveSvelteServerPath}.
     */
    #serverPathOverride: string | undefined;

    public constructor(handlers: SvelteProxyHandlers) {
        this.#handlers = handlers;
    }

    /**
     * Overrides the location of the child `svelte-language-server`.
     *
     * Standalone use (Zed, the CLI) needs no override — the server is resolved
     * from `node_modules`. A host that has bundled the server to a sibling file
     * (the VS Code extension) calls this with that file's absolute path before
     * {@link start}, since `node_modules` will not exist at runtime.
     *
     * @param serverPath - Absolute path of the child's `bin/server.js`, or
     * `undefined` to keep resolving from `node_modules`.
     */
    public setServerPath(serverPath: string | undefined): void {
        this.#serverPathOverride = serverPath;
    }

    /** The `InitializeResult` returned by the child, available after `start`. */
    public get initializeResult(): InitializeResult | undefined {
        return this.#initializeResult;
    }

    /** Whether the child process is running and initialized. */
    public get isRunning(): boolean {
        return this.#connection !== undefined;
    }

    /**
     * Forks the child `svelte-language-server` and completes the `initialize`
     * handshake.
     *
     * @param initializeParams - The `initialize` params received by the host
     * server, forwarded to the child mostly unchanged (the child's root/
     * capabilities should match the host's so its TypeScript service resolves
     * the project correctly).
     * @returns The child's `InitializeResult`.
     */
    public async start(
        initializeParams: InitializeParams,
    ): Promise<InitializeResult> {
        const serverPath = resolveSvelteServerPath(this.#serverPathOverride);
        // `--node-ipc` is NOT passed: with no transport flag the child's
        // `createConnection()` defaults to stdio, which is what the stream
        // reader/writer below expect. `stdio: 'pipe'` gives us those streams.
        const child = fork(serverPath, ['--stdio'], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            execArgv: [],
        });
        this.#child = child;

        if (!child.stdout || !child.stdin) {
            throw new Error(
                'Failed to obtain stdio streams for svelte-language-server child process.',
            );
        }
        // Surface the child's stderr for debugging without crashing the host.
        child.stderr?.on('data', (chunk: Buffer) => {
            process.stderr.write(
                `[svelte-language-server] ${chunk.toString()}`,
            );
        });

        const connection = createProtocolConnection(
            new StreamMessageReader(child.stdout),
            new StreamMessageWriter(child.stdin),
        );
        this.#connection = connection;

        // Route child-originated traffic back to the host server. The catch-all
        // (method-agnostic) `onNotification(handler)` / `onRequest(handler)`
        // overloads exist on the underlying `MessageConnection` but are not
        // surfaced by the narrower `ProtocolConnection` type; the runtime object
        // is a `MessageConnection`, so registering the star handlers through
        // that view is sound.
        const starConnection = connection as unknown as MessageConnection;
        const onChildNotification: StarNotificationHandler = (
            method,
            params,
        ) => {
            this.#handlers.onNotification(method, params);
        };
        const onChildRequest: StarRequestHandler = async (method, params) => {
            return this.#handlers.onRequest(method, params);
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
            throw new Error('SvelteProxy is not running.');
        }
        return this.#connection.sendRequest<R>(method, params);
    }

    /**
     * Forwards a notification to the child.
     *
     * No-op if the proxy is not running (notifications are fire-and-forget and
     * a not-yet-started child must not crash the host).
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
