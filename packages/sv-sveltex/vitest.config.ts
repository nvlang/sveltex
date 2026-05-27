import { defineConfig } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;

export default defineConfig({
    test: {
        include: ['tests/**/*.test.{js,ts}'],
        exclude: ['tests/setup/*'],
        testTimeout: ONE_MINUTE * 3,
        hookTimeout: ONE_MINUTE * 3,
        globalSetup: ['tests/setup/global.ts'],
        expect: {
            requireAssertions: true,
        },
        coverage: {
            provider: 'v8',
            enabled: true,
            include: ['src/**/*.ts'],
            reporter: ['text', 'text-summary', 'json', 'lcov'],
            reportOnFailure: true,
            // Every uncovered branch is either tested or carries a justified
            // `/* v8 ignore */`. The gate fails the run (and CI) if any metric
            // regresses below 100%.
            thresholds: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
            },
        },
    },
});
