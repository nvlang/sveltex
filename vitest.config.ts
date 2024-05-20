import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
// import os from 'node:os';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        include: ['./tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        exclude: ['./e2e/**/*'],
        maxConcurrency: 100,
        coverage: {
            reporter: ['text', 'json', 'html', 'lcov'],
            enabled: true,
            // processingConcurrency:
            //     os.availableParallelism?.() ?? os.cpus().length,
            exclude: [
                '**/node_modules/**',
                '**/tests/**',
                '**/dist/**',
                '**/coverage/**',
                '**/*.config.{ts,js,cjs,mjs,jsx,tsx}',
                '**/*.d.ts',
                '**/external/**',
                '**/examples/**',
                '**/e2e/**',
                '**/src/types/**',
                '**/legacy/**',
            ],
        },
        env: {
            NODE_ENV: 'development',
        },
        // globals: true, // fixes VS Code Vitest extension issues (see https://github.com/vitest-dev/vscode/issues/47)
    },
    // logLevel: 'silent',
    // customLogger: {
    //     error: () => {},
    //     warn: () => {},
    //     info: () => {},
    //     clearScreen: () => {},
    //     hasErrorLogged: () => false,
    //     hasWarned: false,
    //     warnOnce: () => {},
    // },
});
