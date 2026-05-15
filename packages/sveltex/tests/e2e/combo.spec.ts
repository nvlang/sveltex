/**
 * combo.spec.ts
 *
 * Visual-regression spec, parameterized over every backend combination.
 *
 * Each backend combo is a self-contained SvelteKit app generated under
 * `tests/e2e/projects/<combo-id>/` and served by its own `vite preview`
 * server on a unique port (see `playwright.config.ts`). This single spec
 * enumerates the combos at collection time and, for every generated page,
 * registers a screenshot test pointed at that combo's own server.
 *
 * Browsers are Playwright *projects* (`chrome` / `firefox` / `galaxy-s9`);
 * backend combos are `describe` blocks. Each browser project therefore runs
 * the full combo matrix, and snapshots live at
 *   `snapshots/<browser>/<combo-id>--<route-slug>-<platform>.png`.
 *
 * Why enumerate combos here rather than make each combo its own Playwright
 * project: a test file's module scope is evaluated once, before Playwright
 * assigns tests to projects, so the spec cannot know "which project am I".
 * Driving the matrix from a module-scope loop sidesteps that entirely.
 *
 * Prerequisite: `pnpm generate-projects` (part of `pnpm test:e2e:prepare`)
 * must have written `tests/e2e/projects/` before Playwright collects tests.
 */

import { test, expect } from '@playwright/test';
import { globSync } from 'glob';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { backendCombos, comboId, comboPort } from './backends.js';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

/** Turns a route href such as `/math/basic` into a snapshot slug `math--basic`. */
function hrefToSlug(href: string): string {
    return href.replace(/^\//u, '').replace(/\//gu, '--') || 'index';
}

/**
 * Converts an absolute `+page.*` path under a project's `src/routes/` tree
 * into its route href (the directory portion, e.g. `/math/basic`). The root
 * index file maps to `/`.
 */
function pageFileToHref(absPath: string, routesDir: string): string {
    const rel = absPath.slice(routesDir.length).replace(/\\/gu, '/');
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    return dir === '' ? '/' : dir;
}

for (const [index, combo] of backendCombos().entries()) {
    const id = comboId(combo);
    const port = comboPort(index);
    const routesDir = join(E2E_DIR, 'projects', id, 'src', 'routes');

    // Discover the generated content pages for this combo. The root index
    // (`+page.svelte`) is a plain navigation list with no combo-specific
    // content, so it is skipped.
    const pageFiles = globSync('**/+page.*', {
        cwd: routesDir,
        absolute: true,
        ignore: ['**/+page.svelte'],
    }).sort();

    test.describe(id, () => {
        for (const file of pageFiles) {
            const href = pageFileToHref(file, routesDir);

            test(href, async ({ page }) => {
                await page.goto(`http://localhost:${port}${href}`);

                // Wait for asynchronous rendering (MathJax typesetting, web
                // fonts, etc.) to settle before taking the screenshot.
                await page.waitForLoadState('networkidle');

                await expect(page).toHaveScreenshot(
                    `${id}--${hrefToSlug(href)}.png`,
                    { fullPage: true },
                );
            });
        }
    });
}
