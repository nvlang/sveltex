// File description: `createServer` — the transport-agnostic core of the
// SvelTeX math language server.
//
// This server is small and standalone: it provides command completion and
// hover for TeX math, for one of two backends — KaTeX or MathJax — chosen via
// the LSP `initialize` request's `initializationOptions.backend`. It is spawned
// (one child per backend) by `@nvl/sveltex-language-server`, which feeds it the
// math regions of a `.sveltex` file as tiny virtual TeX documents, but it is a
// perfectly ordinary LSP and could equally be launched directly by any editor.
//
// `createServer(connection)` takes an already-built LSP `Connection` and never
// touches the transport — exactly the core/wrapper split used by
// `@nvl/sveltex-language-server`, so the same core backs the stdio `bin/server.js`
// and any in-process host.

import {
    TextDocuments,
    TextDocumentSyncKind,
    type CompletionParams,
    type Connection,
    type HoverParams,
    type InitializeParams,
    type InitializeResult,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    createCommandTable,
    type CommandTable,
    type MathLspBackend,
} from './commands.js';
import { computeCompletion, computeHover } from './features.js';

/**
 * Parses the math backend out of the `initialize` request's
 * `initializationOptions`.
 *
 * @param params - The LSP `initialize` params.
 * @returns `'katex'` or `'mathjax'`. Defaults to `'mathjax'` when the option is
 * absent or unrecognised — MathJax is SvelTeX's default math backend, so an
 * unconfigured client gets the most representative behaviour.
 */
export function resolveBackend(params: InitializeParams): MathLspBackend {
    const options: unknown = params.initializationOptions;
    if (options && typeof options === 'object' && 'backend' in options) {
        const backend: unknown = options.backend;
        if (backend === 'katex' || backend === 'mathjax') return backend;
    }
    return 'mathjax';
}

/**
 * Wires a SvelTeX math language server onto the given connection.
 *
 * @param connection - An LSP {@link Connection}, already created for whatever
 * transport the host uses. This function never calls `listen()`; the caller
 * owns the connection lifecycle.
 *
 * @remarks
 * Transport-agnostic by construction (no `vscode` import, no stdio access), so
 * the same core backs `bin/server.js` and any in-process host.
 */
export function createServer(connection: Connection): void {
    // Open documents are tracked with the standard `TextDocuments` manager,
    // which applies incremental sync for us — math regions are small, but a
    // shared manager keeps the server simple and correct.
    const documents = new TextDocuments(TextDocument);

    /** The backend selected at `initialize`; until then, the default. */
    let backend: MathLspBackend = 'mathjax';
    /** The command table for {@link backend}, rebuilt when the backend is set. */
    let table: CommandTable = createCommandTable(backend);

    connection.onInitialize((params: InitializeParams): InitializeResult => {
        backend = resolveBackend(params);
        table = createCommandTable(backend);
        return {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                // `\` opens a command; `{` opens the environment-name slot of
                // a `\begin{...}` — both should re-trigger completion.
                completionProvider: {
                    triggerCharacters: ['\\', '{'],
                    resolveProvider: false,
                },
                hoverProvider: true,
            },
            serverInfo: {
                name: 'sveltex-math-language-server',
            },
        };
    });

    connection.onCompletion((params: CompletionParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc) return { isIncomplete: false, items: [] };
        return computeCompletion(doc.getText(), params.position, table);
    });

    connection.onHover((params: HoverParams) => {
        const doc = documents.get(params.textDocument.uri);
        if (!doc) return null;
        return computeHover(doc.getText(), params.position, table, backend);
    });

    // `TextDocuments` needs the connection to receive `didOpen`/`didChange`/
    // `didClose`; `listen` only registers handlers, it does not start the
    // transport (that is the caller's job). Completion and hover read the
    // current document text on demand, so no change listener is needed.
    documents.listen(connection);
}
