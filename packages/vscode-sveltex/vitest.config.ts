import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

// A bare `vscode` specifier is unresolvable outside the editor host (there is
// no npm runtime for it). Point it at the in-repo stub so the extension's
// `vscode` import resolves to a mock the tests control.
const vscodeStub = fileURLToPath(
    new URL('./tests/vscode-stub.ts', import.meta.url),
);

/**
 * Rewrite TypeScript `import x = require('m')` statements into ESM
 * `import * as x from 'm'` for the extension source, at test time only.
 *
 * The extension is authored as CommonJS (`import x = require(…)`), which esbuild
 * compiles to a literal `require("m")`. Vitest executes such literal requires
 * through a *plain* Node `createRequire` — it bypasses Vitest's resolver, so the
 * `vscode` alias and any `vi.mock` never apply and `require('vscode')` fails
 * outright (there is no on-disk `vscode` package). Converting the statements to
 * ESM imports *before* esbuild runs routes them through Vitest's normal module
 * graph, where the alias and `vi.mock` take effect. The two forms produce the
 * same namespace binding, so the module's runtime behavior is unchanged.
 *
 * The replacement is line-preserving (each statement stays on its own line), so
 * V8 coverage line attribution against the original source is unaffected.
 */
function rewriteImportRequire(): Plugin {
    return {
        name: 'sveltex-rewrite-import-require',
        enforce: 'pre',
        transform(code, id) {
            if (!id.includes('/src/extension.ts')) return null;
            const out = code.replace(
                /import\s+(\w+)\s*=\s*require\(\s*(['"][^'"]+['"])\s*\)\s*;?/gu,
                'import * as $1 from $2;',
            );
            if (out === code) return null;
            return { code: out, map: null };
        },
    };
}

export default defineConfig({
    plugins: [rewriteImportRequire()],
    test: {
        include: ['./tests/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            enabled: true,
            include: ['src/**/*.ts'],
            reporter: ['text', 'text-summary', 'json', 'lcov'],
            reportOnFailure: true,
            // The extension is held at 100% — every uncovered branch is either
            // exercised by a test or carries a justified `/* v8 ignore */`. The
            // gate fails the run (and CI) if any metric regresses.
            thresholds: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
            },
        },
    },
    resolve: {
        alias: {
            vscode: vscodeStub,
        },
    },
});
