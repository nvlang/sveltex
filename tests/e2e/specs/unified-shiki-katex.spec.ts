
import { test, expect } from '@playwright/test';
import { globSync } from 'glob';
import { dirname, relative, resolve } from 'node:path';

// Function to sanitize href for use as a filename
const sanitizeFilename = (href: string) => href.replace(/[\\/:]/g, '_');

test('unified + shiki + KaTeX', async ({ page }) => {
    let cwdPrefix = '';
    if (!/.*[\\/]e2e[\\/]?$/.test(process.cwd())) {
        cwdPrefix = 'tests/e2e/';
    }
    const hrefs = globSync(cwdPrefix + 'src/routes/generated/**/+page.unifiedANDshikiANDkatexANDsveltex', {
        absolute: true,
    }).map((path) =>
        dirname(relative(resolve(cwdPrefix + 'src/routes'), path)),
    );
    for (const href of hrefs) {
        await page.goto(href);
        await expect(page).toHaveScreenshot(`${sanitizeFilename(href)}.png`, {
            fullPage: true,
        });
    }
});

