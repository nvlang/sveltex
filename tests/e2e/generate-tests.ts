import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { backendConfigs } from './sveltex.config.js';
import { glob } from 'glob';
import { dirname, join, resolve, relative } from 'node:path';

let cwdPrefix = '';
if (!/.*[\\/]e2e[\\/]?$/.test(process.cwd())) {
    cwdPrefix = 'tests/e2e/';
}

await rm(cwdPrefix + 'src/routes/generated', { recursive: true, force: true });
// await rm('src/routes/+page.svelte', { recursive: true, force: true });
await rm(cwdPrefix + 'src/sveltex', { recursive: true, force: true });
await rm(cwdPrefix + 'static/sveltex', { recursive: true, force: true });
await rm(cwdPrefix + 'node_modules/.cache', { recursive: true, force: true });
await mkdir(cwdPrefix + 'static', { recursive: true });

// Function to use glob to read all markdown files
const pages = await glob(cwdPrefix + 'pages/**/*.md', { maxDepth: 10 });

await Promise.all(
    backendConfigs.map(async ([markdownBackend, codeBackend, mathBackend]) => {
        await Promise.all(
            pages.map(async (page) => {
                const pre =
                    cwdPrefix +
                    `src/routes/generated/${markdownBackend}-${codeBackend}-${mathBackend}`;
                const dir = join(
                    pre,
                    relative(resolve(cwdPrefix + 'pages'), page).replace(
                        /\.md$/,
                        '',
                    ),
                );
                await mkdir(dir, { recursive: true });
                const dest = join(
                    dir,
                    `+page.${markdownBackend.replace(/-/g, '')}AND${codeBackend.replace(/-/g, '')}AND${mathBackend.replace(/-/g, '')}ANDsveltex`,
                );
                let md = await readFile(page, 'utf-8');
                md = md.replace(
                    /@@@/g,
                    `${markdownBackend}-${codeBackend}-${mathBackend}`,
                );
                await writeFile(dest, md);
            }),
        );
    }),
);

export const hrefs = (
    await glob(cwdPrefix + 'src/routes/generated/**/+page.*', {
        absolute: true,
    })
).map((path) => dirname(relative(resolve(cwdPrefix + 'src/routes'), path)));

await writeFile(
    cwdPrefix + 'src/routes/+page.svelte',
    [
        '<nav>',
        '<ul>',
        ...hrefs.map(
            (href) => `<li><a href="${href}"><code>${href}</code></a></li>`,
        ),
        '</ul>',
        '</nav>\n',
    ].join('\n'),
);
