import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export const config = defineConfig({
    testDir: './e2e/',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env['CI'],
    /* Retry on CI only */
    retries: process.env['CI'] ? 2 : 0,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        // baseURL: 'http://127.0.0.1:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },
    // testMatch: /.*\.spec\.ts/,

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chrome',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:3033',
            },
            retries: 3,
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                baseURL: 'http://localhost:3033',
            },
            retries: 3,
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
                baseURL: 'http://localhost:3033',
            },
            retries: 3,
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        cwd: './tests/e2e/',
        command: 'pnpm build && pnpm preview',
        url: 'http://localhost:3033',
        reuseExistingServer: !process.env['CI'],
        timeout: 40000,
    },
    name: 'Integration tests',
});

/* Opt out of parallel tests on CI. */
if (process.env['CI']) {
    config.workers = 1;
}

export default config;
