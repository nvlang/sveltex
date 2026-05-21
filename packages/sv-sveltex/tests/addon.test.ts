import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import addon from '../src/index.js';
import { setupTest } from './setup/suite.js';

/**
 * Absolute path to the local `@nvl/sveltex` package in this monorepo. The test
 * file lives at `packages/sv-sveltex/tests/`, so `../../sveltex/` resolves to
 * the sibling `packages/sveltex/` package.
 */
const localSveltexPkgDir = fileURLToPath(
    new URL('../../sveltex/', import.meta.url),
);

const { test, testCases } = setupTest(
    { addon },
    {
        kinds: [
            {
                type: 'default',
                options: {
                    [addon.id]: {
                        markdownBackend: 'unified',
                        codeBackend: 'shiki',
                        mathBackend: 'mathjax',
                        demoRoute: true,
                    },
                },
            },
            {
                type: 'minimal',
                options: {
                    [addon.id]: {
                        markdownBackend: 'none',
                        codeBackend: 'none',
                        mathBackend: 'none',
                        demoRoute: false,
                    },
                },
            },
        ],
        // SvelTeX requires SvelteKit, so only the `kit-*` variants apply.
        filter: (testCase) => testCase.variant.includes('kit'),
        browser: false,
        // `preAdd` patches the shared workspace root's `pnpm-workspace.yaml`
        // before the harness's real `pnpm install` of each scaffolded project
        // (the assertions only inspect generated files, not a working
        // install):
        //
        //   - `overrides`: the add-on pins `@nvl/sveltex` to `^0.5.0`, not yet
        //     on npm — redirect it to the local monorepo package via a
        //     relative `file:` specifier so the install resolves.
        //
        //   - `allowBuilds`: pnpm 11 runs a dependency's install script only
        //     when it is allow-listed, and a fresh install hard-errors on an
        //     undecided one. Decide the scaffolded SvelteKit projects' two
        //     build-script dependencies so the install needs no
        //     `dangerouslyAllowAllBuilds`.
        preAdd: ({ cwd }) => {
            // Each scaffolded project is a direct child of the shared
            // workspace root, so the root is the project's parent. `preAdd`
            // runs once per project; the edits below are idempotent.
            const workspaceRoot = path.dirname(cwd);
            const workspaceYamlPath = path.resolve(
                workspaceRoot,
                'pnpm-workspace.yaml',
            );
            let workspaceYaml = fs.readFileSync(workspaceYamlPath, 'utf8');

            // `file:` overrides are resolved relative to the workspace root.
            // POSIX separators keep the specifier valid on every platform.
            const relativeSveltex = path
                .relative(workspaceRoot, localSveltexPkgDir)
                .split(path.sep)
                .join('/');
            if (!workspaceYaml.includes('overrides:')) {
                workspaceYaml =
                    `${workspaceYaml.trimEnd()}\n` +
                    `overrides:\n` +
                    `  '@nvl/sveltex': 'file:${relativeSveltex}'\n`;
            }

            // Replace whatever `allowBuilds` the scaffold left (it may carry
            // pnpm's `set this to true or false` placeholders) with a decided
            // list covering the scaffolded projects' build-script deps.
            workspaceYaml =
                workspaceYaml
                    .replace(/^allowBuilds:\n(?: .*\n?)*/mu, '')
                    .trimEnd() +
                '\nallowBuilds:\n  core-js-pure: true\n  esbuild: true\n';

            fs.writeFileSync(workspaceYamlPath, workspaceYaml, 'utf8');
        },
    },
);

test.concurrent.for(testCases)(
    'sveltex $kind.type $variant',
    (testCase, ctx) => {
        const cwd = ctx.cwd(testCase);
        const isDefaultKind = testCase.kind.type === 'default';

        // `sveltex.config.js` was created with the expected backends — always
        // `.js`, even for TypeScript projects, so the generated
        // `svelte.config.js` can import it on every supported Node version.
        const sveltexConfig = fs.readFileSync(
            path.resolve(cwd, 'sveltex.config.js'),
            'utf8',
        );
        expect(sveltexConfig).toContain(
            "import { sveltex } from '@nvl/sveltex'",
        );
        expect(sveltexConfig).toContain('await sveltex(');
        if (isDefaultKind) {
            expect(sveltexConfig).toContain("markdownBackend: 'unified'");
            expect(sveltexConfig).toContain("codeBackend: 'shiki'");
            expect(sveltexConfig).toContain("mathBackend: 'mathjax'");
        } else {
            expect(sveltexConfig).toContain("markdownBackend: 'none'");
        }

        // `svelte.config.js` was wired up. (SvelteKit projects use a `.js`
        // Svelte config even when the project itself is TypeScript.)
        const svelteConfig = fs.readFileSync(
            path.resolve(cwd, 'svelte.config.js'),
            'utf8',
        );
        expect(svelteConfig).toContain('sveltexPreprocessor');
        expect(svelteConfig).toContain('sveltex.config');
        expect(svelteConfig).toContain('.sveltex');

        // `@nvl/sveltex` is a dev dependency of the consumer.
        const pkg = JSON.parse(
            fs.readFileSync(path.resolve(cwd, 'package.json'), 'utf8'),
        ) as { devDependencies?: Record<string, string> };
        expect(pkg.devDependencies?.['@nvl/sveltex']).toBeDefined();
        if (isDefaultKind) {
            expect(pkg.devDependencies?.['unified']).toBeDefined();
            expect(pkg.devDependencies?.['shiki']).toBeDefined();
            expect(pkg.devDependencies?.['@mathjax/src']).toBeDefined();
        }

        // The demo route is created only when requested.
        const demoRoutePath = path.resolve(
            cwd,
            'src/routes/sveltex-demo/+page.sveltex',
        );
        expect(fs.existsSync(demoRoutePath)).toBe(isDefaultKind);
    },
);
