/**
 * build-showcase.ts
 *
 * Sets up and builds the hand-written showcase site (`tests/e2e/showcase/`).
 *
 * Unlike the generated combo projects, the showcase is a real, committed
 * SvelteKit + SvelTeX website. It is built with **Deno** — `deno task build`
 * runs Vite under the Deno runtime — to prove that SvelTeX works end-to-end
 * when the build host is Deno rather than Node.
 *
 * The showcase declares its own dependencies in `showcase/package.json`, but
 * for the E2E pipeline its `node_modules` is symlinked to the shared
 * `_template` install (a superset of what the showcase needs), so there is no
 * separate dependency install — only the Deno build.
 *
 * Usage:
 *   node --import tsx/esm tests/e2e/build-showcase.ts
 * or via the npm script:
 *   pnpm test:e2e:build:showcase
 */

import { spawnSync } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Paths ────────────────────────────────────────────────────────────────────

const E2E_DIR = dirname(fileURLToPath(import.meta.url));
const SHOWCASE_DIR = join(E2E_DIR, 'showcase');
const TEMPLATE_NODE_MODULES = join(E2E_DIR, '_template', 'node_modules');
const SHOWCASE_NODE_MODULES = join(SHOWCASE_DIR, 'node_modules');

// ─── Preconditions ────────────────────────────────────────────────────────────

if (!existsSync(TEMPLATE_NODE_MODULES)) {
    console.error(
        `[build-showcase] ERROR: ${TEMPLATE_NODE_MODULES} is missing.\n` +
            `Install the shared template dependencies first ` +
            `(pnpm test:e2e:install).`,
    );
    process.exit(1);
}

// ─── Link node_modules ────────────────────────────────────────────────────────

// Reuse the template's install rather than installing the showcase's deps
// separately. The relative target keeps the symlink valid regardless of where
// the repository is checked out.
if (!existsSync(SHOWCASE_NODE_MODULES)) {
    symlinkSync('../_template/node_modules', SHOWCASE_NODE_MODULES);
    console.log(
        '[build-showcase] linked node_modules → ../_template/node_modules',
    );
}

// ─── Build with Deno ──────────────────────────────────────────────────────────

console.log('[build-showcase] deno task build …');
const result = spawnSync('deno', ['task', 'build'], {
    cwd: SHOWCASE_DIR,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
});

if (result.error) {
    console.error(
        `[build-showcase] ERROR: could not run Deno — is it installed and on ` +
            `PATH?\n${result.error.message}`,
    );
    process.exit(1);
}

if (result.status !== 0) {
    console.error(`[build-showcase] Deno build failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
}

console.log('[build-showcase] Done — showcase built to showcase/build/.');
