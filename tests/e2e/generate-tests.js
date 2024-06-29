import { backendConfigs } from './sveltex.config.js';
import { globSync } from 'glob';
import { dirname, join, resolve, relative } from 'node:path';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

let cwdPrefix = '';
if (!/.*[\\/]e2e[\\/]?$/.test(process.cwd())) {
    cwdPrefix = 'tests/e2e/';
}

rmSync(cwdPrefix + 'src/routes/generated', { recursive: true, force: true });
rmSync(cwdPrefix + 'src/routes/+page.svelte', {
    recursive: true,
    force: true,
});
rmSync(cwdPrefix + 'src/sveltex', { recursive: true, force: true });
rmSync(cwdPrefix + 'static/sveltex', { recursive: true, force: true });
rmSync(cwdPrefix + 'node_modules/.cache', {
    recursive: true,
    force: true,
});
mkdirSync(cwdPrefix + 'static', { recursive: true });

// Function to use glob to read all markdown files
const pages = globSync(cwdPrefix + 'pages/**/*.md', { maxDepth: 10 });

backendConfigs().forEach(([markdownBackend, codeBackend, mathBackend]) => {
    const basename = `+page.${markdownBackend.replace(/-/g, '')}AND${codeBackend.replace(/-/g, '')}AND${mathBackend.replace(/-/g, '')}ANDsveltex`;
    pages.forEach(async (page) => {
        // Skip commutative-diagrams test with KaTeX, since it tests a
        // MathJax-specific feature
        if (page.includes('commutative-diagrams') && mathBackend === 'katex') {
            return;
        }
        const pre =
            cwdPrefix +
            `src/routes/generated/${markdownBackend}-${codeBackend}-${mathBackend}`;
        const dir = join(
            pre,
            relative(resolve(cwdPrefix + 'pages'), page).replace(/\.md$/, ''),
        );
        mkdirSync(dir, { recursive: true });
        const dest = join(dir, basename);
        let md = readFileSync(page, 'utf-8');
        md = md.replace(
            /@@@/g,
            `${markdownBackend}-${codeBackend}-${mathBackend}`,
        );
        writeFileSync(dest, md);
    });

    const mathBackendPretty = {
        katex: 'KaTeX',
        'mathjax-chtml': 'MathJax (CHTML)',
        'mathjax-svg': 'MathJax (SVG)',
    }[mathBackend];

    writeFileSync(
        join(
            cwdPrefix,
            'specs',
            `${markdownBackend}-${codeBackend}-${mathBackend}.spec.ts`,
        ),
        `
import { test, expect } from '@playwright/test';
import { globSync } from 'glob';
import { dirname, relative, resolve } from 'node:path';

// Function to sanitize href for use as a filename
const sanitizeFilename = (href: string) => href.replace(/[\\\\/:]/g, '_');

test('${markdownBackend} + ${codeBackend} + ${mathBackendPretty}', async ({ page }) => {
    let cwdPrefix = '';
    if (!/.*[\\\\/]e2e[\\\\/]?$/.test(process.cwd())) {
        cwdPrefix = 'tests/e2e/';
    }
    const hrefs = globSync(cwdPrefix + 'src/routes/generated/**/${basename}', {
        absolute: true,
    }).map((path) =>
        dirname(relative(resolve(cwdPrefix + 'src/routes'), path)),
    );
    for (const href of hrefs) {
        await page.goto(href);
        await expect(page).toHaveScreenshot(\`\${sanitizeFilename(href)}.png\`, {
            fullPage: true,
        });
    }
});

`,
    );
});

const hrefs = globSync(cwdPrefix + 'src/routes/generated/**/+page.*', {
    absolute: true,
}).map((path) => dirname(relative(resolve(cwdPrefix + 'src/routes'), path)));

writeFileSync(
    cwdPrefix + 'src/routes/+page.svelte',
    [
        '<nav>',
        '<ul>',
        ...hrefs
            .map(
                (href) => `<li><a href="${href}"><code>${href}</code></a></li>`,
            )
            .sort(),
        '</ul>',
        '</nav>\n',
    ].join('\n'),
);

console.log('generate-tests.ts: Done.');
