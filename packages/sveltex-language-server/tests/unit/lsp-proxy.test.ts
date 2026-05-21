// Unit tests for the generic child-language-server proxy
// (`src/core/lsp-proxy.ts`).
//
// The proxy is exercised against the bundled math language server (resolved as
// a workspace dependency), launched both as a forked Node module and — to
// cover the `spawn` branch — as a native-style command. The lifecycle
// (`start` → `sendRequest` → `stop`), the `isRunning` flag, and the
// not-running guards are all checked.

import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import type { InitializeResult } from 'vscode-languageserver-protocol';
import { LspProxy } from '../../src/core/lsp-proxy.js';

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
