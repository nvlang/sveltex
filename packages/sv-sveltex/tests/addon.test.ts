import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import addon from '../src/index.js';
import { setupTest } from './setup/suite.js';

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
