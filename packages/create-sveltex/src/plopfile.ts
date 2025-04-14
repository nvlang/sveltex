import type { NodePlopAPI, ActionType } from 'plop';
import { relative, resolve } from 'node:path';
import { spawnCliInstruction } from './child_process.js';
import pc from 'picocolors';

export default function (plop: NodePlopAPI) {
    plop.setHelper('contains', (array: unknown[], value: unknown) => {
        return array.includes(value);
    });
    plop.setHelper('equals', (a, b) => {
        return a === b;
    });
    plop.setGenerator('main', {
        description: 'SvelTeX generator',
        prompts: [
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name',
                default: 'my-sveltex-app',
                validate: (value: string) => {
                    if (value.length === 0) return 'Project name is required';
                    value = value.replaceAll(' ', '-');
                    // The regex is from the package.json JSON schema
                    if (
                        !/^(?:(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?\/[a-z0-9-._~])|[a-z0-9-~])[a-z0-9-._~]*/u.test(
                            value,
                        )
                    ) {
                        return 'Project name does not match regex /^(?:(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?/[a-z0-9-._~])|[a-z0-9-~])[a-z0-9-._~]*/';
                    }
                    return true;
                },
                transformer: (value: string) => value.replaceAll(' ', '-'),
                filter: (value: string) => value.replaceAll(' ', '-'),
            },
            {
                type: 'input',
                name: 'dir',
                message: 'Directory',
                default: (ans: Record<string, unknown>) => ans['projectName'],
                filter: (value: string) =>
                    resolve(value.replace(/[\\/]*$/u, '')),
            },
            {
                type: 'list',
                name: 'packageManager',
                message: 'Package manager',
                choices: ['pnpm', 'bun', 'npm', 'yarn'],
                default: 'pnpm',
            },
            {
                type: 'confirm',
                name: 'git',
                message: 'Initialize git repository',
                default: true,
            },
            {
                type: 'confirm',
                name: 'vscode',
                message: 'Add some VSCode workspace settings',
                default: false,
            },
            {
                type: 'list',
                name: 'adapter',
                message: 'Adapter',
                choices: [
                    'auto',
                    'cloudflare',
                    'cloudflare-workers',
                    'netlify',
                    'node',
                    'static',
                    'vercel',
                ],
                default: 'auto',
            },
            {
                type: 'checkbox',
                name: 'tools',
                message: 'Tools to use',
                choices: [
                    { name: 'ESLint', value: 'eslint', checked: true },
                    {
                        name: 'Prettier',
                        value: 'prettier',
                        checked: true,
                    },
                    { name: 'commitlint', value: 'commitlint' },
                    { name: 'Husky', value: 'husky' },
                    {
                        name: 'TailwindCSS',
                        value: 'tailwindcss',
                        checked: true,
                    },
                    { name: 'Vitest', value: 'vitest' },
                    { name: 'Playwright', value: 'playwright' },
                ],
            },
            {
                type: 'list',
                name: 'markdownBackend',
                message: 'Markdown backend',
                choices: [
                    { name: 'unified.js (recommended)', value: 'unified' },
                    { name: 'markdown-it', value: 'markdown-it' },
                    { name: 'micromark', value: 'micromark' },
                    { name: 'marked', value: 'marked' },
                    { name: 'None', value: 'none' },
                ],
                default: 'unified',
            },
            {
                type: 'list',
                name: 'codeBackend',
                message: 'Code backend (i.e., syntax highlighter)',
                choices: [
                    { name: 'Shiki (recommended)', value: 'shiki' },
                    { name: 'starry-night', value: 'starry-night' },
                    { name: 'highlight.js', value: 'highlight.js' },
                    { name: 'Escape only', value: 'escape' },
                    { name: 'None', value: 'none' },
                ],
                default: 'shiki',
            },
            {
                type: 'list',
                name: 'mathBackend',
                message: 'Math backend',
                choices: [
                    { name: 'MathJax', value: 'mathjax' },
                    { name: 'KaTeX', value: 'katex' },
                    { name: 'None', value: 'none' },
                ],
                default: 'mathjax',
            },
        ],
        actions: (ans) => {
            if (!ans) return [];
            const {
                adapter,
                codeBackend,
                dir,
                markdownBackend,
                mathBackend,
                packageManager,
                // projectName,
                git,
                vscode,
                tools,
            } = ans as {
                git: boolean;
                vscode: boolean;
                tools: (
                    | 'prettier'
                    | 'eslint'
                    | 'commitlint'
                    | 'husky'
                    | 'tailwindcss'
                    | 'playwright'
                    | 'vitest'
                )[];
                projectName: string;
                dir: string;
                packageManager: 'pnpm' | 'bun' | 'npm' | 'yarn';
                adapter:
                    | 'auto'
                    | 'cloudflare'
                    | 'cloudflare-workers'
                    | 'netlify'
                    | 'node'
                    | 'static'
                    | 'vercel';
                markdownBackend:
                    | 'unified'
                    | 'markdown-it'
                    | 'micromark'
                    | 'marked'
                    | 'none';
                codeBackend:
                    | 'shiki'
                    | 'starry-night'
                    | 'highlight.js'
                    | 'escape'
                    | 'none';
                mathBackend: 'mathjax' | 'katex' | 'none';
            };
            const prettier = tools.includes('prettier');
            const eslint = tools.includes('eslint');
            const commitlint = tools.includes('commitlint');
            const husky = tools.includes('husky');
            const tailwindcss = tools.includes('tailwindcss');
            const playwright = tools.includes('playwright');
            const vitest = tools.includes('vitest');

            const devDeps: string[] = [];
            const scripts: Record<string, string> = {
                dev: 'vite dev',
                build: 'vite build',
                preview: 'vite preview',
                prepare: 'svelte-kit sync' + (husky ? ' && husky' : ''),
            };

            // Dev dependencies

            devDeps.push(
                '@types/node',
                'typescript',
                'vite',
                'svelte',
                '@sveltejs/kit',
                '@sveltejs/vite-plugin-svelte',
                `@sveltejs/adapter-${adapter}`,
                '@nvl/sveltex',
            );
            if (vitest) devDeps.push('vitest');
            if (playwright) devDeps.push('@playwright/test');
            if (eslint) {
                devDeps.push(
                    'typescript-eslint',
                    'eslint-plugin-svelte',
                    'eslint-plugin-tsdoc',
                    '@typescript-eslint/parser',
                    '@typescript-eslint/eslint-plugin',
                    '@eslint/js',
                    'svelte-preprocess',
                );
                if (prettier) devDeps.push('eslint-config-prettier');
                if (vitest) devDeps.push('eslint-plugin-vitest');
                if (playwright) devDeps.push('eslint-plugin-playwright');
            }
            if (tailwindcss) {
                devDeps.push(
                    'tailwindcss',
                    '@tailwindcss/typography',
                    'postcss',
                    'postcss-import',
                    'postcss-load-config',
                    'autoprefixer',
                );
            }
            if (prettier) {
                devDeps.push('prettier', 'prettier-plugin-svelte');
                if (tailwindcss) devDeps.push('prettier-plugin-tailwindcss');
            }
            if (husky) devDeps.push('husky', 'lint-staged');
            if (commitlint) {
                devDeps.push(
                    'commitlint',
                    '@commitlint/types',
                    '@commitlint/config-conventional',
                );
            }
            devDeps.push(
                ...{
                    unified: [
                        'unified',
                        'remark-parse',
                        'remark-retext',
                        'remark-rehype',
                        'rehype-stringify',
                    ],
                    'markdown-it': ['markdown-it'],
                    micromark: ['micromark'],
                    marked: ['marked'],
                    none: [],
                }[markdownBackend],
                ...{
                    shiki: ['shiki'],
                    'starry-night': [
                        '@wooorm/starry-night',
                        'hast-util-find-and-replace',
                        'hast-util-to-html',
                    ],
                    'highlight.js': ['highlight.js'],
                    escape: [],
                    none: [],
                }[codeBackend],
                ...{
                    mathjax: ['mathjax-full'],
                    katex: ['katex'],
                    none: [],
                }[mathBackend],
            );

            // Scripts

            // Linter and formatter
            const lint = [];
            if (prettier) {
                scripts['format'] = 'prettier --write .';
                lint.push('prettier --check .');
            }
            if (eslint) {
                lint.push('eslint .');
            }
            if (lint.length > 0) {
                scripts['lint'] = lint.join(' && ');
            }

            // Vitest and Playwright
            const test = [];
            if (vitest) {
                scripts['test:unit'] = 'vitest --run';
                test.push(`${packageManager} run test:unit`);
            }
            if (playwright) {
                scripts['test:e2e'] = 'playwright test';
                test.push(`${packageManager} run test:e2e`);
            }
            if (test.length > 0) {
                scripts['test'] = test.join(' && ');
            }

            // commitlint
            if (commitlint) {
                scripts['commitlint'] = 'commitlint --edit';
            }

            // lint-staged
            if (commitlint) {
                scripts['lint-staged'] = 'lint-staged';
            }

            const actions: ActionType[] = [
                {
                    type: 'add',
                    path: '{{dir}}/package.json',
                    templateFile: '../template/package.json.hbs',
                },
                async () => {
                    await spawnCliInstruction({
                        command: packageManager,
                        args: ['add', '-D', ...devDeps],
                        cwd: dir,
                    });
                    return 'Successfully added devDependencies';
                },
                async () => {
                    const command = {
                        pnpm: 'pnpm',
                        bun: 'bunx',
                        npm: 'npx',
                        yarn: 'npx',
                    }[packageManager];
                    if (husky) {
                        await spawnCliInstruction({
                            command,
                            args: [
                                ...(packageManager === 'pnpm' ? ['dlx'] : []),
                                'husky',
                                'init',
                            ],
                            cwd: dir,
                        });
                    }
                    return 'Successfully ran "husky init"';
                },
                {
                    type: 'modify',
                    path: '{{dir}}/package.json',
                    transform: (content) => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const pkg = JSON.parse(content);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        pkg.scripts = scripts;
                        if (husky) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            pkg['lint-staged'] = {
                                '*.{js,ts,svelte}': [
                                    'prettier --write',
                                    'eslint . --no-warn-ignored',
                                ],
                            };
                        }
                        return JSON.stringify(pkg, null, 2);
                    },
                },
            ];

            if (vscode) {
                actions.push(
                    {
                        type: 'add',
                        path: '{{dir}}/.vscode/settings.json',
                        templateFile: '../template/.vscode/settings.json.hbs',
                    },
                    {
                        type: 'add',
                        path: '{{dir}}/.vscode/extensions.json',
                        templateFile: '../template/.vscode/extensions.json.hbs',
                    },
                );
            }
            if (eslint) {
                actions.push({
                    type: 'add',
                    path: '{{dir}}/eslint.config.js',
                    templateFile: '../template/eslint.config.js.hbs',
                });
            }
            if (prettier) {
                actions.push(
                    {
                        type: 'add',
                        path: '{{dir}}/.prettierrc.json',
                        templateFile: '../template/.prettierrc.json.hbs',
                    },
                    {
                        type: 'add',
                        path: '{{dir}}/.prettierignore',
                        templateFile: '../template/.prettierignore.hbs',
                    },
                );
            }
            if (husky) {
                actions.push({
                    type: 'modify',
                    path: '{{dir}}/.husky/pre-commit',
                    transform: () => {
                        return packageManager + ' run lint-staged\n';
                    },
                });
            }
            if (commitlint) {
                actions.push({
                    type: 'add',
                    path: '{{dir}}/commitlint.config.ts',
                    templateFile: '../template/commitlint.config.ts.hbs',
                });
                if (husky) {
                    actions.push({
                        type: 'add',
                        path: '{{dir}}/.husky/commit-msg',
                        templateFile: '../template/.husky/commit-msg.hbs',
                    });
                }
            }
            if (vitest) {
                actions.push({
                    type: 'add',
                    path: '{{dir}}/vitest.config.ts',
                    templateFile: '../template/vitest.config.ts.hbs',
                });
                if (playwright) {
                    actions.push({
                        type: 'add',
                        path: '{{dir}}/tests/unit/example.test.ts',
                        templateFile:
                            '../template/tests/unit/example.test.ts.hbs',
                    });
                } else {
                    actions.push({
                        type: 'add',
                        path: '{{dir}}/tests/example.test.ts',
                        templateFile: '../template/tests/example.test.ts.hbs',
                    });
                }
            }
            if (playwright) {
                actions.push({
                    type: 'add',
                    path: '{{dir}}/playwright.config.ts',
                    templateFile: '../template/playwright.config.ts.hbs',
                });
                if (vitest) {
                    actions.push({
                        type: 'add',
                        path: '{{dir}}/tests/e2e/example.test.ts',
                        templateFile:
                            '../template/tests/e2e/example.test.ts.hbs',
                    });
                } else {
                    actions.push({
                        type: 'add',
                        path: '{{dir}}/tests/example.test.ts',
                        templateFile: '../template/tests/example.test.ts.hbs',
                    });
                }
            }
            if (tailwindcss) {
                actions.push(
                    {
                        type: 'add',
                        path: '{{dir}}/tailwind.config.js',
                        templateFile: '../template/tailwind.config.js.hbs',
                    },
                    {
                        type: 'add',
                        path: '{{dir}}/postcss.config.js',
                        templateFile: '../template/postcss.config.js.hbs',
                    },
                );
            }
            actions.push({
                type: 'add',
                path: '{{dir}}/static/favicon.png',
                templateFile: '../template/static/favicon.png',
            });
            actions.push(
                {
                    type: 'add',
                    path: `{{dir}}/src/app.${tailwindcss ? 'pcss' : 'css'}`,
                    templateFile: '../template/src/app.pcss.hbs',
                },
                ...[
                    'svelte.config.js',
                    'sveltex.config.js',
                    'tsconfig.json',
                    'vite.config.ts',
                    '.gitignore',
                    'src/app.d.ts',
                    'src/app.html',
                    'src/routes/+page.sveltex',
                    'src/routes/+layout.svelte',
                    'src/lib/components/Example.svelte',
                ].map((path) => ({
                    type: 'add',
                    templateFile: `../template/${path}.hbs`,
                    path: `{{dir}}/${path}`,
                })),
            );
            if (git) {
                actions.push(async () => {
                    await spawnCliInstruction({
                        command: 'git',
                        args: ['init'],
                        cwd: dir,
                    });
                    return [`Successfully ran "git init"`].join('\n');
                });
            }
            actions.push(async () => {
                await spawnCliInstruction({
                    command: packageManager,
                    args: ['install'],
                    cwd: dir,
                });
                return [
                    `Successfully ran "${packageManager} install"`,
                    '',
                    'Next steps:',
                    '  1: ' +
                        pc.bold(pc.cyan(`cd ${relative(process.cwd(), dir)}`)),
                    '  2: ' + pc.bold(pc.cyan(`${packageManager} run dev`)),
                    '',
                    'To close the dev server, press ' +
                        pc.bold(pc.cyan('CTRL+C')),
                ].join('\n');
            });
            return actions;
        },
    });
}
