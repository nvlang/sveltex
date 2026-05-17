/**
 * serve-projects.ts
 *
 * Serves every generated per-combo project's static build, one port per
 * combo, from a *single* Node process.
 *
 * This replaces the previous architecture, which started one `vite preview`
 * process per combo — ~80 of them — before the test run. That many Vite/Node
 * processes exhausted the CI runner's memory and the job was killed mid-run.
 * Each combo project is a SvelteKit `adapter-static` build (a plain static
 * site), so one lightweight `sirv` handler per combo, all in one process,
 * serves them for a tiny fraction of the memory.
 *
 * Ports are unchanged (`backends.ts` `comboPort`), so `combo.spec.ts` and the
 * Playwright config need no port changes.
 *
 * Run with:
 *   node --import tsx/esm tests/e2e/serve-projects.ts
 * It is started automatically as a Playwright `webServer` — see
 * `playwright.config.ts`.
 */

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sirv from 'sirv';

import { backendCombos, comboId, comboPort } from './backends.js';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = join(E2E_DIR, 'projects');

const combos = backendCombos();

// Every combo must have been built (`pnpm test:e2e:build`) first.
const missing = combos
    .map(comboId)
    .filter((id) => !existsSync(join(PROJECTS_DIR, id, 'build')));
if (missing.length > 0) {
    console.error(
        `[serve-projects] ${missing.length} project(s) have no build/ ` +
            'directory — run `pnpm test:e2e:build` first:\n' +
            missing.map((id) => `  ${id}`).join('\n'),
    );
    process.exit(1);
}

let ready = 0;
for (const [index, combo] of combos.entries()) {
    const id = comboId(combo);
    const port = comboPort(index);
    const buildDir = join(PROJECTS_DIR, id, 'build');

    // `single: '404.html'` mirrors `adapter-static`'s SPA fallback: a request
    // for a route that was not prerendered is answered with `404.html` (the
    // client-side-routing shell), exactly as `vite preview` did. `dev: false`
    // builds the file map once at startup — the build is immutable while the
    // server runs.
    const serve = sirv(buildDir, {
        dev: false,
        etag: true,
        single: '404.html',
    });

    createServer((req, res) => {
        serve(req, res, () => {
            res.statusCode = 404;
            res.end('Not found');
        });
    }).listen(port, () => {
        ready += 1;
        if (ready === combos.length) {
            console.log(
                `[serve-projects] serving ${combos.length} combo builds on ` +
                    `ports ${comboPort(0)}–${comboPort(combos.length - 1)}`,
            );
        }
    });
}
