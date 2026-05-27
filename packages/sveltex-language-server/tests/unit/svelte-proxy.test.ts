// Unit tests for the `svelte-language-server` adaptor (`src/core/svelte-proxy.ts`).
//
// `SvelteProxy` is a thin wrapper around the generic `LspProxy`: it resolves
// `svelte-language-server`'s `bin/server.js` (from an override or from
// `node_modules`) and delegates the per-request surface straight through. To
// keep these tests fast and free of a spawned child, `LspProxy` is module-mocked
// with a fake whose lifecycle is driven from the tests; `resolveSvelteServerPath`
// (a pure path resolver) is exercised against the real `node_modules` install.

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';
import type { InitializeParams } from 'vscode-languageserver-protocol';

/** The slice of a fake `LspProxy` instance the tests drive. */
interface FakeInstanceShape {
    running: boolean;
    initResult: unknown;
    start: MockInstance;
    sendRequest: MockInstance;
    sendNotification: MockInstance;
    stop: MockInstance;
}

/** How a fake `LspProxy` was constructed, plus the instance itself. */
interface Constructed {
    spec: unknown;
    label: string;
    handlers: unknown;
    instance: FakeInstanceShape;
}

// `vi.mock` factories are hoisted above top-level statements, so the recording
// array and the fake class are created in a `vi.hoisted` block (also hoisted).
// The fake's methods are class *fields* holding `vi.fn()`s (matching the
// `server.inprocess.test.ts` pattern) so each instance carries its own spies.
const hoisted = vi.hoisted(() => {
    const constructed: Constructed[] = [];
    return {
        constructed,
        FakeLspProxy: class implements FakeInstanceShape {
            public running = true;
            public initResult: unknown = undefined;
            public start = vi.fn().mockResolvedValue({ capabilities: {} });
            public sendRequest = vi.fn().mockResolvedValue(undefined);
            public sendNotification = vi.fn().mockResolvedValue(undefined);
            public stop = vi.fn().mockResolvedValue(undefined);
            public constructor(spec: unknown, label: string, handlers: unknown) {
                constructed.push({ spec, label, handlers, instance: this });
            }
            public get isRunning(): boolean {
                return this.running;
            }
            public get initializeResult(): unknown {
                return this.initResult;
            }
        },
    };
});

const constructed = hoisted.constructed;

/** The fake `LspProxy` instance most recently constructed by `SvelteProxy`. */
function lastInstance(): FakeInstanceShape {
    const entry = constructed.at(-1);
    if (!entry) throw new Error('no LspProxy was constructed');
    return entry.instance;
}

vi.mock('../../src/core/lsp-proxy.js', () => ({
    LspProxy: hoisted.FakeLspProxy,
}));

// Imported AFTER the mock is registered so `SvelteProxy` picks up the fake.
const { SvelteProxy, resolveSvelteServerPath } = await import(
    '../../src/core/svelte-proxy.js'
);

const handlers = {
    onNotification: vi.fn(),
    onRequest: vi.fn().mockResolvedValue(null),
};

const initParams: InitializeParams = {
    processId: 1,
    rootUri: null,
    capabilities: {},
};

beforeEach(() => {
    constructed.length = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('resolveSvelteServerPath', () => {
    it('returns an explicit override verbatim', () => {
        expect(resolveSvelteServerPath('/abs/path/server.js')).toBe(
            '/abs/path/server.js',
        );
    });

    it('resolves bin/server.js from node_modules when no override is given', () => {
        const resolved = resolveSvelteServerPath();
        expect(resolved).toMatch(
            /svelte-language-server[/\\]bin[/\\]server\.js$/u,
        );
    });
});

describe('SvelteProxy — start / delegation', () => {
    it('is not running before start and forwards init to a forked child', async () => {
        const proxy = new SvelteProxy(handlers);
        expect(proxy.isRunning).toBe(false);
        // `initializeResult` is undefined while there is no inner proxy.
        expect(proxy.initializeResult).toBeUndefined();

        await proxy.start(initParams);

        // The inner proxy was constructed as a `fork` of the resolved server
        // path, labelled `svelte-language-server`, with the handlers forwarded.
        expect(constructed).toHaveLength(1);
        const spec = constructed[0]?.spec as {
            kind: string;
            module: string;
            args?: string[];
        };
        expect(spec.kind).toBe('fork');
        expect(spec.module).toMatch(/bin[/\\]server\.js$/u);
        expect(spec.args).toEqual(['--stdio']);
        expect(constructed[0]?.label).toBe('svelte-language-server');
        expect(constructed[0]?.handlers).toBe(handlers);
        expect(lastInstance().start).toHaveBeenCalledWith(initParams);
        expect(proxy.isRunning).toBe(true);
    });

    it('honours a server-path override set before start', async () => {
        const proxy = new SvelteProxy(handlers);
        proxy.setServerPath('/bundled/svelte-language-server.js');
        await proxy.start(initParams);
        const spec = constructed[0]?.spec as { module: string };
        expect(spec.module).toBe('/bundled/svelte-language-server.js');
    });

    it('clearing the override falls back to node_modules resolution', async () => {
        const proxy = new SvelteProxy(handlers);
        proxy.setServerPath('/bundled/x.js');
        proxy.setServerPath(undefined);
        await proxy.start(initParams);
        const spec = constructed[0]?.spec as { module: string };
        expect(spec.module).toMatch(/bin[/\\]server\.js$/u);
    });

    it('exposes the inner proxy initializeResult and isRunning after start', async () => {
        const proxy = new SvelteProxy(handlers);
        await proxy.start(initParams);
        // Reach the inner fake to set a result and toggle running.
        const inner = constructed.length;
        expect(inner).toBe(1);
        // The getters read through to the fake inner proxy.
        expect(proxy.isRunning).toBe(true);
        // `initializeResult` reads the inner proxy's getter (undefined here).
        expect(proxy.initializeResult).toBeUndefined();
    });
});

describe('SvelteProxy — request/notification forwarding', () => {
    it('forwards sendRequest to the inner proxy when running', async () => {
        const proxy = new SvelteProxy(handlers);
        await proxy.start(initParams);
        lastInstance().sendRequest.mockResolvedValue({ ok: true });
        const result = await proxy.sendRequest('textDocument/hover', {
            a: 1,
        });
        expect(result).toEqual({ ok: true });
        expect(lastInstance().sendRequest).toHaveBeenCalledWith(
            'textDocument/hover',
            { a: 1 },
        );
    });

    it('throws on sendRequest before start', async () => {
        const proxy = new SvelteProxy(handlers);
        await expect(
            proxy.sendRequest('textDocument/hover', {}),
        ).rejects.toThrow(/not running/u);
    });

    it('forwards sendNotification to the inner proxy when running', async () => {
        const proxy = new SvelteProxy(handlers);
        await proxy.start(initParams);
        await proxy.sendNotification('textDocument/didOpen', { b: 2 });
        expect(lastInstance().sendNotification).toHaveBeenCalledWith(
            'textDocument/didOpen',
            { b: 2 },
        );
    });

    it('treats sendNotification before start as a no-op', async () => {
        const proxy = new SvelteProxy(handlers);
        await expect(
            proxy.sendNotification('textDocument/didOpen', {}),
        ).resolves.toBeUndefined();
        // No inner proxy was ever constructed.
        expect(constructed).toHaveLength(0);
    });
});

describe('SvelteProxy — stop', () => {
    it('stops the inner proxy and clears it', async () => {
        const proxy = new SvelteProxy(handlers);
        await proxy.start(initParams);
        const stop = lastInstance().stop;
        await proxy.stop();
        expect(stop).toHaveBeenCalledTimes(1);
        // After stop the inner proxy is gone: isRunning is false again and a
        // request throws.
        expect(proxy.isRunning).toBe(false);
        await expect(proxy.sendRequest('x', {})).rejects.toThrow(
            /not running/u,
        );
    });

    it('treats stop before start as a no-op', async () => {
        const proxy = new SvelteProxy(handlers);
        await expect(proxy.stop()).resolves.toBeUndefined();
        // No inner proxy was ever constructed.
        expect(constructed).toHaveLength(0);
    });
});
