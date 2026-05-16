// File description: Forwards language requests that land inside a non-delegated
// region — TeX math, or a LaTeX verbatim environment — to a dedicated child
// language server, and maps the results back to `.sveltex` coordinates.
//
// `svelte-language-server` never sees these regions (they are blanked out of
// the virtual `.svelte` document). To still offer hover/completion in them:
//
//   - a `math` region is forwarded to a spawned `@nvl/sveltex-math-language-server`
//     child, started with `initializationOptions.backend` set from the
//     SvelTeX config's `mathBackend` (only `mathjax` / `katex` are forwarded —
//     `custom` / `none` mean no math server exists, so the region is skipped);
//   - a `verbatim` region whose tag is a LaTeX/TeX environment (one of the
//     configured `latexTags`) is forwarded to a spawned `texlab` child, if a
//     `texlab` binary is found on `PATH`; if it is not, forwarding is skipped
//     silently.
//
// Each region is handed to its child as its own small, standalone virtual
// document (see `region-virtual.ts`): bare TeX for the math server, bare LaTeX
// for TexLab. Requests are mapped `.sveltex` → region before forwarding;
// responses are mapped region → `.sveltex` afterwards.

import { createRequire } from 'node:module';
import type {
    CompletionItem,
    CompletionList,
    Hover,
    Position,
} from 'vscode-languageserver-protocol';
import { LspProxy } from './lsp-proxy.js';
import { findTexlab } from './texlab.js';
import { buildRegionVirtualDocument } from './region-virtual.js';
import type { Region } from './regions.js';
import type { MathBackend, SveltexConfigSnapshot } from './config.js';
import { remapCompletion, remapHover, type RemapContext } from './remap.js';

/** The math backends that have a corresponding math language server. */
const FORWARDABLE_MATH_BACKENDS: ReadonlySet<MathBackend> = new Set<MathBackend>(
    ['mathjax', 'katex'],
);

/**
 * Resolves the absolute path of the math language server's `bin/server.js`.
 *
 * `@nvl/sveltex-math-language-server` is a regular dependency of this package,
 * so a plain module resolution finds it — the standalone and Zed scenarios.
 *
 * A host that has bundled the math server to a sibling file (the VS Code
 * extension) cannot rely on `node_modules` and passes the bundled file's
 * absolute path explicitly via `override`.
 *
 * @param override - An explicit absolute path to use instead of resolving from
 * `node_modules`. When given, it is returned verbatim.
 */
function resolveMathServerPath(override?: string): string {
    if (override) return override;
    const require = createRequire(import.meta.url);
    return require.resolve('@nvl/sveltex-math-language-server/bin/server.js');
}

/**
 * Whether `region` carries a LaTeX/TeX environment, i.e. its opening tag is one
 * of the configured `latexTags` (case-insensitive, as SvelTeX tags are).
 *
 * @param source - Full text of the `.sveltex` document.
 * @param region - The region to test (only `verbatim` regions can match).
 * @param latexTags - The configured LaTeX verbatim tags.
 */
export function isLatexVerbatimRegion(
    source: string,
    region: Region,
    latexTags: readonly string[],
): boolean {
    if (region.kind !== 'verbatim') return false;
    const slice = source.slice(region.sourceStart, region.sourceEnd);
    const tagMatch = /^<\s*([a-zA-Z][-.:0-9_a-zA-Z]*)/u.exec(slice);
    if (!tagMatch) return false;
    const tag = (tagMatch[1] ?? '').toLowerCase();
    return latexTags.some((t) => t.toLowerCase() === tag);
}

/** The language request kinds this module can forward. */
type ForwardableMethod = 'textDocument/hover' | 'textDocument/completion';

/**
 * A sink for human-readable, operational log lines about the lifecycle of the
 * child language servers (TexLab and the math language server).
 *
 * Spawning a child is best-effort and was previously silent: if `texlab` was
 * not on `PATH`, or a child crashed on start, forwarding simply returned
 * nothing with no trace. The host wires this sink to the editor's output
 * channel so those outcomes are visible and diagnosable.
 */
export type ForwarderLog = (message: string) => void;

/** A {@link ForwarderLog} that discards every message. */
const noopLog: ForwarderLog = () => undefined;

/**
 * Manages the child language servers that back non-delegated regions of one
 * SvelTeX workspace, and forwards hover/completion requests to them.
 *
 * One instance is created per `createServer` call. The children are spawned
 * lazily on first use and reused for the lifetime of the server.
 */
export class RegionForwarder {
    /**
     * The math language server child, spawned lazily on the first math
     * request. This holds the in-flight spawn *promise*, not the resolved
     * proxy: a `<tex>`/`$…$` document typically triggers several region
     * requests at once, and they must all await the one spawn — caching only a
     * "spawn started" flag would let every request after the first see no
     * proxy yet and give up.
     */
    #mathProxyPromise: Promise<LspProxy | undefined> | undefined;
    /**
     * The TexLab child, spawned lazily on the first LaTeX-verbatim request.
     * Holds the in-flight spawn promise — see {@link RegionForwarder.#mathProxyPromise}.
     */
    #texlabProxyPromise: Promise<LspProxy | undefined> | undefined;
    /** The resolved SvelTeX config snapshot (backend, latex tags). */
    #config: SveltexConfigSnapshot;
    /** Monotonic counter making each forwarded virtual document URI unique. */
    #virtualDocCounter = 0;
    /**
     * An explicit `@nvl/sveltex-math-language-server` `bin/server.js` path, or
     * `undefined` to resolve it from `node_modules`. Set via
     * {@link setMathServerPath} before the math child is first spawned. See
     * {@link resolveMathServerPath}.
     */
    #mathServerPathOverride: string | undefined;

    /**
     * Sink for child-server lifecycle log lines, wired by the host to the
     * editor's output channel. Defaults to discarding them.
     */
    #log: ForwarderLog;

    /**
     * @param config - The resolved SvelTeX config snapshot. Replaceable via
     * {@link updateConfig} when the workspace config is (re)loaded.
     * @param log - Optional sink for child-server lifecycle log lines (TexLab /
     * the math server found, started, or failed). Defaults to discarding them.
     */
    public constructor(
        config: SveltexConfigSnapshot,
        log: ForwarderLog = noopLog,
    ) {
        this.#config = config;
        this.#log = log;
    }

    /** Replaces the config snapshot (e.g. after the config file is loaded). */
    public updateConfig(config: SveltexConfigSnapshot): void {
        this.#config = config;
    }

    /**
     * Overrides the location of the math language server child.
     *
     * Standalone use needs no override — the server is resolved from
     * `node_modules`. A host that has bundled the server to a sibling file (the
     * VS Code extension) calls this with that file's absolute path before any
     * math region is forwarded, since `node_modules` will not exist at runtime.
     *
     * @param serverPath - Absolute path of the math server's `bin/server.js`,
     * or `undefined` to keep resolving from `node_modules`.
     */
    public setMathServerPath(serverPath: string | undefined): void {
        this.#mathServerPathOverride = serverPath;
    }

    /**
     * Forwards a hover request that lands in `region` to the appropriate child
     * server.
     *
     * @param source - Full text of the `.sveltex` document.
     * @param sourceUri - The `.sveltex` document URI.
     * @param region - The region the request position falls in.
     * @param position - The request position, in `.sveltex` coordinates.
     * @returns The hover, mapped back to `.sveltex` coordinates, or `null` if
     * the region is not forwardable or the child has nothing to offer.
     */
    public async forwardHover(
        source: string,
        sourceUri: string,
        region: Region,
        position: Position,
    ): Promise<Hover | null> {
        const forwarded = await this.#forward<Hover | null>(
            'textDocument/hover',
            source,
            sourceUri,
            region,
            position,
        );
        if (!forwarded) return null;
        return remapHover(forwarded.result, forwarded.ctx);
    }

    /**
     * Forwards a completion request that lands in `region` to the appropriate
     * child server.
     *
     * @returns The completion result, mapped back to `.sveltex` coordinates,
     * or `null` if the region is not forwardable.
     */
    public async forwardCompletion(
        source: string,
        sourceUri: string,
        region: Region,
        position: Position,
    ): Promise<CompletionItem[] | CompletionList | null> {
        const forwarded = await this.#forward<
            CompletionItem[] | CompletionList | null
        >('textDocument/completion', source, sourceUri, region, position);
        if (!forwarded) return null;
        return remapCompletion(forwarded.result, forwarded.ctx);
    }

    /** Shuts every spawned child server down. */
    public async stop(): Promise<void> {
        // Await any in-flight spawn first so a child still starting up is not
        // leaked past `stop()`.
        const [mathProxy, texlabProxy] = await Promise.all([
            this.#mathProxyPromise,
            this.#texlabProxyPromise,
        ]);
        this.#mathProxyPromise = undefined;
        this.#texlabProxyPromise = undefined;
        await Promise.all([mathProxy?.stop(), texlabProxy?.stop()]);
    }

    /**
     * The core forward: pick the child for `region`, build a standalone
     * virtual document for the region, sync it to the child, map the request
     * position into it, send the request, and return the raw result plus the
     * `RemapContext` needed to map the response back.
     *
     * @typeParam R - The expected response shape. The LSP wire protocol is
     * untyped JSON, so `R` is a caller-supplied assertion about what the child
     * returns — hence it appears only in the return position.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    async #forward<R>(
        method: ForwardableMethod,
        source: string,
        sourceUri: string,
        region: Region,
        position: Position,
    ): Promise<{ result: R; ctx: RemapContext } | null> {
        const target = await this.#proxyForRegion(source, region);
        if (!target) return null;

        const virtual = buildRegionVirtualDocument(source, region);
        const generatedPosition =
            virtual.sourceMap.sourcePositionToGenerated(position);
        // The position can fall on a stripped delimiter/tag — unmapped. Nothing
        // to forward in that case.
        if (!generatedPosition) {
            this.#log(
                `${method}: caret is on a ${region.kind} delimiter/tag, ` +
                    'not inside the region — not forwarded.',
            );
            return null;
        }

        // A fresh URI per call keeps the child's document state from going
        // stale as region boundaries shift between edits; the child treats
        // each as an independent open/close.
        this.#virtualDocCounter += 1;
        const virtualUri = `${sourceUri}.region${String(
            this.#virtualDocCounter,
        )}${target.extension}`;

        await target.proxy.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri: virtualUri,
                languageId: target.languageId,
                version: 1,
                text: virtual.text,
            },
        });
        try {
            const result = await target.proxy.sendRequest<R>(method, {
                textDocument: { uri: virtualUri },
                position: generatedPosition,
            });
            const ctx: RemapContext = {
                sourceUri,
                virtualUri,
                sourceMap: virtual.sourceMap,
            };
            return { result, ctx };
        } finally {
            // Always release the child's copy of the document.
            await target.proxy.sendNotification('textDocument/didClose', {
                textDocument: { uri: virtualUri },
            });
        }
    }

    /**
     * Selects (lazily spawning if needed) the child server for a region, along
     * with the `languageId` / URI extension that child expects.
     *
     * @returns The child and its document metadata, or `undefined` if the
     * region is not forwardable (non-math/verbatim region, a `custom`/`none`
     * math backend, a non-LaTeX verbatim tag, or TexLab not installed).
     */
    async #proxyForRegion(
        source: string,
        region: Region,
    ): Promise<
        | { proxy: LspProxy; languageId: string; extension: string }
        | undefined
    > {
        if (region.kind === 'math') {
            const proxy = await this.#ensureMathProxy();
            if (!proxy) return undefined;
            return { proxy, languageId: 'latex', extension: '.tex' };
        }
        if (
            region.kind === 'verbatim' &&
            isLatexVerbatimRegion(source, region, this.#config.latexTags)
        ) {
            const proxy = await this.#ensureTexlabProxy();
            if (!proxy) return undefined;
            return { proxy, languageId: 'latex', extension: '.tex' };
        }
        return undefined;
    }

    /**
     * Returns the math language server proxy, spawning it on first use.
     *
     * Concurrent first-callers all await the one spawn (see
     * {@link RegionForwarder.#mathProxyPromise}).
     *
     * @returns The running proxy, or `undefined` if the configured math
     * backend has no language server (`custom` / `none`) or the spawn failed.
     */
    async #ensureMathProxy(): Promise<LspProxy | undefined> {
        // The backend check is per-call, not cached: `updateConfig` may switch
        // a `none`/`custom` project to `mathjax`/`katex` after construction.
        if (!FORWARDABLE_MATH_BACKENDS.has(this.#config.mathBackend)) {
            return undefined;
        }
        this.#mathProxyPromise ??= this.#startMathProxy();
        const proxy = await this.#mathProxyPromise;
        return proxy?.isRunning ? proxy : undefined;
    }

    /** Spawns and initializes the math language server child. */
    async #startMathProxy(): Promise<LspProxy | undefined> {
        try {
            const proxy = new LspProxy(
                {
                    kind: 'fork',
                    module: resolveMathServerPath(
                        this.#mathServerPathOverride,
                    ),
                    args: ['--stdio'],
                },
                'sveltex-math-language-server',
            );
            await proxy.start({
                processId: process.pid,
                rootUri: null,
                capabilities: {},
                // The backend is `mathjax` or `katex` here — `#ensureMathProxy`
                // already excluded the other values.
                initializationOptions: {
                    backend: this.#config.mathBackend,
                },
            });
            this.#log(
                `Math language server started (${this.#config.mathBackend}).`,
            );
            return proxy;
        } catch (error) {
            // A failed spawn must not break the rest of the language server.
            this.#log(
                'Math language server failed to start: ' +
                    (error instanceof Error ? error.message : String(error)),
            );
            return undefined;
        }
    }

    /**
     * Returns the TexLab proxy, spawning it on first use. TexLab support is
     * best-effort — a missing or unstartable `texlab` yields `undefined` — but
     * no longer silent: each outcome is logged via {@link RegionForwarder.#log}.
     *
     * Concurrent first-callers all await the one spawn (see
     * {@link RegionForwarder.#mathProxyPromise}).
     *
     * @returns The running proxy, or `undefined` if `texlab` is not on `PATH`
     * or the spawn failed.
     */
    async #ensureTexlabProxy(): Promise<LspProxy | undefined> {
        this.#texlabProxyPromise ??= this.#startTexlabProxy();
        const proxy = await this.#texlabProxyPromise;
        return proxy?.isRunning ? proxy : undefined;
    }

    /** Locates, spawns, and initializes the TexLab child. */
    async #startTexlabProxy(): Promise<LspProxy | undefined> {
        const texlabPath = findTexlab();
        if (!texlabPath) {
            this.#log(
                'TexLab not found on PATH — hover/completion in LaTeX ' +
                    'verbatim regions is disabled. Install `texlab` and make ' +
                    'sure it is on the PATH the editor process sees.',
            );
            return undefined;
        }
        try {
            this.#log(`TexLab found at ${texlabPath}; starting…`);
            const proxy = new LspProxy(
                { kind: 'spawn', command: texlabPath },
                'texlab',
            );
            await proxy.start({
                processId: process.pid,
                rootUri: null,
                capabilities: {},
            });
            this.#log('TexLab started.');
            return proxy;
        } catch (error) {
            this.#log(
                'TexLab failed to start: ' +
                    (error instanceof Error ? error.message : String(error)),
            );
            return undefined;
        }
    }
}
