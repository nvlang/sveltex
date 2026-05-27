import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['./tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        testTimeout: 20_000,
        // The spawn-based `server.test.ts` forks a child language server (which
        // in turn forks `svelte-language-server`); its before/after hooks need
        // generous headroom over the 10s default when the machine is loaded.
        hookTimeout: 30_000,
        coverage: {
            provider: 'v8',
            enabled: true,
            include: ['src/**/*.ts'],
            reporter: ['text', 'text-summary', 'json', 'lcov'],
            reportOnFailure: true,
            // The whole language server is held at 100% — every uncovered
            // branch is either tested or carries a justified `/* v8 ignore */`.
            // The gate fails the run (and CI) if any metric regresses.
            thresholds: {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
            },
        },
    },
});
