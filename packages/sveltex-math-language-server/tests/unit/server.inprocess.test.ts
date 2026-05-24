// In-process unit tests for `createServer` (`src/core/server.ts`).
//
// `server.test.ts` already drives the server end-to-end, but it *spawns* the
// server as a child process, so v8 cannot attribute that execution to the
// source file — it reports the `createServer` body as uncovered. This suite
// instead calls `createServer(connection)` directly in the test process, with
// a hand-built fake `Connection` that captures every registered handler so the
// tests can invoke them and assert on what flows back out. No process is
// forked: the real `TextDocuments` manager runs against the fake connection's
// captured document-sync handlers.

import { describe, expect, it, vi, type MockInstance } from 'vitest';
import {
    CompletionItemKind,
    TextDocumentSyncKind,
    type CompletionList,
    type Connection,
    type Hover,
    type InitializeParams,
    type InitializeResult,
} from 'vscode-languageserver';
import { createServer } from '../../src/core/server.js';

/** A registered request/notification handler, keyed by its registration name. */
type Handler = (...args: unknown[]) => unknown;

/**
 * A fake LSP {@link Connection}. Each `onXxx` registration captures the handler
 * into `handlers`; `__textDocumentSync` is writable because `TextDocuments`
 * assigns it in `listen`.
 */
interface FakeConnection {
    connection: Connection;
    handlers: Map<string, Handler>;
    /** Invokes a captured handler by name; the caller narrows the result. */
    invoke: (name: string, ...args: unknown[]) => unknown;
    /** `true` once the captured handler `name` has been registered. */
    has: (name: string) => boolean;
}

function makeConnection(): FakeConnection {
    const handlers = new Map<string, Handler>();
    const register =
        (name: string) =>
        (handler: Handler): { dispose: () => void } => {
            handlers.set(name, handler);
            return { dispose: () => undefined };
        };

    const connection = {
        onInitialize: register('onInitialize'),
        onCompletion: register('onCompletion'),
        onHover: register('onHover'),
        // The six registrations `TextDocuments.listen` makes.
        onDidOpenTextDocument: register('onDidOpenTextDocument'),
        onDidChangeTextDocument: register('onDidChangeTextDocument'),
        onDidCloseTextDocument: register('onDidCloseTextDocument'),
        onWillSaveTextDocument: register('onWillSaveTextDocument'),
        onWillSaveTextDocumentWaitUntil: register(
            'onWillSaveTextDocumentWaitUntil',
        ),
        onDidSaveTextDocument: register('onDidSaveTextDocument'),
    } as unknown as Connection;

    return {
        connection,
        handlers,
        invoke(name: string, ...args: unknown[]): unknown {
            const handler = handlers.get(name);
            if (!handler) throw new Error(`no handler registered: ${name}`);
            return handler(...args);
        },
        has: (name: string) => handlers.has(name),
    };
}

/** Minimal `initialize` params. */
function initParams(over: Partial<InitializeParams> = {}): InitializeParams {
    return {
        processId: null,
        rootUri: null,
        capabilities: {},
        ...over,
    };
}

/** Fires the captured `onDidOpenTextDocument` handler to register a document. */
function openDocument(
    h: FakeConnection,
    uri: string,
    text: string,
    languageId = 'latex',
): void {
    h.invoke('onDidOpenTextDocument', {
        textDocument: { uri, languageId, version: 1, text },
    });
}

describe('createServer (in-process)', () => {
    it('registers initialize, completion, hover and document-sync handlers', () => {
        const h = makeConnection();
        createServer(h.connection);
        expect(h.has('onInitialize')).toBe(true);
        expect(h.has('onCompletion')).toBe(true);
        expect(h.has('onHover')).toBe(true);
        // `TextDocuments.listen` wires up the sync handlers.
        expect(h.has('onDidOpenTextDocument')).toBe(true);
        expect(h.has('onDidChangeTextDocument')).toBe(true);
        expect(h.has('onDidCloseTextDocument')).toBe(true);
    });

    it('advertises completion (on `\\` and `{`) and hover on initialize', () => {
        const h = makeConnection();
        createServer(h.connection);
        const result = h.invoke(
            'onInitialize',
            initParams({ initializationOptions: { backend: 'katex' } }),
        ) as InitializeResult;
        expect(result.capabilities.textDocumentSync).toBe(
            TextDocumentSyncKind.Incremental,
        );
        expect(result.capabilities.hoverProvider).toBe(true);
        expect(result.capabilities.completionProvider).toEqual({
            triggerCharacters: ['\\', '{'],
            resolveProvider: false,
        });
        expect(result.serverInfo?.name).toBe('sveltex-math-language-server');
    });

    it('rebuilds the table for the backend named at initialize (katex)', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke(
            'onInitialize',
            initParams({ initializationOptions: { backend: 'katex' } }),
        );
        const uri = 'mem://k.tex';
        openDocument(h, uri, '\\ce');
        // `\ce` is MathJax-only, so the KaTeX backend must not offer it.
        const result = h.invoke('onCompletion', {
            textDocument: { uri },
            position: { line: 0, character: 3 },
        }) as CompletionList;
        expect(result.items.map((i) => i.label)).not.toContain('\\ce');
    });

    it('uses the MathJax table when initialized with the mathjax backend', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke(
            'onInitialize',
            initParams({ initializationOptions: { backend: 'mathjax' } }),
        );
        const uri = 'mem://m.tex';
        openDocument(h, uri, '\\ce');
        const result = h.invoke('onCompletion', {
            textDocument: { uri },
            position: { line: 0, character: 3 },
        }) as CompletionList;
        expect(result.items.map((i) => i.label)).toContain('\\ce');
    });

    it('defaults to the mathjax backend before initialize is received', () => {
        // Without ever calling `onInitialize`, the server uses its default
        // backend (mathjax) — exercising the field initialisers at the top of
        // `createServer`. `\ce` is MathJax-only, so it should be offered.
        const h = makeConnection();
        createServer(h.connection);
        const uri = 'mem://default.tex';
        openDocument(h, uri, '\\ce');
        const result = h.invoke('onCompletion', {
            textDocument: { uri },
            position: { line: 0, character: 3 },
        }) as CompletionList;
        expect(result.items.map((i) => i.label)).toContain('\\ce');
    });

    it('answers completion for an opened document', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke('onInitialize', initParams());
        const uri = 'mem://complete.tex';
        openDocument(h, uri, '\\alp');
        const result = h.invoke('onCompletion', {
            textDocument: { uri },
            position: { line: 0, character: 4 },
        }) as CompletionList;
        const alpha = result.items.find((i) => i.label === '\\alpha');
        expect(alpha).toBeDefined();
        expect(alpha?.kind).toBe(CompletionItemKind.Constant);
    });

    it('returns an empty completion list for an unopened document', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke('onInitialize', initParams());
        const result = h.invoke('onCompletion', {
            textDocument: { uri: 'mem://missing.tex' },
            position: { line: 0, character: 0 },
        }) as CompletionList;
        expect(result).toEqual({ isIncomplete: false, items: [] });
    });

    it('answers hover for a command in an opened document', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke(
            'onInitialize',
            initParams({ initializationOptions: { backend: 'katex' } }),
        );
        const uri = 'mem://hover.tex';
        openDocument(h, uri, '\\frac{1}{2}');
        const hover = h.invoke('onHover', {
            textDocument: { uri },
            position: { line: 0, character: 2 },
        }) as Hover | null;
        expect(hover).not.toBeNull();
        const value =
            hover && typeof hover.contents === 'object'
                ? (hover.contents as { value: string }).value
                : '';
        expect(value).toContain('KaTeX');
    });

    it('returns null hover for an unopened document', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke('onInitialize', initParams());
        const hover = h.invoke('onHover', {
            textDocument: { uri: 'mem://missing.tex' },
            position: { line: 0, character: 0 },
        }) as Hover | null;
        expect(hover).toBeNull();
    });

    it('tracks incremental document changes', () => {
        const h = makeConnection();
        createServer(h.connection);
        h.invoke('onInitialize', initParams());
        const uri = 'mem://change.tex';
        openDocument(h, uri, 'x');
        // Replace the whole text with `\bet`.
        h.invoke('onDidChangeTextDocument', {
            textDocument: { uri, version: 2 },
            contentChanges: [{ text: '\\bet' }],
        });
        const result = h.invoke('onCompletion', {
            textDocument: { uri },
            position: { line: 0, character: 4 },
        }) as CompletionList;
        expect(result.items.map((i) => i.label)).toContain('\\beta');
    });
});

describe('createServer wiring', () => {
    it('does not call listen on the connection (the caller owns the transport)', () => {
        // `createServer` must never start the transport itself. The fake here
        // exposes a `listen` spy that the document manager does not touch.
        const h = makeConnection();
        const listen: MockInstance = vi.fn();
        (h.connection as unknown as { listen: MockInstance }).listen = listen;
        createServer(h.connection);
        expect(listen).not.toHaveBeenCalled();
    });
});
