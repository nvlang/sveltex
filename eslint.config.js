import eslint from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import prettierConfig from 'eslint-config-prettier';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

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
        ],
    },
    {
        // TypeScript files
        files: ['**/*.ts'],
        /**
         * For some reason I kept getting errors from this file, so as a temporary workaround I
         * simply added it to the ignore list.
         *
         * @see
         * https://typescript-eslint.io/troubleshooting/#i-get-errors-telling-me-eslint-was-configured-to-run--however-that-tsconfig-does-not--none-of-those-tsconfigs-include-this-file
         */
        ignores: ['src/index.d.ts'],
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
            jest: jestPlugin,
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
        // Jest test files
        files: ['tests/**'],
        ...jestPlugin.configs['flat/recommended'],
    },
    prettierConfig,
);
