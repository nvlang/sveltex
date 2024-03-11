import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
// import projectConfig from './project.config.js';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        include: ['./tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        coverage: {
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                '**/node_modules/**',
                '**/tests/**',
                '**/dist/**',
                '**/coverage/**',
                '**/*.config.{ts,js,cjs,mjs,jsx,tsx}',
                '**/*.d.ts',
                '**/external/**',
            ],
        },
        globals: true, // fixes VS Code Vitest extension issues (see https://github.com/vitest-dev/vscode/issues/47)
    },
});
