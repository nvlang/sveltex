import { test, expect } from '@playwright/test';

// test('has title', async ({ page }) => {
//     await page.goto('https://playwright.dev/');

//     // Expect a title "to contain" a substring.
//     await expect(page).toHaveTitle(/Playwright/);
// });

/**
 * - 3001 - markdown-it
 * - 3002 - marked
 * - 3003 - micromark
 * - 3004 - unified
 */

test('unified', async ({ page }) => {
    await page.goto('http://localhost:3004/');

    // Expects page to have a heading with the name of Installation.
    await expect(
        page.getByRole('heading', { name: 'Welcome to SvelteKit' }),
    ).toBeVisible();

    // expect
    //     <body data-sveltekit-preload-data="hover">
    //         <div style="display: contents"><h1 id="welcome-to-sveltekit" data-svelte-h="svelte-bk2xii">Welcome to SvelteKit</h1> <p data-svelte-h="svelte-jl9sbz">Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p> <div id="svelte-announcer" aria-live="assertive" aria-atomic="true" style="position: absolute; left: 0px; top: 0px; clip: rect(0px, 0px, 0px, 0px); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px;"></div></div>
    // </body>

    // Expects page to have a paragraph with the text "Visit kit.svelte.dev to read the documentation".
    await expect(
        page.getByText('Visit kit.svelte.dev to read the documentation'),
    ).toBeVisible();

    // Expects page to have a link with the text "kit.svelte.dev".
    await expect(page.getByText('kit.svelte.dev')).toBeVisible();

    // Expects page to have a link with the href "https://kit.svelte.dev".
    await expect(
        page.getByRole('link', { name: 'kit.svelte.dev' }),
    ).toHaveAttribute('href', 'https://kit.svelte.dev');

    // Expect H1 to have ID "welcome-to-sveltekit"
    await expect(
        page.getByRole('heading', { name: 'Welcome to SvelteKit' }),
    ).toHaveAttribute('id', 'welcome-to-sveltekit');
});
