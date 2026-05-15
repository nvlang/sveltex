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
 *   3. Each app is served by its own `vite preview` server on a unique port
 *      (`3100 + comboIndex`), so combos share no state and cannot interfere.
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

import { backendCombos, comboId, comboPort } from './tests/e2e/backends.js';

const combos = backendCombos();

/**
 * One `vite preview` server per combo. Playwright starts them all before the
 * run; locally a still-running server is reused for fast iteration, while CI
 * always starts fresh.
 */
const webServers = combos.map((combo, index) => ({
    cwd: `tests/e2e/projects/${comboId(combo)}`,
    command: 'pnpm preview',
    url: `http://localhost:${comboPort(index)}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
}));

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /combo\.spec\.ts/u,

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
