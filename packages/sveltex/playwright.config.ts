/**
 * playwright.config.ts
 *
 * Defines one Playwright project per (backend-combo × browser) pair.
 * Each combo gets its own isolated SvelteKit preview server on a unique port,
 * so all combinations can run fully in parallel without sharing any state.
 *
 * Layout of generated projects (written by `pnpm generate-projects`):
 *   tests/e2e/projects/<combo-id>/   ← self-contained SvelteKit app
 *
 * Run all:           playwright test
 * Run one combo:     playwright test --project "unified-shiki-katex--chrome"
 * Update snapshots:  playwright test --update-snapshots
 */

import { defineConfig, devices, type Project } from '@playwright/test';
import { backendCombos, comboId, comboPort } from './tests/e2e/backends.js';
import process from 'node:process';

// ─── Browser matrix ───────────────────────────────────────────────────────────

const BROWSERS = [
    {
        name: 'chrome',
        use: { ...devices['Desktop Chrome'] },
    },
    {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
    },
    {
        name: 'galaxy-s9',
        use: {
            ...devices['Galaxy S9+'],
            colorScheme: 'no-preference' as const,
            browserName: 'chromium' as const,
        },
    },
] satisfies { name: string; use: Record<string, unknown> }[];

// ─── Combo matrix ─────────────────────────────────────────────────────────────

const combos = backendCombos();

// ─── Playwright projects ──────────────────────────────────────────────────────

/**
 * One project per (combo × browser).
 *
 * The project `name` encodes both pieces of information as
 * `<combo-id>--<browser-name>` so that `combo.spec.ts` can recover the
 * combo identifier from `testInfo.project.name` without needing an env var.
 */
const projects: Project[] = combos.flatMap((combo, index) => {
    const id = comboId(combo);
    const port = comboPort(index);

    return BROWSERS.map(({ name: browserName, use: browserUse }) => ({
        name: `${id}--${browserName}`,
        // Metadata is forwarded to the spec via testInfo.project.metadata.
        metadata: {
            comboId: id,
            comboPort: port,
        },
        use: {
            ...browserUse,
            baseURL: `http://localhost:${port}`,
        },
        // Point every project at the single shared spec file.
        testMatch: /combo\.spec\.ts/u,
    }));
});

// ─── Web servers ──────────────────────────────────────────────────────────────

/**
 * One preview server per combo.
 *
 * Prerequisites (handled by `pnpm test:e2e:prepare`):
 *   1. `@nvl/sveltex` is built (`pnpm build` in packages/sveltex).
 *   2. `pnpm generate-projects` has been run to write the per-combo projects.
 *   3. Each per-combo project has been built (`vite build`) so the static
 *      output is ready for `vite preview` to serve.
 *
 * In CI the servers are always freshly started; locally we reuse running
 * servers so incremental reruns are fast.
 */
const webServers = combos.map((combo, index) => ({
    cwd: `tests/e2e/projects/${comboId(combo)}`,
    command: 'pnpm preview',
    url: `http://localhost:${comboPort(index)}`,
    reuseExistingServer: !process.env['CI'],
    // Give static previews a short startup budget — they start in < 1 s.
    timeout: 30_000,
}));

// ─── Config ───────────────────────────────────────────────────────────────────

export default defineConfig({
    testDir: './tests/e2e',

    /* Allow tests within a single project to run in parallel. */
    fullyParallel: true,

    /* Catch accidental `.only` calls in CI. */
    forbidOnly: !!process.env['CI'],

    /* Retry flaky tests in CI. */
    retries: process.env['CI'] ? 2 : 0,

    /**
     * Concurrency cap.
     *
     * With 80 combos × 3 browsers = 240 projects, Playwright would try to
     * start all 240 in parallel if left unconstrained, which would overwhelm
     * most machines.  A good heuristic is 2–4× the number of CPU cores.
     * Override via the CLI: `--workers N`.
     */
    workers: process.env['CI'] ? 8 : '50%',

    reporter: [
        ['html', { open: 'never' }],
        process.env['CI'] ? ['github'] : ['list'],
    ],

    expect: {
        toHaveScreenshot: { maxDiffPixels: 5 },
    },

    /* Per-test timeout: allow generous time for MathJax / TeX rendering. */
    timeout: 120_000,

    /* Snapshot directory — shared across all combos, identified by filename. */
    snapshotDir: './tests/e2e/snapshots',

    /**
     * Template for snapshot file names.
     * The `{arg}` portion is set by the spec to `<combo>--<route>--<browser>`,
     * so each snapshot is fully self-describing.
     */
    snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',

    webServer: webServers,
    projects,
});
