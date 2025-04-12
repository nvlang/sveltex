import eslint from '@eslint/js';
import vitest from 'eslint-plugin-vitest';
// import prettierConfig from 'eslint-config-prettier/flat';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
    {
        ignores: [
            '.DS_Store',
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/html/**',
            '**/tests/e2e/**',
        ],
    },
    eslint.configs.recommended,
    tseslint.configs.stylisticTypeChecked,
    tseslint.configs.strictTypeChecked,
    {
        rules: {
            'no-duplicate-imports': 'warn',
            'no-inner-declarations': 'warn',
            'no-self-compare': 'warn',
            'no-promise-executor-return': 'warn',
            'require-atomic-updates': 'warn',
            'no-useless-assignment': 'warn',

            /**
             * Disabled in favor of `@typescript-eslint/class-methods-use-this`.
             */
            'class-methods-use-this': 'off',

            /**
             * Enforce that class methods utilize this.
             *
             * @see https://eslint.org/docs/latest/rules/class-methods-use-this
             */
            '@typescript-eslint/class-methods-use-this': 'error',

            /**
             * Enforce the use of u or v flag on regular expressions.
             *
             * @see https://eslint.org/docs/latest/rules/require-unicode-regexp
             */
            'require-unicode-regexp': 'warn',

            /**
             * Require rest parameters instead of arguments.
             *
             * @see https://eslint.org/docs/latest/rules/prefer-rest-params
             */
            'prefer-rest-params': 'error',

            /**
             * Disallow use of the RegExp constructor in favor of regular
             * expression literals.
             *
             * @see https://eslint.org/docs/latest/rules/prefer-regex-literals
             */
            'prefer-regex-literals': 'warn',

            /**
             * Require symbol descriptions.
             *
             * @see https://eslint.org/docs/latest/rules/symbol-description
             */
            'symbol-description': 'warn',

            /**
             * Require constructor names to begin with a capital letter.
             *
             * @see https://eslint.org/docs/latest/rules/new-cap
             */
            'new-cap': 'warn',

            /**
             * Require the use of `===` and `!==`.
             *
             * @see https://eslint.org/docs/latest/rules/eqeqeq
             */
            eqeqeq: 'warn',

            /**
             * Disallow the use of `eval()`.
             *
             * @see https://eslint.org/docs/latest/rules/no-eval
             */
            'no-eval': 'error',

            /**
             * Disallow extending native types.
             *
             * @see https://eslint.org/docs/latest/rules/no-extend-native
             */
            'no-extend-native': 'error',

            /**
             * Disallow unnecessary calls to `.bind()`.
             *
             * @see https://eslint.org/docs/latest/rules/no-extra-bind
             */
            'no-extra-bind': 'warn',

            /**
             * Disallow the use of `eval()`-like methods.
             *
             * @see https://eslint.org/docs/latest/rules/no-implied-eval
             */
            'no-implied-eval': 'error',

            /**
             * Disallow use of `this` in contexts where the value of `this` is
             * `undefined`.
             *
             * @see https://eslint.org/docs/latest/rules/no-invalid-this
             */
            'no-invalid-this': 'error',

            /**
             * Disallow the use of the `__iterator__` property.
             *
             * @see https://eslint.org/docs/latest/rules/no-iterator
             */
            'no-iterator': 'error',

            /**
             * Disallow `new` operators outside of assignments or comparisons.
             *
             * @see https://eslint.org/docs/latest/rules/no-new
             */
            'no-new': 'error',

            /**
             * Disallow `new` operators with the `String`, `Number`, and
             * `Boolean` objects.
             *
             * @see https://eslint.org/docs/latest/rules/no-new-wrappers
             */
            'no-new-wrappers': 'error',

            /**
             * Disallow use of chained assignment expressions.
             *
             * @see https://eslint.org/docs/latest/rules/no-multi-assign
             */
            'no-multi-assign': 'warn',

            /**
             * Disallow unnecessary nested blocks.
             *
             * @see https://eslint.org/docs/latest/rules/no-lone-blocks
             */
            'no-lone-blocks': 'warn',

            /**
             * Disallow `new` operators with the `Function` object.
             *
             * @see https://eslint.org/docs/latest/rules/no-new-func
             */
            'no-new-func': 'error',

            /**
             * Disabled in favor of `@typescript-eslint/default-param-last`.
             */
            'default-param-last': 'off',

            /**
             * Enforce default parameters to be last.
             *
             * @see https://typescript-eslint.io/rules/default-param-last/
             */
            '@typescript-eslint/default-param-last': 'error',

            /**
             * Require explicit accessibility modifiers on class properties and
             * methods.
             *
             * @see
             * https://typescript-eslint.io/rules/explicit-member-accessibility/
             */
            '@typescript-eslint/explicit-member-accessibility': 'warn',

            /**
             * Require any function or method that returns a Promise to be
             * marked async.
             *
             * @see https://typescript-eslint.io/rules/promise-function-async/
             */
            '@typescript-eslint/promise-function-async': 'error',

            /**
             * Require switch-case statements to be exhaustive.
             *
             * @see
             * https://typescript-eslint.io/rules/switch-exhaustiveness-check/
             */
            '@typescript-eslint/switch-exhaustiveness-check': [
                'warn',
                { considerDefaultExhaustiveForUnions: true },
            ],

            /**
             * Disallow empty exports that don't change anything in a module
             * file.
             *
             * @see https://typescript-eslint.io/rules/no-useless-empty-export/
             */
            '@typescript-eslint/no-useless-empty-export': 'error',

            /**
             * Require private members to be marked as readonly if they're never
             * modified outside of the constructor.
             *
             * @see https://typescript-eslint.io/rules/prefer-readonly/
             */
            '@typescript-eslint/prefer-readonly': 'warn',

            /** Disabled in favor of `@typescript-eslint/no-loop-func`. */
            'no-loop-func': 'off',

            /**
             * Disallow function declarations that contain unsafe references
             * inside loop statements.
             *
             * @see https://typescript-eslint.io/rules/no-loop-func/
             */
            '@typescript-eslint/no-loop-func': 'error',

            /** Disabled in favor of `@typescript-eslint/no-shadow`. */
            'no-shadow': 'off',

            /**
             * Disallow variable declarations from shadowing variables declared
             * in the outer scope.
             *
             * @see https://typescript-eslint.io/rules/no-shadow/
             */
            '@typescript-eslint/no-shadow': 'error',

            /**
             * Disallow unnecessary assignment of constructor property
             * parameter.
             *
             * @see
             * https://typescript-eslint.io/rules/no-unnecessary-parameter-property-assignment/
             */
            '@typescript-eslint/no-unnecessary-parameter-property-assignment':
                'warn',
        },
    },
    {
        files: ['**/*.ts'],
        plugins: { tsdoc },
        rules: { 'tsdoc/syntax': 'warn' },
    },
    {
        languageOptions: {
            // parser: tseslint.parser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                projectService: {
                    defaultProject: 'tsconfig.json',
                },
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
        },
    },
    {
        // JavaScript files
        files: ['**/*.js'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        // Vitest test files
        files: ['packages/*/tests/unit/**/*.{test,spec}.ts'],
        plugins: { vitest },
        rules: {
            ...vitest.configs.recommended.rules,
            'vitest/expect-expect': 'off',
        },
        languageOptions: {
            globals: vitest.environments.env.globals,
        },
    },
    {
        // Playwright test files
        files: ['packages/*/tests/e2e/**/*.{test,spec}.ts'],
        plugins: { playwright },
        extends: [playwright.configs.recommended.rules],
    },
    // prettierConfig,
);
