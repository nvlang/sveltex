// File description: `SvelteProxy` — a thin {@link LspProxy} adaptor for the
// embedded `svelte-language-server`.
//
// The mechanics of "spawn a child language server over stdio, do the
// `initialize` handshake, forward messages, shut down cleanly" live in
// `LspProxy` (used by the math language server and TexLab as well).
// `SvelteProxy` keeps two pieces of `svelte-language-server`-specific
// behaviour around that generic core:
//
//   1. `resolveSvelteServerPath` — locating `bin/server.js` (from a host
//      override or from `node_modules`), and
//   2. an API that lets the path be supplied *after* construction but before
//      `start()` (via {@link setServerPath}). That separation is what lets the
//      VS Code extension, which bundles the server to a sibling file, pass
//      the bundled path in `initializationOptions` once it arrives.
//
// Per-request forwarding (`sendRequest`, `sendNotification`, `stop`, …) is
// delegated straight through.
//
// `svelte-language-server` is not a clean embeddable library: its npm
// `exports` expose only `.` and `./bin/server.js`, and it drives
// TypeScript/CSS/HTML semantics itself. The official Svelte VS Code
// extension therefore spawns `bin/server.js` as a child process and proxies
// over JSON-RPC; we do the same.

import { createRequire } from 'node:module';
import type {
    InitializeParams,
    InitializeResult,
} from 'vscode-languageserver-protocol';
import { LspProxy } from './lsp-proxy.js';

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
 *
 * Both handlers are required (the host always wants to know about
 * `publishDiagnostics`, `window/logMessage`, `client/registerCapability`,
 * etc.). `LspProxyHandlers` has them optional, since not every child needs
 * them.
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
 * Lifecycle: {@link setServerPath} optionally points at a bundled
 * `bin/server.js`; {@link start} spawns the child and performs the LSP
 * `initialize` handshake; {@link sendRequest} / {@link sendNotification}
 * forward messages to it; {@link stop} shuts it down gracefully.
 */
export class SvelteProxy {
    readonly #handlers: SvelteProxyHandlers;
    /**
     * An explicit `svelte-language-server` `bin/server.js` path, or
     * `undefined` to resolve it from `node_modules`. Set via
     * {@link setServerPath} before {@link start}. See
     * {@link resolveSvelteServerPath}.
     */
    #serverPathOverride: string | undefined;
    #inner: LspProxy | undefined;

    public constructor(handlers: SvelteProxyHandlers) {
        this.#handlers = handlers;
    }

    /**
     * Overrides the location of the child `svelte-language-server`.
     *
     * Standalone use (Zed, the CLI) needs no override — the server is
     * resolved from `node_modules`. A host that has bundled the server to a
     * sibling file (the VS Code extension) calls this with that file's
     * absolute path before {@link start}, since `node_modules` will not
     * exist at runtime.
     *
     * @param serverPath - Absolute path of the child's `bin/server.js`, or
     * `undefined` to keep resolving from `node_modules`.
     */
    public setServerPath(serverPath: string | undefined): void {
        this.#serverPathOverride = serverPath;
    }

    /** The `InitializeResult` returned by the child, available after `start`. */
    public get initializeResult(): InitializeResult | undefined {
        return this.#inner?.initializeResult;
    }

    /** Whether the child process is running and initialized. */
    public get isRunning(): boolean {
        return this.#inner?.isRunning ?? false;
    }

    /**
     * Forks the child `svelte-language-server` and completes the
     * `initialize` handshake.
     *
     * @param initializeParams - The `initialize` params received by the host
     * server, forwarded to the child mostly unchanged (the child's root /
     * capabilities should match the host's so its TypeScript service
     * resolves the project correctly).
     * @returns The child's `InitializeResult`.
     */
    public async start(
        initializeParams: InitializeParams,
    ): Promise<InitializeResult> {
        const serverPath = resolveSvelteServerPath(this.#serverPathOverride);
        // Pass `--stdio` and forward the handlers verbatim; `LspProxyHandlers`
        // accepts the (more permissive) optional shape, but
        // `SvelteProxyHandlers` always provides both, so nothing is lost.
        this.#inner = new LspProxy(
            { kind: 'fork', module: serverPath, args: ['--stdio'] },
            'svelte-language-server',
            this.#handlers,
        );
        return this.#inner.start(initializeParams);
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
        if (!this.#inner) {
            throw new Error('SvelteProxy is not running.');
        }
        return this.#inner.sendRequest<R>(method, params);
    }

    /**
     * Forwards a notification to the child.
     *
     * No-op if the proxy is not running (notifications are fire-and-forget
     * and a not-yet-started child must not crash the host).
     */
    public async sendNotification(
        method: string,
        params: unknown,
    ): Promise<void> {
        if (!this.#inner) return;
        await this.#inner.sendNotification(method, params);
    }

    /**
     * Gracefully shuts the child down: LSP `shutdown` + `exit`, then
     * disposes the connection and kills the process if it has not exited.
     */
    public async stop(): Promise<void> {
        const inner = this.#inner;
        this.#inner = undefined;
        if (inner) await inner.stop();
    }
}
