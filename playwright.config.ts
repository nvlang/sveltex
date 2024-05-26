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
            use: { ...devices['Desktop Chrome'] },
            retries: 3,
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            retries: 3,
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            retries: 3,
        },
        // {
        //     name: 'full-examples/unified',
        //     testDir: './e2e/full-examples/unified',
        //     use: {
        //         baseURL: 'http://127.0.0.1:3001',
        //     },
        // },
        // {
        //     name: 'full-examples/marked',
        //     testDir: './e2e/full-examples/marked',
        //     use: {
        //         baseURL: 'http://127.0.0.1:3002',
        //     },
        // },
    ],

    /* Run your local dev server before starting the tests */
    webServer: [
        {
            cwd: './e2e/full-examples/markdown-it/',
            command: 'pnpm build && pnpm preview',
            url: 'http://localhost:3001',
            reuseExistingServer: !process.env['CI'],
            timeout: 40000,
        },
        {
            cwd: './e2e/full-examples/marked/',
            command: 'pnpm build && pnpm preview',
            url: 'http://localhost:3002',
            reuseExistingServer: !process.env['CI'],
            timeout: 40000,
        },
        {
            cwd: './e2e/full-examples/micromark/',
            command: 'pnpm build && pnpm preview',
            url: 'http://localhost:3003',
            reuseExistingServer: !process.env['CI'],
            timeout: 40000,
        },
        {
            cwd: './e2e/full-examples/unified/',
            command: 'pnpm build && pnpm preview',
            url: 'http://localhost:3004/',
            reuseExistingServer: !process.env['CI'],
            timeout: 40000,
        },
    ],
});

/* Opt out of parallel tests on CI. */
if (process.env['CI']) {
    config.workers = 1;
}

export default config;
