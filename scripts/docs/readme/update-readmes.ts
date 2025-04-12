import { basename, join, readFile, writeFile } from '../../../src/deps.js';
import { ensureEndsWith } from '../../../src/utils/misc.js';
import { glob } from 'glob';

const readmes = await glob('../../../src/**/README.md', { maxDepth: 10 });

console.log(readmes);

readmes.map(async (readmePath) => {
    const readme = await readFile(readmePath, 'utf-8');
    const siblingFiles = await glob(
        readmePath.replace(/README\.md$/, '*.{js,ts}'),
        {
            maxDepth: 10,
            nodir: true,
        },
    );
    const siblingDirs = await glob(readmePath.replace(/README\.md$/, '*/'), {
        maxDepth: 10,
    });
    const descriptions = (
        await Promise.all(
            siblingFiles.map(async (sibling) => {
                let description: string | undefined;
                const b = basename(sibling);
                description = await getFileDescription(sibling);
                return [`[\`${b}\`](${b})`, description];
            }),
        )
    ).sort((a, b) => a[0]?.localeCompare(b[0] ?? '') ?? 0);
    const dirDescriptions = (
        await Promise.all(
            siblingDirs.map(async (sibling) => {
                let description: string | undefined;
                const b = ensureEndsWith(basename(sibling), '/');
                description = await getDirectoryDescription(sibling);
                return [`[\`${b}\`](${b})`, description];
            }),
        )
    ).sort((a, b) => a[0]?.localeCompare(b[0] ?? '') ?? 0);
    const data = [...dirDescriptions, ...descriptions];
    const tableBody = data.map(([name, description]) => {
        return `| ${name} | ${description ?? ''} |`;
    });
    const table = `| Location | Description |\n|:---|:---|\n${tableBody.join('\n')}`;
    let newReadme = readme.replace(
        /^\|\s*Location\s*\|\s*Description\s*\|(?:(?:\r\n?|\n)\|.*\|$)*/im,
        table,
    );
    if (!newReadme.includes(table)) newReadme += `\n\n${table}\n`;
    await writeFile(readmePath, newReadme);
});

async function getDirectoryDescription(
    path: string,
): Promise<string | undefined> {
    try {
        const contents = await readFile(join(path, 'README.md'), 'utf-8');
        return contents
            .match(/^\s*<!--\sDirectory description: (.*?)-->/is)?.[1]
            ?.replace(/\r\n?|\n/g, ' ');
    } catch (e) {
        return undefined;
    }
}

async function getFileDescription(path: string): Promise<string | undefined> {
    try {
        const contents = await readFile(path, 'utf-8');
        return contents
            .match(
                /^\s*(?:\/\/.*(?:\r\n?|\n))*\/\/ File description:[ \t]?(.*(?:(?:\r\n?|\n)\/\/.*)*)/i,
            )?.[1]
            ?.replace(/^\/\//gm, '')
            .replace(/\s+/g, ' ');
    } catch (e) {
        return undefined;
    }
}
