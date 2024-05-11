// Internal dependencies
import { defaultCacheDirectory } from '$config/defaults.js';
import { log, prettifyError } from '$utils/debug.js';
import { fs } from '$utils/fs.js';

// External dependencies
import { Glob, join, normalize, relative, resolve, rimraf } from '$deps.js';

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
    readonly cacheDirGlob: Glob<{ follow: false; maxDepth: 5 }>;
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
        this.cacheDirGlob = new Glob(join(this.cacheDirAbs, '**/*/*/'), {
            follow: false,
            maxDepth: 5,
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
        const usedKeyPaths = Object.keys(this.data.svg);
        await Promise.all(
            cachedPaths.map(async (cachedPath) => {
                const keyPath = relative(this.cacheDirAbs, cachedPath);
                if (!usedKeyPaths.includes(keyPath)) {
                    log(
                        'info',
                        `Deleting unused cache subdirectory: ${cachedPath}/`,
                    );
                    await rimraf(cachedPath, { maxRetries: 2 });
                }
            }),
        );
    }
}
