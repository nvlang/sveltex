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
    testDir: './tests/e2e',
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
        baseURL: 'http://localhost:3033',

        launchOptions: {},

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },
    expect: {
        toHaveScreenshot: {
            // maxDiffPixels: 0,
        },
    },

    timeout: 300e3, // 5 minutes
    // testMatch: /.*\.spec\.ts/,

    /* Configure projects for major browsers */
    projects: [
        { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        // For some reason, webkit was messing with Playwright? I kept getting
        // the error "Error: could not decode image as PNG.". I'm not sure why.
        // I'll try to investigate this at some later point in time.
        // {
        //     name: 'webkit',
        //     use: {
        //         ...devices['Desktop Safari'],
        //     },
        // },
        // {
        //     name: 'iPhone SE',
        //     use: {
        //         ...devices['iPhone SE'],
        //         colorScheme: 'dark',
        //         // browserName: 'chromium',
        //     },
        // },
        {
            name: 'Galaxy S9+',
            use: {
                ...devices['Galaxy S9+'],
                colorScheme: 'no-preference',
                browserName: 'chromium',
            },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        cwd: 'tests/e2e',
        command: 'pnpm preview',
        url: 'http://localhost:3033',
        reuseExistingServer: !process.env['CI'],
        timeout: 600e3, // 10 minutes
    },
    name: 'Integration tests',
});

// config.fullyParallel = true;

/* Opt out of parallel tests on CI. */
// if (process.env['CI']) {
//     config.workers = 1;
// }

export default config;
