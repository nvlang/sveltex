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
vi.mock('../../src/core/server.js', () => ({ createServer }));

describe('index re-exports', () => {
    it('re-exports the public surface', async () => {
        const mod = await import('../../src/index.js');
        // A representative slice of the documented public API.
        expect(typeof mod.createServer).toBe('function');
        expect(typeof mod.startServer).toBe('function');
        expect(typeof mod.computeRegions).toBe('function');
        expect(typeof mod.isDelegated).toBe('function');
        expect(typeof mod.SourceMap).toBe('function');
        expect(typeof mod.buildVirtualSvelte).toBe('function');
        expect(typeof mod.defaultConfigSnapshot).toBe('function');
        expect(typeof mod.loadConfigSnapshot).toBe('function');
        expect(typeof mod.buildRegionVirtualDocument).toBe('function');
        expect(typeof mod.findTexlab).toBe('function');
        expect(typeof mod.isTexlabAvailable).toBe('function');
        expect(typeof mod.RegionForwarder).toBe('function');
        expect(typeof mod.isLatexVerbatimRegion).toBe('function');
        expect(typeof mod.LspProxy).toBe('function');
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
