import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ensureEndsWith } from 'packages/sveltex/src/utils/misc.js';
import { glob } from 'glob';

const readmes = await glob('packages/sveltex/src/**/README.md', {
    maxDepth: 10,
});

console.log(readmes);

await Promise.all(
    readmes.map(async (readmePath) => {
        const readme = await readFile(readmePath, 'utf-8');
        const siblingFiles = await glob(
            readmePath.replace(/README\.md$/u, '*.{js,ts}'),
            {
                maxDepth: 10,
                nodir: true,
            },
        );
        const siblingDirs = await glob(
            readmePath.replace(/README\.md$/u, '*/'),
            {
                maxDepth: 10,
            },
        );
        const descriptions = (
            await Promise.all(
                siblingFiles.map(async (sibling) => {
                    const b = basename(sibling);
                    const description = await getFileDescription(sibling);
                    return [`[\`${b}\`](${b})`, description];
                }),
            )
        ).sort((a, b) => a[0]?.localeCompare(b[0] ?? '') ?? 0);
        const dirDescriptions = (
            await Promise.all(
                siblingDirs.map(async (sibling) => {
                    const b = ensureEndsWith(basename(sibling), '/');
                    const description = await getDirectoryDescription(sibling);
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
            /^\|\s*Location\s*\|\s*Description\s*\|(?:(?:\r\n?|\n)\|.*\|$)*/imu,
            table,
        );
        if (!newReadme.includes(table)) newReadme += `\n\n${table}\n`;
        await writeFile(readmePath, newReadme);
    }),
);

async function getDirectoryDescription(
    path: string,
): Promise<string | undefined> {
    try {
        const contents = await readFile(join(path, 'README.md'), 'utf-8');
        return /^\s*<!--\sDirectory description: (.*?)-->/isu
            .exec(contents)?.[1]
            ?.replace(/\r\n?|\n/gu, ' ');
    } catch {
        return undefined;
    }
}

async function getFileDescription(path: string): Promise<string | undefined> {
    try {
        const contents = await readFile(path, 'utf-8');
        return /^\s*(?:\/\/.*(?:\r\n?|\n))*\/\/ File description:[ \t]?(.*(?:(?:\r\n?|\n)\/\/.*)*)/iu
            .exec(contents)?.[1]
            ?.replace(/^\/\//gmu, '')
            .replace(/\s+/gu, ' ');
    } catch {
        return undefined;
    }
}
