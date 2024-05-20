// External dependencies
import {
    existsSync,
    readFileSync,
    mkdir,
    readFile,
    rename,
    writeFile,
    dirname,
} from '$deps.js';

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

/**
 * Checks if a file or directory exists at the specified path.
 *
 * @param path - The path to check.
 * @returns `true` if the path exists, `false` otherwise.
 */
export function pathExists(path: string) {
    try {
        return fs.existsSync(path);
    } catch {
        return false;
    }
}
