import vscode = require('vscode');
import fs = require('node:fs');
import crypto = require('node:crypto');
import path = require('node:path');
// This extension is compiled as CommonJS, so `vscode-languageclient` is brought
// in with the `import … = require(…)` form (consistent with the imports above).
// The Node entry point is referenced by its concrete file path: the package
// predates the npm `exports` field and its `typings` entry points at the
// browser-flavoured API, so `vscode-languageclient/node` would not type-check.
import lc = require('vscode-languageclient/lib/node/main.js');

const defaultLatexTags = ['tex', 'latex', 'tikz'];
const defaultEscapeTags = ['verb', 'verbatim'];

const tagRegex = /[a-zA-Z][-.:0-9_a-zA-Z]*/u;

/**
 * Idea: start with two copies of the same grammar, `sveltex.tmLanguage.json`
 * and `sveltex.tmLanguage.json_default`. The `sveltex.tmLanguage.json_default`
 * file is never modified, but is also not used for syntax highlighting.
 * Instead, `sveltex.tmLanguage.json` is updated dynamically based on the user's
 * settings. The `sveltex.tmLanguage.json_default` file exists solely to ease
 * the process of updating the grammar file, namely by providing an easy way to
 * enact the `latexTags` and `escapeTags` settings.
 *
 * @param grammarDir - The directory containing the grammar files.
 * @param latexTagsIn - The LaTeX tags to use for syntax highlighting.
 * @param escapeTagsIn - The verbatim tags to use for syntax highlighting.
 */
function updateGrammarFile(
    grammarDir: string,
    latexTagsIn: string[],
    escapeTagsIn: string[],
) {
    let grammar = fs.readFileSync(
        path.join(grammarDir, 'sveltex.tmLanguage.json_default'),
        'utf8',
    );

    const latexTags = [...latexTagsIn].filter((tag) => tagRegex.test(tag));
    const escapeTags = escapeTagsIn.filter((tag) => tagRegex.test(tag));

    if (latexTags.length === 0) latexTags.push(crypto.randomUUID());
    if (escapeTags.length === 0) escapeTags.push(crypto.randomUUID());

    grammar = grammar.replaceAll(
        defaultLatexTags.join('|'),
        latexTags.join('|'),
    );

    grammar = grammar.replaceAll(
        defaultEscapeTags.join('|'),
        escapeTags.join('|'),
    );

    // Write the modified grammar to the dynamically set grammar file
    fs.writeFileSync(path.join(grammarDir, 'sveltex.tmLanguage.json'), grammar);
}

/**
 * The running SvelTeX language client, or `undefined` before activation /
 * after deactivation. The client launches the SvelTeX language server as a
 * child process and speaks LSP with it.
 */
let client: lc.LanguageClient | undefined;

/**
 * The three language servers this extension transitively launches, located.
 *
 * `sveltexLanguageServer` is the server the {@link LanguageClient} below forks
 * directly. That server in turn forks the other two — `svelteLanguageServer`
 * (the real `svelte-language-server`) and `mathLanguageServer`
 * (`@nvl/sveltex-math-language-server`) — and so it needs to be told where they
 * are: their paths travel to it through the client's `initializationOptions`.
 */
interface ServerPaths {
    /** Path of the SvelTeX language server entry point. */
    sveltexLanguageServer: string;
    /** Path of the `svelte-language-server` entry point. */
    svelteLanguageServer: string;
    /** Path of the SvelTeX math language server entry point. */
    mathLanguageServer: string;
}

/**
 * Locates the three language server entry points.
 *
 * The published extension is a self-contained esbuild bundle: `extension.js`
 * and all three servers are bundled side by side into `dist/` (see
 * `scripts/build.ts`), and the `.vsix` ships no `node_modules`. So the servers
 * are looked up first as `dist/` siblings of this file; that is the path that
 * works in a packaged install.
 *
 * As a fallback — useful when the extension is run un-bundled during
 * development — each server is resolved from `node_modules` via
 * `require.resolve`. The SvelTeX server is a direct dependency, and the other
 * two are dependencies of _it_, so all three resolve from this extension's
 * location.
 *
 * @param extensionPath - The extension's root directory
 * (`context.extensionPath`).
 */
function resolveServerPaths(extensionPath: string): ServerPaths {
    const distDir = path.join(extensionPath, 'dist');

    // Returns the bundled `dist/<name>.js` if it exists, else resolves
    // `moduleId` from `node_modules`.
    const locate = (name: string, moduleId: string): string => {
        const bundled = path.join(distDir, `${name}.js`);
        if (fs.existsSync(bundled)) return bundled;
        return require.resolve(moduleId);
    };

    return {
        sveltexLanguageServer: locate(
            'sveltex-language-server',
            '@nvl/sveltex-language-server/bin/server.js',
        ),
        svelteLanguageServer: locate(
            'svelte-language-server',
            'svelte-language-server/bin/server.js',
        ),
        mathLanguageServer: locate(
            'sveltex-math-language-server',
            '@nvl/sveltex-math-language-server/bin/server.js',
        ),
    };
}

/**
 * Constructs and starts the SvelTeX {@link LanguageClient}.
 *
 * This mirrors the official `svelte-vscode` extension's setup: a
 * `vscode-languageclient` client launches the language server as a child
 * process over Node IPC. The SvelTeX server itself then spawns and proxies the
 * real `svelte-language-server` and the SvelTeX math language server. Because
 * the packaged extension ships no `node_modules`, the SvelTeX server cannot
 * resolve those two children itself — their bundled paths are passed to it via
 * `initializationOptions.serverPaths`.
 *
 * @param extensionPath - The extension's root directory
 * (`context.extensionPath`), used to locate the bundled servers.
 */
function startLanguageClient(extensionPath: string): lc.LanguageClient {
    const serverPaths = resolveServerPaths(extensionPath);
    const serverModule = serverPaths.sveltexLanguageServer;

    // Run the server module as a forked Node process, communicating over IPC.
    // The same configuration is reused for the debug profile; the SvelTeX
    // server needs no special debug flags.
    const serverOptions: lc.ServerOptions = {
        run: { module: serverModule, transport: lc.TransportKind.ipc },
        debug: { module: serverModule, transport: lc.TransportKind.ipc },
    };

    const clientOptions: lc.LanguageClientOptions = {
        // Only `.sveltex` files (the `sveltex` language id) are handled here.
        documentSelector: [
            { scheme: 'file', language: 'sveltex' },
            { scheme: 'untitled', language: 'sveltex' },
        ],
        diagnosticCollectionName: 'sveltex',
        // The SvelTeX server resolves its own two child servers from these
        // paths; without them it would fall back to a `node_modules` lookup
        // that fails in the packaged, dependency-free extension.
        initializationOptions: {
            serverPaths: {
                svelteLanguageServer: serverPaths.svelteLanguageServer,
                mathLanguageServer: serverPaths.mathLanguageServer,
            },
        },
        synchronize: {
            // React to changes of the user's SvelTeX configuration file.
            fileEvents: vscode.workspace.createFileSystemWatcher(
                '**/sveltex.config.{js,cjs,mjs,ts}',
            ),
        },
    };

    const languageClient = new lc.LanguageClient(
        'sveltex',
        'SvelTeX Language Server',
        serverOptions,
        clientOptions,
    );
    void languageClient.start();
    return languageClient;
}

function activate(context: vscode.ExtensionContext) {
    const grammarDir = path.join(context.extensionPath, 'syntaxes');

    const updateGrammar = () => {
        const latexTags = vscode.workspace
            .getConfiguration()
            .get<string[]>('sveltex.latexTags');
        const escapeTags = vscode.workspace
            .getConfiguration()
            .get<string[]>('sveltex.escapeTags');
        if (latexTags || escapeTags) {
            updateGrammarFile(
                grammarDir,
                latexTags ?? defaultLatexTags,
                escapeTags ?? defaultEscapeTags,
            );
        }
    };

    // Update grammar when the extension is activated
    updateGrammar();

    // Update grammar when the settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (
                e.affectsConfiguration('sveltex.latexTags') ||
                e.affectsConfiguration('sveltex.escapeTags')
            ) {
                updateGrammar();
            }
        }),
    );

    // Start the language server. A failure here must not break the syntax
    // highlighting the extension already provides, so it is logged rather than
    // thrown.
    try {
        client = startLanguageClient(context.extensionPath);
    } catch (error) {
        void vscode.window.showErrorMessage(
            `SvelTeX: failed to start the language server. ${String(error)}`,
        );
    }
}

async function deactivate(): Promise<void> {
    // Capture and clear the reference up front so the `await` cannot race with
    // a concurrent reassignment of `client`.
    const runningClient = client;
    client = undefined;
    if (runningClient) {
        await runningClient.stop();
    }
}

export = {
    activate,
    deactivate,
};
