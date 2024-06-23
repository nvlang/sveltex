import { basename, join, readFile, writeFile } from '$deps.js';
import { glob } from '$dev_deps.js';

const readmes = await glob('../../../src/**/README.md', { maxDepth: 10 });

readmes.map(async (readmePath) => {
    const readme = await readFile(readmePath, 'utf-8');
    const siblings = await glob(readmePath.replace(/README\.md$/, '*'), {
        maxDepth: 10,
    });
    const descriptions = siblings.map(async (sibling) => {
        let description: string | undefined;
        if (sibling.endsWith('/')) {
            description = await getDirectoryDescription(sibling);
        } else {
            description = await getFileDescription(sibling);
        }
        let b = basename(sibling);
        return [`[\`${b}\`](${b})`, description];
    });
    const data = await Promise.all(descriptions);
    const tableBody = data.map(([name, description]) => {
        return `| ${name} | ${description ?? ''} |`;
    });
    const table = `| Location | Description |\n|:---|:---|\n${tableBody.join('\n')}`;
    let newReadme = readme.replace(
        /^\|\s*Location\s*\|\s*Description\s*\|(?:(?:\r\n?|\n)\|.*\|$)*/im,
        table,
    );
    if (!newReadme.includes(table)) newReadme += `\n\n${table}`;
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
                /^\s*(?:\/\/.*(?:\r\n?|\n))*\/\/ File description:[ \t]?(.*(?:\r\n?|\n)(?:\/\/.*(?:\r\n?|\n))*)/i,
            )?.[1]
            ?.replace(/(?:(?:\r\n?|\n)\/\/[ \t]?)/gm, ' ');
    } catch (e) {
        return undefined;
    }
}
