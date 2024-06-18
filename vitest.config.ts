import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import os from 'node:os';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        include: ['./tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        exclude: ['./tests/e2e/**/*', './tests/unit/utils'],
        typecheck: {
            tsconfig: './tests/unit/tsconfig.json',
            enabled: true,
            only: false,
        },
        // bail: 10,
        // dir: './tests/unit',
        silent: true,
        maxConcurrency: 100,
        testTimeout: 10e3,
        coverage: {
            reporter: ['text', 'json', 'html', 'lcov'],
            enabled: true,
            processingConcurrency:
                os.availableParallelism?.() ?? os.cpus().length,
            include: ['src/**/*.ts'],
            exclude: [
                '**/node_modules/**',
                '**/tests/**',
                '**/dist/**',
                '**/coverage/**',
                '**/*.config.{ts,js,cjs,mjs,jsx,tsx}',
                '**/*.d.ts',
                '**/external/**',
                '**/examples/**',
                '**/e2e-old/**',
                '**/src/types/**',
                '**/legacy/**',
                '**/html/**',
            ],
            ignoreEmptyLines: true,
            reportOnFailure: true,
        },
        reporters: [
            'default',
            'github-actions',
            'html',
            // 'basic',
            // 'dot',
            // 'hanging-process',
            // 'json',
            // 'junit',
            // 'tap',
            // 'tap-flat',
            // 'verbose',
        ],
        // ui: true,
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
