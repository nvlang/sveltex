import eslint from '@eslint/js';
import vitest from 'eslint-plugin-vitest';
import prettierConfig from 'eslint-config-prettier';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
    {
        ignores: [
            '.DS_Store',
            'node_modules',
            'dist',
            '/package',
            '.env',
            '.env.*',
            '!.env.example',
            'pnpm-lock.yaml',
            'package-lock.json',
            'yarn.lock',
            'external',
            'examples',
        ],
    },
    {
        // TypeScript files
        files: ['{src,tests}/**/*.ts', '{src,tests}/**/*.d.ts'],
        /**
         * For some reason I kept getting errors from this file, so as a temporary workaround I
         * simply added it to the ignore list.
         *
         * @see
         * https://typescript-eslint.io/troubleshooting/#i-get-errors-telling-me-eslint-was-configured-to-run--however-that-tsconfig-does-not--none-of-those-tsconfigs-include-this-file
         */
        // ignores: ['src/index.d.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.stylisticTypeChecked,
            ...tseslint.configs.strictTypeChecked,
        ],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: 'tsconfig.json',
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            tsdoc: tsdocPlugin,
        },
        rules: {
            'tsdoc/syntax': 'warn',
            '@typescript-eslint/no-inferrable-types': 'off',
        },
    },
    {
        // JavaScript files
        files: ['**/*.js'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        // Vitest test files
        files: ['tests/**/*.{test,spec}.ts'],
        plugins: { vitest },
        rules: vitest.configs.recommended.rules, // vitest.configs.recommended.rules,
        languageOptions: {
            globals: vitest.environments.env.globals,
        },
    },
    {
        // Playwright test files
        files: ['e2e/**/*.{test,spec}.ts'],
        plugins: { playwright },
        rules: playwright.configs.recommended.rules,
    },
    prettierConfig,
);
