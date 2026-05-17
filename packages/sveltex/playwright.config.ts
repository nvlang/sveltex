/**
 * playwright.config.ts
 *
 * Visual-regression testing for `@nvl/sveltex` across every supported
 * combination of markdown, code, and math backends.
 *
 * Architecture (see `tests/e2e/README.md`):
 *   1. `pnpm generate-projects` writes one isolated SvelteKit app per backend
 *      combo to `tests/e2e/projects/<combo-id>/`.
 *   2. `pnpm test:e2e:build` builds each app to static output.
 *   3. A single Node process (`serve-projects.ts`) serves every app's static
 *      build, one port per combo (`3100 + comboIndex`).
 *   4. `combo.spec.ts` screenshots each generated page against its server.
 *
 * Browsers are Playwright projects; backend combos are `describe` blocks
 * within the single shared spec.
 *
 * Run all:          pnpm test:e2e
 * Update snapshots: pnpm test:e2e:golden
 * One combo:        pnpm playwright -g "unified-shiki-katex"
 */

import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

import {
    backendCombos,
    comboPort,
    SHOWCASE_PORT,
} from './tests/e2e/backends.js';

const combos = backendCombos();

/**
 * A single Node process serves every combo's static `adapter-static` build,
 * one port per combo — see `tests/e2e/serve-projects.ts`. This replaces the
 * old design of one `vite preview` process per combo: ~80 Vite processes
 * exhausted the CI runner's memory and the job was killed mid-run. Ports are
 * unchanged. Locally a still-running server is reused; CI starts fresh.
 */
const comboServer = {
    command: 'node --import tsx/esm tests/e2e/serve-projects.ts',
    // The script binds combo ports in index order; once the last one answers,
    // every combo server is up.
    url: `http://localhost:${comboPort(combos.length - 1)}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
};

/**
 * Preview server for the hand-written showcase site (`tests/e2e/showcase/`).
 * It is served with Deno — `deno task preview` runs `vite preview` under the
 * Deno runtime — mirroring the Deno-driven `deno task build` step.
 */
const showcaseServer = {
    cwd: 'tests/e2e/showcase',
    command: 'deno task preview',
    url: `http://localhost:${SHOWCASE_PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
};

/**
 * Set `E2E_SHOWCASE_ONLY=1` to start only the showcase server and skip the 80
 * combo servers — useful when iterating on the showcase alone:
 *   E2E_SHOWCASE_ONLY=1 pnpm playwright showcase.spec.ts
 */
const webServers = process.env['E2E_SHOWCASE_ONLY']
    ? [showcaseServer]
    : [comboServer, showcaseServer];

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /(?:combo|showcase)\.spec\.ts$/u,

    /* Run independent screenshot tests concurrently. */
    fullyParallel: true,

    /* Fail the CI build if `test.only` was left in the source. */
    forbidOnly: !!process.env['CI'],

    /* Retry in CI to absorb the occasional rendering flake. */
    retries: process.env['CI'] ? 2 : 0,

    workers: process.env['CI'] ? 4 : '50%',

    reporter: [
        ['html', { open: 'never' }],
        process.env['CI'] ? ['github'] : ['list'],
    ],

    /* Generous per-test budget for MathJax / web-font rendering. */
    timeout: 120_000,

    expect: {
        toHaveScreenshot: { maxDiffPixels: 50, maxDiffPixelRatio: 0.01 },
    },

    /*
     * Snapshots are organised as
     *   snapshots/<browser>/<combo-id>--<route-slug>-<platform>.png
     * The `-<platform>` suffix keeps OS-specific font rendering from
     * colliding; golden images must be generated on the same OS as the CI
     * runner (`pnpm test:e2e:golden`).
     */
    snapshotDir: './tests/e2e/snapshots',
    snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}-{platform}{ext}',

    webServer: webServers,

    projects: [
        { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        {
            name: 'galaxy-s9',
            use: {
                ...devices['Galaxy S9+'],
                colorScheme: 'no-preference',
                browserName: 'chromium',
            },
        },
    ],
});
