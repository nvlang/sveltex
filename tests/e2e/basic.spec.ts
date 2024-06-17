import { test, expect } from '@playwright/test';
import { hrefs } from './generate-tests.js';

// Function to sanitize href for use as a filename
const sanitizeFilename = (href: string) => href.replace(/[\/:]/g, '_');

test('visual regression integration tests', async ({ page }) => {
    for (const href of hrefs) {
        // console.log('Visiting:', href);
        await page.goto(href);
        await expect(page).toHaveScreenshot(`${sanitizeFilename(href)}.png`, {
            fullPage: true,
        });
    }
});
