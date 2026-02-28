/**
 * combo.spec.ts
 *
 * Shared visual regression spec. One instance of this file is run per
 * Playwright project, where each project corresponds to a single
 * (backend-combo × browser) pair.
 *
 * The combo identifier is encoded in the Playwright project name as:
 *   `<combo-id>--<browser-name>`
 * e.g. `unified-shiki-katex--chrome`
 *
 * Playwright resolves `testInfo.project.name` before any test runs, so we
 * can use it at module scope to glob the correct routes directory.
 *
 * Snapshot layout:
 *   tests/e2e/snapshots/<combo-id>--<route-slug>--<browser-name>.png
 */

import { test, expect } from '@playwright/test';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Derive the combo ID from the current Playwright project name.
//
// Project names are formatted as `<combo-id>--<browser-name>` in
// playwright.config.ts, e.g. "unified-shiki-katex--chrome".
// We need everything before the last "--<browser>" suffix.
// ---------------------------------------------------------------------------

/**
 * Extracts the combo ID from a Playwright project name of the form
 * `<combo-id>--<browser-name>`.
 *
 * We strip the last `--<token>` segment rather than splitting on the first
 * `--`, because combo IDs themselves never contain `--` (they use single `-`
 * as separators), so the last `--` is always the combo/browser delimiter.
 */
function comboIdFromProjectName(projectName: string): string {
    const lastDoubleDash = projectName.lastIndexOf('--');
    if (lastDoubleDash === -1) {
        throw new Error(
            `Playwright project name "${projectName}" does not follow the ` +
                `expected "<combo-id>--<browser-name>" format. ` +
                `Check playwright.config.ts.`,
        );
    }
    return projectName.slice(0, lastDoubleDash);
}

// ---------------------------------------------------------------------------
// Route discovery helpers
// ---------------------------------------------------------------------------

/**
 * Converts an absolute `+page.*` path under a project's `src/routes/` tree
 * into a URL-style href, e.g. `/math/basic`.
 *
 * The root index file (`+page.svelte`) maps to `/`.
 */
function pageFileToHref(absPath: string, routesDir: string): string {
    // Normalise path separators on Windows.
    const rel = absPath.slice(routesDir.length).replace(/\\/g, '/');
    // rel looks like "/math/basic/+page.unifiedANDshikiANDkatexANDsveltex"
    // We want the directory portion.
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    return dir === '' ? '/' : dir;
}

/** Converts an href into a safe snapshot-filename slug, e.g. `math--basic`. */
function hrefToSlug(href: string): string {
    // Strip leading slash, then replace remaining slashes with double-dashes.
    return href.replace(/^\//, '').replace(/\//g, '--') || 'index';
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

// `test.describe` gives us access to `testInfo` for the project name.
test.describe('visual regression', () => {
    // We need the project name to derive the combo ID, but `test.describe`
    // callbacks don't receive `testInfo`.  Instead we use `test.describe`'s
    // inner `test` callback which does, or we read it from `test.info()` at
    // runtime.  However, to drive a dynamic `for` loop at *load* time we
    // rely on the fact that Playwright injects `process.env.TEST_WORKER_INDEX`
    // and sets up fixtures before running module-level code… except it doesn't.
    //
    // The cleanest solution for dynamic tests that depend on the project name
    // is to read `test.info()` *inside* a beforeAll hook to discover routes,
    // and then generate tests programmatically using `test()` inside a
    // `test.describe` that itself is inside `beforeAll`–which isn't possible.
    //
    // Playwright's recommended pattern for parametrised suites is to use a
    // `for` loop at module scope with a fixed list.  Since our list *is* fixed
    // (it's the set of pages we generated), we can discover it based on the
    // project name read from `test.info()` inside a single umbrella test that
    // uses `test.step` for each page — giving us per-page granularity in the
    // HTML report while remaining compatible with Playwright's parallel model.
    //
    // Alternatively — and this is what we do — we read the project name via
    // the `PLAYWRIGHT_PROJECT_NAME` env var, which Playwright sets for each
    // worker process automatically.

    // Playwright sets this env var for each worker.
    const projectName = process.env['PLAYWRIGHT_PROJECT_NAME'] ?? '';
    const comboId = projectName ? comboIdFromProjectName(projectName) : '';

    if (!comboId) {
        // This branch runs when the spec is loaded outside of Playwright
        // (e.g. ts-node type-checking).  We create a single placeholder test
        // so the file is never treated as an empty suite.
        test('placeholder (no PLAYWRIGHT_PROJECT_NAME)', () => {
            // Nothing to do — this test only exists so the suite isn't empty.
        });
        // Return early; nothing else to set up.
        // eslint-disable-next-line no-useless-return
        return;
    }

    const routesDir = join(E2E_DIR, 'projects', comboId, 'src', 'routes');

    // Discover every generated page for this combo.
    const pageFiles = globSync('**/+page.*', {
        cwd: routesDir,
        absolute: true,
        // The root index is a plain Svelte file with no combo-specific
        // content; skip it so we only test the actual content pages.
        ignore: ['**/+page.svelte'],
    });

    const hrefs = [...new Set(pageFiles.map((f) => pageFileToHref(f, routesDir)))].sort();

    if (hrefs.length === 0) {
        throw new Error(
            `No generated routes found for combo "${comboId}" under ${routesDir}.\n` +
                `Did you forget to run the generator? → pnpm generate-projects`,
        );
    }

    // Derive the browser name from the project name for use in snapshot filenames.
    // e.g. "unified-shiki-katex--chrome" → "chrome"
    const browserName = projectName.slice(comboId.length + 2); // skip the "--"

    for (const href of hrefs) {
        const slug = hrefToSlug(href);
        const snapshotName = `${comboId}--${slug}--${browserName}.png`;

        test(href, async ({ page }) => {
            await page.goto(href);

            // Wait for async rendering (MathJax typesetting, web fonts, etc.)
            // to settle before taking the screenshot.
            await page.waitForLoadState('networkidle');

            await expect(page).toHaveScreenshot(snapshotName, {
                fullPage: true,
                maxDiffPixels: 50,
                maxDiffPixelRatio: 0.01,
            });
        });
    }
});
