/**
 * Unit tests for the SvelTeX VS Code extension entry point
 * (`src/extension.ts`), driven entirely through its only public surface — the
 * `activate`/`deactivate` pair exported via `export = { … }`.
 *
 * Host wiring:
 *   - `vscode` is replaced by `tests/vscode-stub.ts` (a `resolve.alias` in
 *     `vitest.config.ts`, paired with the `import = require` → ESM rewrite plugin
 *     so the alias actually applies to the extension's import).
 *   - `vscode-languageclient/lib/node/main.js` is replaced by the `vi.mock`
 *     factory below, a controllable fake `LanguageClient`.
 *   - `node:fs` is mocked to delegate to the real module by default (so the
 *     grammar read/write and the `existsSync` server-path probes run for real
 *     against temp dirs) while exposing `readFileSync`/`writeFileSync`/`existsSync`
 *     as `vi.fn()`s individual tests can force to throw.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';

import * as vscodeStub from './vscode-stub.ts';

// Stable mock functions for the three `node:fs` calls the extension makes.
// They live in a hoisted block so the `vi.mock` factory always hands back these
// *same* function instances — keeping the fs functions the extension uses
// identical to the ones these tests configure.
const fsMock = vi.hoisted(() => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
}));

// `node:fs` delegates to the real implementation by default (the spread keeps
// every other export intact and `default` is re-pointed for default imports);
// the three wrapped functions let a test `mockImplementationOnce(() => throw)`
// to drive the failure branches.
vi.mock('node:fs', async (importOriginal) => {
    const real = await importOriginal<typeof import('node:fs')>();
    return {
        ...real,
        default: real,
        readFileSync: fsMock.readFileSync,
        writeFileSync: fsMock.writeFileSync,
        existsSync: fsMock.existsSync,
    };
});

// The real implementations the mocked fs functions delegate to, captured via
// the un-mocked module so each test can (re-)establish delegation in
// `beforeEach`.
const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
const readFileSyncMock = fsMock.readFileSync as unknown as Mock;
const writeFileSyncMock = fsMock.writeFileSync as unknown as Mock;
const existsSyncMock = fsMock.existsSync as unknown as Mock;

/**
 * A controllable fake `LanguageClient`. Every constructed instance records its
 * constructor args, captures the notification handlers registered on it, and
 * drives `start()` through a per-test `nextStart` thunk so a test can choose
 * success/failure *before* it triggers `activate` (the extension calls
 * `start()` synchronously at construction, leaving no window to reconfigure
 * afterwards). A separate `ctorError` lets a test make construction itself
 * throw, to exercise `activate`'s synchronous try/catch.
 */
const lcMock = vi.hoisted(() => {
    interface FakeClient {
        ctorArgs: unknown[];
        start: Mock;
        stop: Mock;
        onNotification: Mock;
        outputChannel: { appendLine: Mock; show: Mock };
        notificationHandlers: Map<string, (params: unknown) => void>;
    }
    const instances: FakeClient[] = [];
    // `nextStart` is a *synchronous* hook: returning normally makes `start()`
    // resolve; throwing makes it reject. Keeping it synchronous sidesteps the
    // `promise-function-async`/`require-await` tug-of-war that trivial async
    // thunks trip, while `start()` (which has a real `await`) still turns a
    // thrown value into a rejected promise.
    const state: {
        nextStart: () => void;
        ctorError: Error | null;
    } = {
        nextStart: () => undefined,
        ctorError: null,
    };
    class LanguageClient {
        public ctorArgs: unknown[];
        public notificationHandlers = new Map<
            string,
            (params: unknown) => void
        >();
        public start = vi.fn(async () => {
            await Promise.resolve();
            state.nextStart();
        });
        public stop = vi.fn(async () => {
            await Promise.resolve();
        });
        public outputChannel = { appendLine: vi.fn(), show: vi.fn() };
        public onNotification = vi.fn(
            (method: string, handler: (params: unknown) => void) => {
                this.notificationHandlers.set(method, handler);
                return { dispose: vi.fn() };
            },
        );
        public constructor(...args: unknown[]) {
            if (state.ctorError) throw state.ctorError;
            this.ctorArgs = args;
            instances.push(this);
        }
    }
    return {
        instances,
        state,
        LanguageClient,
        // Mirror the real enum member the extension reads.
        TransportKind: { ipc: 1 },
    };
});

vi.mock('vscode-languageclient/lib/node/main.js', () => ({
    LanguageClient: lcMock.LanguageClient,
    TransportKind: lcMock.TransportKind,
}));

/** Shape of the extension's `export = { activate, deactivate }`. */
interface ExtensionModule {
    activate: (context: vscodeStub.ExtensionContextLike) => void;
    deactivate: () => Promise<void>;
}

// The extension is imported exactly once. `vi.resetModules()` is deliberately
// avoided: it would re-evaluate the aliased `vscode` stub and the `node:fs`
// mock, creating fresh `vi.fn()`s that these tests no longer hold references to
// (the extension would then call functions the tests cannot configure or
// assert on). Its only module-level state — the `client` singleton — is reset
// instead by `deactivate()` in `beforeEach` (it sets `client = undefined`).
const extension = (await import(
    '../src/extension.ts'
)) as unknown as ExtensionModule;
const { activate, deactivate } = extension;

/** Flush pending microtasks (the `start().then(…)` handlers run as microtasks). */
async function flushPromises(): Promise<void> {
    await new Promise<void>((resolve) => {
        setImmediate(resolve);
    });
}

let tmpRoot: string;

function readGrammar(extensionPath: string): string {
    return fs.readFileSync(
        path.join(extensionPath, 'syntaxes', 'sveltex.tmLanguage.json'),
        'utf8',
    );
}

function readTemplate(extensionPath: string): string {
    return fs.readFileSync(
        path.join(extensionPath, 'syntaxes', 'sveltex.tmLanguage.json_default'),
        'utf8',
    );
}

/**
 * Build a throwaway extension directory.
 *
 * @param opts.withDist - create `dist/<server>.js` siblings so `resolveServerPaths`
 * takes its bundled-path branch (otherwise it falls back to `require.resolve`).
 * @param opts.svelteServer - create
 * `<svelteExtDir>/node_modules/svelte-language-server/bin/server.js` so the
 * Svelte-extension lookup succeeds; the dir is returned for use as the
 * `getExtension().extensionPath`.
 */
function makeExtensionDir(opts: {
    withDist?: boolean;
    svelteServer?: boolean;
}): { extensionPath: string; svelteExtPath?: string } {
    const extensionPath = fs.mkdtempSync(path.join(tmpRoot, 'ext-'));
    const syntaxes = path.join(extensionPath, 'syntaxes');
    fs.mkdirSync(syntaxes, { recursive: true });
    // Copy the real template so the substitution logic runs against the genuine
    // placeholders (`tex|latex|tikz`, `verb|verbatim`, `sveltexNoopTag`).
    fs.copyFileSync(
        path.join(
            __dirname,
            '..',
            'syntaxes',
            'sveltex.tmLanguage.json_default',
        ),
        path.join(syntaxes, 'sveltex.tmLanguage.json_default'),
    );
    if (opts.withDist) {
        const distDir = path.join(extensionPath, 'dist');
        fs.mkdirSync(distDir, { recursive: true });
        fs.writeFileSync(
            path.join(distDir, 'sveltex-language-server.js'),
            '// bundled',
        );
        fs.writeFileSync(
            path.join(distDir, 'sveltex-math-language-server.js'),
            '// bundled',
        );
    }
    let svelteExtPath: string | undefined;
    if (opts.svelteServer) {
        svelteExtPath = fs.mkdtempSync(path.join(tmpRoot, 'svelte-ext-'));
        const binDir = path.join(
            svelteExtPath,
            'node_modules',
            'svelte-language-server',
            'bin',
        );
        fs.mkdirSync(binDir, { recursive: true });
        fs.writeFileSync(path.join(binDir, 'server.js'), '// svelte server');
    }
    return { extensionPath, svelteExtPath };
}

/** A minimal, real `ExtensionContext`-shaped object for a temp dir. */
function makeContext(extensionPath: string): vscodeStub.ExtensionContextLike {
    return { subscriptions: [], extensionPath };
}

/**
 * Most tests want a fully-wired happy environment: bundled servers present and
 * the Svelte extension reporting a real bundled server path.
 */
function happyExtensionDir(): { extensionPath: string; svelteExtPath: string } {
    const { extensionPath, svelteExtPath } = makeExtensionDir({
        withDist: true,
        svelteServer: true,
    });
    vscodeStub.extensions.getExtension.mockReturnValue({
        extensionPath: svelteExtPath ?? '',
    });
    return { extensionPath, svelteExtPath: svelteExtPath ?? '' };
}

beforeEach(async () => {
    // Reset the extension's `client` singleton (a prior test may have left one
    // running); `deactivate()` clears it to `undefined`.
    await deactivate();

    // Re-establish fs delegation (a previous test's `restoreAllMocks` may have
    // stripped the implementation) and clear call history.
    readFileSyncMock.mockReset().mockImplementation(realFs.readFileSync);
    writeFileSyncMock.mockReset().mockImplementation(realFs.writeFileSync);
    existsSyncMock.mockReset().mockImplementation(realFs.existsSync);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-sveltex-test-'));
    lcMock.instances.length = 0;
    lcMock.state.nextStart = () => undefined;
    lcMock.state.ctorError = null;
    vscodeStub.extensions.getExtension.mockReset();
    vscodeStub.window.showErrorMessage.mockReset();
    vscodeStub.window.showErrorMessage.mockResolvedValue(undefined);
    vscodeStub.workspace.createFileSystemWatcher.mockReset();
    vscodeStub.workspace.createFileSystemWatcher.mockReturnValue({
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    // Restore the fs delegation that `restoreAllMocks` may have torn down.
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Grammar generation (`updateGrammarFile`, `escapeTagForJsonRegex`, `tagRegex`)
// reached through the `sveltex/resolvedTags` notification handler / cold start.
// ---------------------------------------------------------------------------

interface ResolvedTags {
    verbatimTags: string[];
    latexTags: string[];
    escapeTags: string[];
    codeTags: string[];
    noopTags: string[];
}

describe('grammar regeneration', () => {
    /** Activate with a successful client and return the captured tags handler. */
    async function activateWithClient(extensionPath: string): Promise<{
        context: vscodeStub.ExtensionContextLike;
        fireResolvedTags: (params: ResolvedTags) => void;
    }> {
        const context = makeContext(extensionPath);
        activate(context);
        await flushPromises();
        const client = lcMock.instances[0];
        expect(client).toBeDefined();
        const handler = client.notificationHandlers.get('sveltex/resolvedTags');
        expect(handler).toBeTypeOf('function');
        return {
            context,
            fireResolvedTags: (params) => {
                handler?.(params);
            },
        };
    }

    it('substitutes latex, plain, and noop tag lists into the live grammar', async () => {
        const { extensionPath } = happyExtensionDir();
        const { fireResolvedTags } = await activateWithClient(extensionPath);

        fireResolvedTags({
            verbatimTags: [],
            latexTags: ['math', 'equation'],
            escapeTags: ['shell'],
            codeTags: ['code'],
            noopTags: ['raw'],
        });

        const grammar = readGrammar(extensionPath);
        // LaTeX bucket replaced the `tex|latex|tikz` default everywhere.
        expect(grammar).toContain('math|equation');
        expect(grammar).not.toContain('tex|latex|tikz');
        // escape + code merge into the single plain bucket (`verb|verbatim`).
        expect(grammar).toContain('shell|code');
        expect(grammar).not.toContain('verb|verbatim');
        // noop placeholder replaced.
        expect(grammar).toContain('(<(raw)(');
        expect(grammar).not.toContain('sveltexNoopTag');
    });

    it('falls back to a UUID for each empty bucket so the regex matches nothing', async () => {
        const { extensionPath } = happyExtensionDir();
        const { fireResolvedTags } = await activateWithClient(extensionPath);

        fireResolvedTags({
            verbatimTags: [],
            latexTags: [],
            escapeTags: [],
            codeTags: [],
            noopTags: [],
        });

        const grammar = readGrammar(extensionPath);
        const template = readTemplate(extensionPath);
        // None of the default placeholders survive…
        expect(grammar).not.toContain('tex|latex|tikz');
        expect(grammar).not.toContain('verb|verbatim');
        expect(grammar).not.toContain('sveltexNoopTag');
        // …and three *new* UUIDs (one per bucket) appear that were not already
        // present in the never-mutated template.
        const uuidRe =
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu;
        const templateUuids = new Set(template.match(uuidRe) ?? []);
        const grammarUuids = new Set(grammar.match(uuidRe) ?? []);
        const added = [...grammarUuids].filter((u) => !templateUuids.has(u));
        expect(added).toHaveLength(3);
    });

    it('de-duplicates repeated tag names (Set, first-seen order)', async () => {
        const { extensionPath } = happyExtensionDir();
        const { fireResolvedTags } = await activateWithClient(extensionPath);

        // `escape` + `code` are merged, and an alias can repeat a name; the Set
        // collapses `dup` to a single occurrence in first-seen order.
        fireResolvedTags({
            verbatimTags: [],
            latexTags: ['a', 'a', 'b'],
            escapeTags: ['dup'],
            codeTags: ['dup', 'extra'],
            noopTags: ['n', 'n'],
        });

        const grammar = readGrammar(extensionPath);
        expect(grammar).toContain('a|b');
        expect(grammar).not.toContain('a|a|b');
        expect(grammar).toContain('dup|extra');
        expect(grammar).not.toContain('dup|dup|extra');
        expect(grammar).toContain('(<(n)(');
    });

    it('regex-escapes the dot a valid tag may contain', async () => {
        const { extensionPath } = happyExtensionDir();
        const { fireResolvedTags } = await activateWithClient(extensionPath);

        // `a.b` passes the anchored tag filter (dots are allowed in tag names)
        // but the `.` must be escaped so it does not match any character. The
        // grammar is JSON text, so the escaping backslash is itself doubled.
        fireResolvedTags({
            verbatimTags: [],
            latexTags: ['a.b'],
            escapeTags: [],
            codeTags: [],
            noopTags: [],
        });

        const grammar = readGrammar(extensionPath);
        expect(grammar).toContain('a\\\\.b');
    });

    it('drops tags rejected by the anchored tag pattern', async () => {
        const { extensionPath } = happyExtensionDir();
        const { fireResolvedTags } = await activateWithClient(extensionPath);

        // Whitespace, leading digit, and raw regex syntax must be filtered out
        // (anchored `^…$`), leaving only the one valid name `good`.
        fireResolvedTags({
            verbatimTags: [],
            latexTags: ['good', 'te x', '1bad', 'tex)|(?:', 'C++'],
            escapeTags: [],
            codeTags: [],
            noopTags: [],
        });

        const grammar = readGrammar(extensionPath);
        // Only `good` made it into the latex alternation slot.
        expect(grammar).toContain('(<(good)(');
        expect(grammar).not.toContain('te x');
        expect(grammar).not.toContain('1bad');
        // The raw-regex tag would have introduced its own `)` / `(` — assert
        // the alternation is exactly `good`, never the smuggled syntax.
        expect(grammar).not.toContain('good|');
        expect(grammar).not.toContain('C++');
    });

    it('cold-start regeneration runs against the built-in defaults', async () => {
        const { extensionPath } = happyExtensionDir();
        activate(makeContext(extensionPath));
        await flushPromises();

        const grammar = readGrammar(extensionPath);
        const template = readTemplate(extensionPath);
        // Defaults map onto themselves for the two named buckets…
        expect(grammar).toContain('tex|latex|tikz');
        expect(grammar).toContain('verb|verbatim');
        // …the noop bucket is empty at cold start, so its placeholder is gone…
        expect(grammar).not.toContain('sveltexNoopTag');
        // …and the never-mutated template still carries every placeholder.
        expect(template).toContain('tex|latex|tikz');
        expect(template).toContain('sveltexNoopTag');
    });
});

// ---------------------------------------------------------------------------
// Server path resolution branches.
// ---------------------------------------------------------------------------

describe('server path resolution', () => {
    /** Pull the constructor args of the i-th constructed fake client. */
    function ctorArgs(i: number): {
        serverOptions: { run: { module: string } };
        clientOptions: {
            initializationOptions: { serverPaths: Record<string, string> };
        };
    } {
        const [, , serverOptions, clientOptions] = lcMock.instances[i]
            .ctorArgs as [
            string,
            string,
            { run: { module: string } },
            {
                initializationOptions: {
                    serverPaths: Record<string, string>;
                };
            },
        ];
        return { serverOptions, clientOptions };
    }

    it('uses the bundled dist/ servers and the Svelte extension copy when present', async () => {
        const { extensionPath, svelteExtPath } = happyExtensionDir();
        activate(makeContext(extensionPath));
        await flushPromises();

        expect(lcMock.instances).toHaveLength(1);
        const { serverOptions, clientOptions } = ctorArgs(0);
        expect(serverOptions.run.module).toBe(
            path.join(extensionPath, 'dist', 'sveltex-language-server.js'),
        );
        expect(
            clientOptions.initializationOptions.serverPaths.svelteLanguageServer,
        ).toBe(
            path.join(
                svelteExtPath,
                'node_modules',
                'svelte-language-server',
                'bin',
                'server.js',
            ),
        );
        expect(
            clientOptions.initializationOptions.serverPaths.mathLanguageServer,
        ).toBe(
            path.join(extensionPath, 'dist', 'sveltex-math-language-server.js'),
        );
    });

    it('falls back to require.resolve for the SvelTeX servers when dist/ is absent', async () => {
        // No `dist/` → `existsSync(bundled)` is false → `require.resolve`, which
        // lands on the real workspace packages.
        const { extensionPath, svelteExtPath } = makeExtensionDir({
            withDist: false,
            svelteServer: true,
        });
        vscodeStub.extensions.getExtension.mockReturnValue({
            extensionPath: svelteExtPath ?? '',
        });
        activate(makeContext(extensionPath));
        await flushPromises();

        const { serverOptions } = ctorArgs(0);
        expect(serverOptions.run.module).toMatch(
            /sveltex-language-server[\\/]bin[\\/]server\.js$/u,
        );
        expect(serverOptions.run.module).not.toContain(
            path.join(extensionPath, 'dist'),
        );
    });

    it('uses require.resolve for svelte-language-server when the extension is absent', async () => {
        // getExtension → undefined makes `resolveSvelteLanguageServer` skip the
        // extension copy and hit `require.resolve('svelte-language-server/…')`,
        // which *does* resolve in this dev tree (transitive dependency), so the
        // client is still constructed — just with the resolved path.
        const { extensionPath } = makeExtensionDir({
            withDist: true,
            svelteServer: false,
        });
        vscodeStub.extensions.getExtension.mockReturnValue(undefined);
        activate(makeContext(extensionPath));
        await flushPromises();

        expect(lcMock.instances).toHaveLength(1);
        const { clientOptions } = ctorArgs(0);
        expect(
            clientOptions.initializationOptions.serverPaths.svelteLanguageServer,
        ).toMatch(/svelte-language-server[\\/]bin[\\/]server\.js$/u);
        expect(vscodeStub.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('skips the extension copy when the Svelte extension lacks the bundled server', async () => {
        // Extension present but `existsSync(fromExtension)` false → inner `if`
        // is false → fall through to the (resolvable) require.resolve.
        const { extensionPath } = makeExtensionDir({
            withDist: true,
            svelteServer: false,
        });
        vscodeStub.extensions.getExtension.mockReturnValue({
            extensionPath: path.join(tmpRoot, 'svelte-ext-missing'),
        });
        activate(makeContext(extensionPath));
        await flushPromises();

        expect(lcMock.instances).toHaveLength(1);
        const { clientOptions } = ctorArgs(0);
        expect(
            clientOptions.initializationOptions.serverPaths.svelteLanguageServer,
        ).toMatch(/svelte-language-server[\\/]bin[\\/]server\.js$/u);
    });
});

// ---------------------------------------------------------------------------
// Language client start / failure handling.
// ---------------------------------------------------------------------------

describe('language client lifecycle', () => {
    it('logs success to the output channel when start() resolves', async () => {
        const { extensionPath } = happyExtensionDir();
        // Default `nextStart` returns normally → `start()` resolves.
        activate(makeContext(extensionPath));
        await flushPromises();

        const client = lcMock.instances[0];
        expect(client.start).toHaveBeenCalledTimes(1);
        expect(client.outputChannel.appendLine.mock.calls).toContainEqual([
            '[sveltex] Language server started.',
        ]);
        expect(vscodeStub.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('reports an Error rejection with its stack and surfaces a notification', async () => {
        const { extensionPath } = happyExtensionDir();
        const err = new Error('handshake failed');
        err.stack = 'STACKTRACE';
        lcMock.state.nextStart = () => {
            throw err;
        };
        activate(makeContext(extensionPath));
        await flushPromises();

        const client = lcMock.instances[0];
        expect(client.outputChannel.appendLine.mock.calls).toContainEqual([
            '[sveltex] Language server failed to start:\nSTACKTRACE',
        ]);
        expect(client.outputChannel.show).toHaveBeenCalledWith(true);
        expect(vscodeStub.window.showErrorMessage).toHaveBeenCalledTimes(1);
        expect(
            vscodeStub.window.showErrorMessage.mock.calls[0]?.[0],
        ).toContain('the language server failed to start');
    });

    it('falls back to the Error message when the rejection has no stack', async () => {
        const { extensionPath } = happyExtensionDir();
        const err = new Error('no-stack failure');
        // Some Error-likes carry no stack; force the `?? error.message` side.
        Object.defineProperty(err, 'stack', { value: undefined });
        lcMock.state.nextStart = () => {
            throw err;
        };
        activate(makeContext(extensionPath));
        await flushPromises();

        const client = lcMock.instances[0];
        expect(client.outputChannel.appendLine.mock.calls).toContainEqual([
            '[sveltex] Language server failed to start:\nno-stack failure',
        ]);
    });

    it('stringifies a non-Error rejection', async () => {
        const { extensionPath } = happyExtensionDir();
        lcMock.state.nextStart = () => {
            // The extension must handle a non-Error rejection via `String(error)`.
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'plain string failure';
        };
        activate(makeContext(extensionPath));
        await flushPromises();

        const client = lcMock.instances[0];
        expect(client.outputChannel.appendLine.mock.calls).toContainEqual([
            '[sveltex] Language server failed to start:\nplain string failure',
        ]);
    });

    it('registers the resolvedTags notification handler on the client', async () => {
        const { extensionPath } = happyExtensionDir();
        const context = makeContext(extensionPath);
        activate(context);
        await flushPromises();

        const client = lcMock.instances[0];
        expect(client.onNotification).toHaveBeenCalledWith(
            'sveltex/resolvedTags',
            expect.any(Function),
        );
        // The returned disposable is pushed onto the context subscriptions.
        expect(context.subscriptions).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// `regenerate` error handling (try/catch) for both `client` states.
// ---------------------------------------------------------------------------

describe('regenerate error handling', () => {
    it('logs to console.error when the cold-start write fails and no client exists yet', async () => {
        // Construction throws → `client` stays undefined; but the cold-start
        // `regenerate` runs first. Force its write to throw an Error (w/ stack).
        const { extensionPath } = happyExtensionDir();
        lcMock.state.ctorError = new Error('client ctor blew up');
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const writeErr = new Error('EACCES write denied');
        writeErr.stack = 'WRITE_STACK';
        writeFileSyncMock.mockImplementationOnce(() => {
            throw writeErr;
        });

        activate(makeContext(extensionPath));
        await flushPromises();

        expect(writeFileSyncMock).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to regenerate the TextMate grammar'),
        );
        expect(consoleSpy.mock.calls[0]?.[0]).toContain('WRITE_STACK');
        // Construction failed, so activation also surfaced its own error.
        expect(vscodeStub.window.showErrorMessage).toHaveBeenCalledTimes(1);
    });

    it('logs a stackless Error via console.error using its message', async () => {
        const { extensionPath } = happyExtensionDir();
        lcMock.state.ctorError = new Error('ctor');
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const writeErr = new Error('no stack here');
        Object.defineProperty(writeErr, 'stack', { value: undefined });
        writeFileSyncMock.mockImplementationOnce(() => {
            throw writeErr;
        });

        activate(makeContext(extensionPath));
        await flushPromises();

        expect(consoleSpy.mock.calls[0]?.[0]).toContain('no stack here');
    });

    it('stringifies a non-Error thrown during regeneration via console.error', async () => {
        const { extensionPath } = happyExtensionDir();
        lcMock.state.ctorError = new Error('ctor');
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        writeFileSyncMock.mockImplementationOnce(() => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'string write error';
        });

        activate(makeContext(extensionPath));
        await flushPromises();

        expect(consoleSpy.mock.calls[0]?.[0]).toContain('string write error');
    });

    it('logs to the client output channel when a post-start regeneration fails', async () => {
        // Happy activation so `client` is set; then fire a notification whose
        // regeneration throws — it must go to `client.outputChannel`, not
        // console.error.
        const { extensionPath } = happyExtensionDir();
        const context = makeContext(extensionPath);
        activate(context);
        await flushPromises();

        const client = lcMock.instances[0];
        const handler = client.notificationHandlers.get('sveltex/resolvedTags');
        expect(handler).toBeTypeOf('function');

        const writeErr = new Error('post-start write failed');
        writeErr.stack = 'POST_STACK';
        writeFileSyncMock.mockImplementationOnce(() => {
            throw writeErr;
        });
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        handler?.({
            verbatimTags: [],
            latexTags: ['x'],
            escapeTags: [],
            codeTags: [],
            noopTags: [],
        });

        expect(client.outputChannel.appendLine.mock.calls).toContainEqual([
            expect.stringContaining('POST_STACK'),
        ]);
        expect(consoleSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// `activate`'s startLanguageClient try/catch (synchronous failure).
// ---------------------------------------------------------------------------

describe('activate start failure', () => {
    it('shows an error when constructing the client throws synchronously', async () => {
        const { extensionPath } = happyExtensionDir();
        // Construction throws synchronously inside `startLanguageClient`, so the
        // failure is caught by `activate`'s try/catch (not the `.then` rejection
        // path).
        lcMock.state.ctorError = new Error('synchronous construction boom');
        const context = makeContext(extensionPath);
        activate(context);
        await flushPromises();

        expect(lcMock.instances).toHaveLength(0);
        expect(vscodeStub.window.showErrorMessage).toHaveBeenCalledTimes(1);
        expect(
            vscodeStub.window.showErrorMessage.mock.calls[0]?.[0],
        ).toContain('failed to start the language server');
        // `client` was never assigned, so no notification handler is registered.
        expect(context.subscriptions).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// `deactivate`.
// ---------------------------------------------------------------------------

describe('deactivate', () => {
    it('stops a running client and clears the reference', async () => {
        const { extensionPath } = happyExtensionDir();
        activate(makeContext(extensionPath));
        await flushPromises();

        const client = lcMock.instances[0];
        await deactivate();
        expect(client.stop).toHaveBeenCalledTimes(1);

        // A second deactivate is a no-op: the reference was cleared, so `stop`
        // is not called again.
        await deactivate();
        expect(client.stop).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when no client is running', async () => {
        // `beforeEach`'s `deactivate()` already cleared `client`, so the `if`
        // branch is skipped and the call resolves to `undefined`.
        await expect(deactivate()).resolves.toBeUndefined();
    });
});
