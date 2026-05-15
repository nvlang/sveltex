/**
 * showcase.spec.ts
 *
 * Smoke + visual-regression spec for the hand-written showcase site
 * (`tests/e2e/showcase/`) — a realistic SvelteKit + SvelTeX website that is
 * built with Deno (see `build-showcase.ts` and `playwright.config.ts`).
 *
 * Where `combo.spec.ts` sweeps every backend permutation for breadth, this
 * spec drives one realistic site and asserts, page by page, that each SvelTeX
 * feature actually rendered — then takes a full-page screenshot.
 *
 * The preview server is started by `playwright.config.ts`; run just this spec
 * (without the 80 combo servers) with `E2E_SHOWCASE_ONLY=1`.
 */

import { test, expect } from '@playwright/test';

import { SHOWCASE_PORT } from './backends.js';

const BASE = `http://localhost:${SHOWCASE_PORT}`;

test.describe('showcase', () => {
    test('home', async ({ page }) => {
        await page.goto(`${BASE}/`);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'SvelTeX',
        );
        // A GFM table and MathJax-typeset math both rendered.
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('mjx-container').first()).toBeVisible();
        await expect(page).toHaveScreenshot('showcase--home.png', {
            fullPage: true,
        });
    });

    test('markdown', async ({ page }) => {
        await page.goto(`${BASE}/markdown`);
        await page.waitForLoadState('networkidle');
        // GFM extensions: tables, task lists and strikethrough.
        await expect(page.locator('table')).toBeVisible();
        await expect(
            page.locator('input[type="checkbox"]').first(),
        ).toBeVisible();
        await expect(page.locator('del').first()).toBeVisible();
        await expect(page).toHaveScreenshot('showcase--markdown.png', {
            fullPage: true,
        });
    });

    test('code', async ({ page }) => {
        await page.goto(`${BASE}/code`);
        await page.waitForLoadState('networkidle');
        // Shiki emits `<pre class="shiki …">` for each fenced block.
        expect(
            await page.locator('pre.shiki').count(),
        ).toBeGreaterThanOrEqual(4);
        await expect(page).toHaveScreenshot('showcase--code.png', {
            fullPage: true,
        });
    });

    test('math', async ({ page }) => {
        await page.goto(`${BASE}/math`);
        await page.waitForLoadState('networkidle');
        // Several equations, each with assistive MathML for screen readers.
        expect(
            await page.locator('mjx-container').count(),
        ).toBeGreaterThanOrEqual(5);
        await expect(
            page.locator('mjx-assistive-mml').first(),
        ).toBeAttached();
        await expect(page).toHaveScreenshot('showcase--math.png', {
            fullPage: true,
        });
    });

    test('diagrams', async ({ page }) => {
        await page.goto(`${BASE}/diagrams`);
        await page.waitForLoadState('networkidle');
        // Two TikZ pictures, each compiled by LaTeX to inline SVG.
        expect(await page.locator('svg').count()).toBeGreaterThanOrEqual(2);
        await expect(page).toHaveScreenshot('showcase--diagrams.png', {
            fullPage: true,
        });
    });

    test('components', async ({ page }) => {
        await page.goto(`${BASE}/components`);
        await page.waitForLoadState('networkidle');
        // Callout components wrap SvelTeX-processed Markdown.
        expect(
            await page.locator('aside.callout').count(),
        ).toBeGreaterThanOrEqual(2);
        const counter = page.locator('button.counter');
        await expect(counter).toHaveText(/Clicked 0\s+times/u);
        await expect(page).toHaveScreenshot('showcase--components.png', {
            fullPage: true,
        });
        // The site hydrates: the Counter island is interactive.
        await counter.click();
        await expect(counter).toHaveText(/Clicked 1\s+time\b/u);
    });

    test('blog', async ({ page }) => {
        await page.goto(`${BASE}/blog`);
        await page.waitForLoadState('networkidle');
        // The <h1> text comes from the page's YAML frontmatter `title` field.
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'Building this site with Deno',
        );
        await expect(page).toHaveScreenshot('showcase--blog.png', {
            fullPage: true,
        });
    });
});
