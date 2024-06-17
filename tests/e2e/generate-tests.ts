import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { backendConfigs } from './sveltex.config';
import { glob } from 'glob';
import { dirname, join, relative } from 'path';

await rm('src/routes/generated', { recursive: true, force: true });
// await rm('src/routes/+page.svelte', { recursive: true, force: true });
await rm('src/sveltex', { recursive: true, force: true });
await rm('static/sveltex', { recursive: true, force: true });
await rm('node_modules/.cache', { recursive: true, force: true });
await mkdir('static', { recursive: true });

// Function to use glob to read all markdown files
const pages = await glob(`pages/**/*.md`, { maxDepth: 10 });

await Promise.all(
    backendConfigs.map(async ([markdownBackend, codeBackend, mathBackend]) => {
        await Promise.all(
            pages.map(async (page) => {
                const pre = `src/routes/generated/${markdownBackend}-${codeBackend}-${mathBackend}`;
                const dir = join(
                    pre,
                    relative('pages', page).replace(/\.md$/, ''),
                );
                console.log('Creating directory:', dir);
                await mkdir(dir, { recursive: true });
                const dest = join(
                    dir,
                    `+page.${markdownBackend.replace(/-/g, '')}AND${codeBackend.replace(/-/g, '')}AND${mathBackend.replace(/-/g, '')}ANDsveltex`,
                );
                console.log('Copying', page, 'to', dest);
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
    await glob('tests/e2e/src/routes/generated/**/+page.*', { absolute: false })
).map((path) => dirname(relative('tests/e2e/src/routes', path)));

// await writeFile(
//     'tests/e2e/src/routes/+page.svelte',
//     `
// <ul>
//     ${hrefs.map((href) => `<li><a href="${href}"><code>${href}</code></a></li>`).join('\n')}
// </ul>
// `,
// );
