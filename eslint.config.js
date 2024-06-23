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
            '**/node_modules/**',
            'dist',
            '/package',
            'tests/e2e',
            '.env',
            '.env.*',
            '!.env.example',
            'pnpm-lock.yaml',
            'package-lock.json',
            'yarn.lock',
            'external',
            'examples',
            'legacy',
            'coverage',
            'ideas',
            'docs',
        ],
    },
    {
        // TypeScript files
        files: ['{src,tests}/**/*.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.stylisticTypeChecked,
            ...tseslint.configs.strictTypeChecked,
        ],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: 'tsconfig.json',
                projectService: true,
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
        files: ['tests/unit/**/*.{test,spec}.ts'],
        plugins: { vitest },
        rules: vitest.configs.recommended.rules,
        languageOptions: {
            globals: vitest.environments.env.globals,
        },
    },
    {
        // Playwright test files
        files: ['tests/e2e/**/*.{test,spec}.ts'],
        plugins: { playwright },
        rules: playwright.configs.recommended.rules,
    },
    prettierConfig,
);
