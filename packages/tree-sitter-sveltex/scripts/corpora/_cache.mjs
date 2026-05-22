/**
 * Tiny download-and-cache helper shared by the markdown parity corpora.
 *
 * Everything lands under `<package>/.parity-cache/downloads/`, which is
 * gitignored — corpora are fetched on first run and reused thereafter, so the
 * bench is reproducible offline once primed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, '..', '..');
export const CACHE_DIR = join(PACKAGE_ROOT, '.parity-cache');
export const DOWNLOAD_DIR = join(CACHE_DIR, 'downloads');

/**
 * Fetch `url` into `downloads/<filename>`, returning the cached text. Uses
 * `curl` (already a hard dep of the upstream-clone step) so we don't pull in
 * an HTTP library. Re-reads the cache on subsequent runs.
 *
 * @param {string} url
 * @param {string} filename
 * @returns {string}
 */
export function fetchCached(url, filename) {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const path = join(DOWNLOAD_DIR, filename);
    if (existsSync(path)) return readFileSync(path, 'utf-8');
    try {
        execFileSync('curl', ['-sSL', '--fail', '--max-time', '90', url, '-o', path], {
            stdio: ['ignore', 'ignore', 'inherit'],
        });
    } catch (e) {
        throw new Error(`Failed to download ${url}: ${e.message}`);
    }
    return readFileSync(path, 'utf-8');
}

/** Write a derived corpus artifact under the cache dir (for inspection). */
export function writeCacheArtifact(filename, text) {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
    writeFileSync(join(DOWNLOAD_DIR, filename), text);
}
