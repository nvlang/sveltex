import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { globSync } from 'glob';

interface PackageJson {
    version?: string | undefined;
    [key: string]: unknown;
}

function readJson(filePath: string): PackageJson {
    const data = readFileSync(filePath, 'utf8');
    return JSON.parse(data) as PackageJson;
}

function writeJson(filePath: string, obj: unknown): void {
    writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function getVersion(filePath: string): string {
    const json = readJson(filePath);
    if (typeof json.version === 'string') {
        return json.version;
    }
    throw new Error(`Invalid version in ${filePath}`);
}

function updateVersion(filePath: string, newVersion: string): void {
    const json = readJson(filePath);
    if (typeof json.version !== 'string') {
        throw new Error(`Invalid version in ${filePath}`);
    }
    json.version = newVersion;
    writeJson(filePath, json);
}

function syncVersions(): void {
    const packageJsonFiles = globSync(
        'packages/!(vscode-sveltex)/package.json',
    );

    for (const packageJsonPath of packageJsonFiles) {
        const packageDir = dirname(packageJsonPath);
        const jsrJsonPath = join(packageDir, 'jsr.json');

        // Most workspace packages are npm-only; only a few are also
        // mirrored to JSR. Skip the rest silently rather than spamming
        // "Error processing …" for every missing `jsr.json`.
        if (!existsSync(jsrJsonPath)) continue;

        try {
            const npmVersion = getVersion(packageJsonPath);
            const jsrVersion = getVersion(jsrJsonPath);

            if (npmVersion !== jsrVersion) {
                console.info(
                    `Updating version in ${jsrJsonPath}: ${jsrVersion} → ${npmVersion}`,
                );
                updateVersion(jsrJsonPath, npmVersion);
            }
        } catch (error) {
            console.error(`Error processing ${packageJsonPath}: ${error}`);
        }
    }
}

syncVersions();
