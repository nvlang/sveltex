/**
 * Hand-rolled stand-in for the `vscode` module the editor host injects at
 * runtime. There is no npm package to import, so `vitest.config.ts` aliases the
 * bare `vscode` specifier to this file. Only the surface `src/extension.ts`
 * actually touches is modelled:
 *
 *   - `extensions.getExtension`
 *   - `workspace.createFileSystemWatcher`
 *   - `window.showErrorMessage`
 *   - the `ExtensionContext` shape (`subscriptions`, `extensionPath`)
 *
 * Every function is a `vi.fn()`, so a test can re-stub any of them per case
 * (e.g. `getExtension.mockReturnValue(undefined)`) and assert on calls.
 */
import { vi } from 'vitest';

/** A disposable, matching the structural shape `vscode.Disposable` exposes. */
export interface Disposable {
    dispose: () => void;
}

/**
 * The slice of `vscode.Extension<T>` the extension reads — only the install
 * location is needed to locate the bundled `svelte-language-server`.
 */
export interface ExtensionLike {
    extensionPath: string;
}

/**
 * The slice of `vscode.FileSystemWatcher` we hand back from
 * `createFileSystemWatcher`. The extension only ever passes this object through
 * to the language client's `synchronize.fileEvents`; it registers no handlers
 * of its own, but the event registrars are modelled for structural
 * completeness.
 */
export interface FileSystemWatcherLike extends Disposable {
    onDidCreate: ReturnType<typeof vi.fn>;
    onDidChange: ReturnType<typeof vi.fn>;
    onDidDelete: ReturnType<typeof vi.fn>;
}

/**
 * The slice of `vscode.ExtensionContext` the extension uses: a `subscriptions`
 * sink for disposables and the `extensionPath` it resolves grammar/server paths
 * against.
 */
export interface ExtensionContextLike {
    subscriptions: Disposable[];
    extensionPath: string;
}

export const extensions = {
    getExtension: vi.fn<(id: string) => ExtensionLike | undefined>(),
};

export const window = {
    // No default implementation: the extension only ever `void`s the result, and
    // tests that assert on it install their own `mockResolvedValue`.
    showErrorMessage:
        vi.fn<(message: string) => Thenable<string | undefined>>(),
};

/**
 * Default watcher factory: returns a fresh disposable whose event registrars
 * each hand back their own disposable. Overridable per test via
 * `createFileSystemWatcher.mockReturnValue(...)`.
 */
export const workspace = {
    createFileSystemWatcher: vi.fn<
        (globPattern: string) => FileSystemWatcherLike
    >(() => ({
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
    })),
};

/**
 * A `vitest.config.ts` plugin rewrites the extension's `import vscode =
 * require('vscode')` into `import * as vscode from 'vscode'`, so at runtime the
 * extension reads the *named* exports above (`vscode.extensions`, etc.). The
 * default export is provided for completeness / any default-style consumer.
 */
export default { extensions, window, workspace };
