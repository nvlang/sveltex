import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['./tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        testTimeout: 20_000,
        // The spawn-based `server.test.ts` forks a child language server (which
        // in turn forks `svelte-language-server`); its before/after hooks need
        // generous headroom over the 10s default when the machine is loaded.
        hookTimeout: 30_000,
    },
});
