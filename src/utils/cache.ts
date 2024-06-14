// Internal dependencies
import { defaultCacheDirectory } from '$config/defaults.js';
import { log, prettifyError } from '$utils/debug.js';
import { fs } from '$utils/fs.js';

// External dependencies
import { Glob, join, normalize, pathSep, resolve, rimraf } from '$deps.js';
import { ensureEndsWith } from '$utils/misc.js';

export type KeyPath = `${string}/${string}`;
type HashSHA256 = string;

interface IntFileInfo {
    hash: HashSHA256;
    sourceHash: HashSHA256;
}

interface SvgFileInfo {
    // /**
    //  * The name of the Svelte component file which contains the SVG code.
    //  */
    // file: `${string}.svelte`;
    sourceHash: HashSHA256;
    /**
     * The "key path" of the source file that generated this SVG file.
     */
    // sourceKeyPath: KeyPath;
}

interface SveltexCacheJson {
    int: Record<KeyPath, IntFileInfo>;
    svg: Record<KeyPath, SvgFileInfo>;
}

export class SveltexCache {
    readonly outputDirAbs: string;
    readonly cacheDirAbs: string;
    readonly cacheDirGlob: Glob<{ follow: false; maxDepth: 100 }>;
    readonly pathToCacheJson: string;
    readonly data: SveltexCacheJson;

    private constructor(
        outputDirectory: string,
        cacheDirectory: string,
        cache: SveltexCacheJson,
        pathToCacheJson: string = join(cacheDirectory, 'cache.json'),
    ) {
        this.data = cache;
        this.pathToCacheJson = pathToCacheJson;
        this.outputDirAbs = resolve(normalize(outputDirectory));
        this.cacheDirAbs = resolve(normalize(cacheDirectory));
        this.cacheDirGlob = new Glob(join(this.cacheDirAbs, '*/**/'), {
            follow: false,
            maxDepth: 100,
        });
    }

    static async load(
        outputDirectory: string,
        cacheDirectory: string = defaultCacheDirectory,
    ): Promise<SveltexCache> {
        const pathToCacheJson = join(cacheDirectory, 'cache.json');
        try {
            const cache = JSON.parse(
                await fs.readFile(pathToCacheJson, { encoding: 'utf8' }),
            ) as SveltexCacheJson;
            return new SveltexCache(
                outputDirectory,
                cacheDirectory,
                cache,
                pathToCacheJson,
            );
        } catch {
            const cache: SveltexCacheJson = {
                int: {},
                svg: {},
            };
            await fs.writeFileEnsureDir(pathToCacheJson, JSON.stringify(cache));
            return new SveltexCache(
                outputDirectory,
                cacheDirectory,
                cache,
                pathToCacheJson,
            );
        }
    }

    async save(): Promise<0 | 1> {
        try {
            await fs.writeFile(
                this.pathToCacheJson,
                JSON.stringify(this.data),
                'utf8',
            );
            return 0;
        } catch (err) {
            log(
                'error',
                `✖ Error trying to write to "${this.pathToCacheJson}":\n\n`,
                prettifyError(err),
            );
            return 1;
        }
    }

    /**
     * {@link Glob | `Glob`} objects are not serializable, so we need to ensure
     * that if anyone tries to serialize a `SvelteCache` object (which Vite
     * will), we exclude the `cacheDirGlob` property.
     */
    toJSON() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { cacheDirGlob, ...otherProps } = this;
        return otherProps;
    }

    async cleanup(): Promise<void> {
        const cachedPaths = await this.cacheDirGlob.walk();
        const usedKeyPaths = Object.keys(this.data.svg).map((kp) =>
            join(this.cacheDirAbs, kp),
        );
        const toDelete: string[] = [];
        // Question: What paths should we delete?
        //
        // Answer: We should delete all `maybeDelete` in `cachedPaths` that
        // satisfy the following conditions:
        //
        // - No path in `usedKeyPaths` is a subdirectory of `maybeDelete`.
        // - No path in `toDelete` is a parent directory of `maybeDelete`.
        //
        cachedPaths.forEach((maybeDelete) => {
            if (
                toDelete.every(
                    (del) =>
                        !dirContains(del, maybeDelete) && del !== maybeDelete,
                ) &&
                usedKeyPaths.every(
                    (kp) => !dirContains(maybeDelete, kp) && maybeDelete !== kp,
                )
            ) {
                toDelete.push(maybeDelete);
            }
        });
        await Promise.all(
            toDelete.map(async (path) => {
                log(
                    'info',
                    `Deleting unused cache subdirectory: ${path}${pathSep}`,
                );
                await rimraf(path, { maxRetries: 2 });
            }),
        );
    }
}

/**
 * @remarks
 * Returns `false` if `dir === path`, i.e., a directory does not contain itself
 * according to this function.
 */
function dirContains(dir: string, path: string) {
    dir = ensureEndsWith(normalize(dir), pathSep);
    if (path.length <= dir.length) return false;
    path = ensureEndsWith(normalize(path), pathSep);
    return path.startsWith(dir);
}
