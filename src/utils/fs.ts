import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const fs = {
    existsSync,
    readFile,
    readFileSync,
    rename,
    mkdir,
    writeFile,
    ensureDir,
    writeFileEnsureDir,
};

/**
 * Ensure that a directory exists, creating it (and any necessary intermediate
 * directories) if it does not.
 */
async function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
}

/**
 * Write content to a file, creating any necessary directories along the way. If
 * the file already exists, it will be overwritten.
 *
 * @param file - Path to the file to write.
 * @param content - Content to write to the file.
 *
 * @remarks `'utf8'` encoding is used to write the file.
 */
async function writeFileEnsureDir(file: string, content: string) {
    const dir = dirname(file);
    if (dir !== '.') await ensureDir(dir);
    await fs.writeFile(file, content, 'utf8');
}
