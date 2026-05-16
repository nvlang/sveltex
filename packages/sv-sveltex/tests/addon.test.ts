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
const localSveltexPkgDir = fileURLToPath(new URL('../../sveltex/', import.meta.url));

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
        // The add-on pins `@nvl/sveltex` to `^0.5.0`, which is not yet published
        // to npm. After the add-on has run, the `sv` test harness performs a
        // real `pnpm install` of every scaffolded project from a shared
        // workspace root. To keep that install resolvable (the assertions only
        // inspect generated file contents, not a working SvelTeX install), a
        // `pnpm.overrides` entry is written into that workspace-root
        // `package.json` redirecting `@nvl/sveltex` to the local monorepo
        // package via a relative `file:` specifier.
        preAdd: ({ cwd }) => {
            // The harness lays out each scaffolded project as a direct child of
            // the shared workspace root, so the root is the project's parent.
            const workspaceRoot = path.dirname(cwd);
            const rootPkgPath = path.resolve(workspaceRoot, 'package.json');
            const rootPkg = JSON.parse(
                fs.readFileSync(rootPkgPath, 'utf8'),
            ) as {
                pnpm?: { overrides?: Record<string, string> };
            };
            // `file:` overrides are resolved relative to the workspace root.
            // POSIX separators keep the specifier valid on every platform.
            const relativeSveltex = path
                .relative(workspaceRoot, localSveltexPkgDir)
                .split(path.sep)
                .join('/');
            rootPkg.pnpm ??= {};
            rootPkg.pnpm.overrides ??= {};
            rootPkg.pnpm.overrides['@nvl/sveltex'] = `file:${relativeSveltex}`;
            fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg), 'utf8');
        },
    },
);

test.concurrent.for(testCases)(
    'sveltex $kind.type $variant',
    (testCase, ctx) => {
        const cwd = ctx.cwd(testCase);
        const language = testCase.variant.includes('ts') ? 'ts' : 'js';
        const isDefaultKind = testCase.kind.type === 'default';

        // `sveltex.config.{js,ts}` was created with the expected backends.
        const sveltexConfig = fs.readFileSync(
            path.resolve(cwd, `sveltex.config.${language}`),
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
