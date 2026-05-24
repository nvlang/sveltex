// Unit tests for the package entry point (`src/index.ts`).
//
// The re-exports are asserted to exist (so the public surface stays stable),
// and `startServer()` is exercised with both its node-transport dependency and
// the server core module mocked out — there is no real stdio to bind in a test,
// so `createConnection` / `createServer` / `listen` are fakes whose wiring is
// what we verify.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// A fake connection whose `listen` we can assert was called.
const listen = vi.fn();
const fakeConnection = { listen };

// Mock the node entry point of `vscode-languageserver` (the concrete file path
// `index.ts` imports) so no real stdio connection is opened.
const createConnection = vi.fn(() => fakeConnection);
const proposedAllSentinel = { proposed: true };
vi.mock('vscode-languageserver/lib/node/main.js', () => ({
    createConnection,
    ProposedFeatures: { all: proposedAllSentinel },
}));

// Mock the server core so `startServer` does not actually wire a real server.
const createServer = vi.fn();
vi.mock('../../src/core/server.js', () => ({
    createServer,
    // `index.ts` re-exports `resolveBackend` from the same module; provide a
    // stand-in so the re-export binding resolves under the mock.
    resolveBackend: vi.fn(),
}));

describe('index re-exports', () => {
    it('re-exports the public surface', async () => {
        const mod = await import('../../src/index.js');
        // The documented public API.
        expect(typeof mod.startServer).toBe('function');
        expect(typeof mod.createServer).toBe('function');
        expect(typeof mod.resolveBackend).toBe('function');
        expect(typeof mod.CommandTable).toBe('function');
        expect(typeof mod.createCommandTable).toBe('function');
        expect(typeof mod.computeCompletion).toBe('function');
        expect(typeof mod.computeHover).toBe('function');
        expect(typeof mod.commandAtCaret).toBe('function');
        expect(typeof mod.completionContextAt).toBe('function');
        expect(typeof mod.describeCommand).toBe('function');
        expect(typeof mod.hoverMarkdown).toBe('function');
        expect(Array.isArray(mod.KATEX_COMMANDS)).toBe(true);
        expect(Array.isArray(mod.MATHJAX_COMMANDS)).toBe(true);
    });
});

describe('startServer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a connection with proposed features, wires the server, and listens', async () => {
        const { startServer } = await import('../../src/index.js');
        startServer();
        expect(createConnection).toHaveBeenCalledOnce();
        // The proposed-features sentinel is forwarded to `createConnection`.
        expect(createConnection).toHaveBeenCalledWith(proposedAllSentinel);
        // The created connection is handed to `createServer`, then `listen`ed.
        expect(createServer).toHaveBeenCalledWith(fakeConnection);
        expect(listen).toHaveBeenCalledOnce();
    });
});
