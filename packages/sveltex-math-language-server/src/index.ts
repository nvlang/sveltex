// File description: Public entry point of `@nvl/sveltex-math-language-server`.
//
// Two things are exported:
//
//  - `createServer(connection)` — the transport-agnostic core. A host that
//    already owns an LSP `Connection` (e.g. a test harness, or an editor that
//    runs the server in-process) calls this directly.
//
//  - `startServer()` — a stdio convenience wrapper: it creates a connection on
//    `process.stdin`/`process.stdout`, hands it to `createServer`, and starts
//    listening. This is what `bin/server.js` invokes.
//
// The pure command-table and feature APIs are re-exported too, so consumers
// (and `@nvl/sveltex-language-server`) can reuse them without spawning a child.

// The Node-flavoured `createConnection(options?)` lives in the package's node
// entry point. `vscode-languageserver`'s `typings` field points at the common
// (browser) API, so importing the concrete node file path surfaces the correct
// overload under `Node16` module resolution.
import {
    ProposedFeatures,
    createConnection,
} from 'vscode-languageserver/lib/node/main.js';
import { createServer } from './core/server.js';

export { createServer, resolveBackend } from './core/server.js';
export type {
    MathLspBackend,
    MathCommand,
    CommandCategory,
} from './core/commands.js';
export { CommandTable, createCommandTable } from './core/commands.js';
export { computeCompletion, computeHover } from './core/features.js';
export {
    commandAtCaret,
    completionContextAt,
    type CommandAtCaret,
    type CompletionContext,
} from './core/context.js';
export { describeCommand, hoverMarkdown } from './core/describe.js';
export { KATEX_COMMANDS, MATHJAX_COMMANDS } from './data/commands.generated.js';

/**
 * Starts the SvelTeX math language server over stdio.
 *
 * Creates an LSP connection bound to the current process's standard streams,
 * wires it up with {@link createServer}, and begins listening. The returned
 * promise never resolves under normal operation — the process lives as long as
 * the connection does.
 */
export function startServer(): void {
    const connection = createConnection(ProposedFeatures.all);
    createServer(connection);
    connection.listen();
}
