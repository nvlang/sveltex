// File description: Public entry point of `@nvl/sveltex-language-server`.
//
// Two things are exported:
//
//  - `createServer(connection)` — the transport-agnostic core. A host that
//    already owns an LSP `Connection` (e.g. the VS Code extension running the
//    server in-process, or a test harness) calls this directly.
//
//  - `startServer()` — a stdio convenience wrapper: it creates a connection on
//    `process.stdin`/`process.stdout`, hands it to `createServer`, and starts
//    listening. This is what `bin/server.js` invokes, and what any editor
//    (VS Code, Zed, ...) gets when it launches the binary over stdio.

// The Node-flavoured `createConnection(options?)` lives in the package's node
// entry point. `vscode-languageserver`'s `typings` field points at the
// _common_ (browser) API, so importing the concrete node file path is what
// surfaces the correct overload under `Node16` module resolution.
import {
    ProposedFeatures,
    createConnection,
} from 'vscode-languageserver/lib/node/main.js';
import { createServer } from './core/server.js';

export { createServer } from './core/server.js';
export type { Region, RegionKind } from './core/regions.js';
export { computeRegions, isDelegated } from './core/regions.js';
export type { Mapping, MappingFeatures } from './core/mapping.js';
export { SourceMap } from './core/mapper.js';
export type { MapDirection } from './core/mapper.js';
export { buildVirtualSvelte } from './core/virtual-svelte.js';
export type { VirtualSvelteDocument } from './core/virtual-svelte.js';
export type { SveltexConfigSnapshot } from './core/config.js';
export { defaultConfigSnapshot, loadConfigSnapshot } from './core/config.js';

/**
 * Starts the SvelTeX language server over stdio.
 *
 * Creates an LSP connection bound to the current process's standard streams,
 * wires it up with {@link createServer}, and begins listening. The returned
 * promise never resolves under normal operation — the process lives as long as
 * the connection does.
 *
 * @remarks
 * Editors that spawn the server as a child process and talk LSP over stdio
 * (the Zed extension will do exactly this) need only run `bin/server.js`, which
 * calls this function. The VS Code extension instead runs the server over an
 * IPC transport via `vscode-languageclient`, but still through `bin/server.js`.
 */
export function startServer(): void {
    const connection = createConnection(ProposedFeatures.all);
    createServer(connection);
    connection.listen();
}
