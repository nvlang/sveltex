// import { LRUCache } from 'lru-cache';
// import { existsSync, unlinkSync } from 'node:fs';

import { defaultCacheDirectory } from '$src/config/defaults.js';
import { sha256, writeFileSyncEnsureDir } from '$src/utils/TexComponent.js';
import { log } from '$src/utils/log.js';
import { F_OK } from 'node:constants';
import { createWriteStream } from 'node:fs';
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path, {
    isAbsolute,
    join,
    normalize,
    relative,
    resolve,
} from 'node:path';
import { Glob, glob } from 'glob';

// interface TexComponentCache {
//     readonly hash: string;
//     texPath: `${string}.tex`;
//     svgPath: `${string}.svg`;
//     pdfOrDviPath: `${string}.${'pdf' | 'dvi'}`;
// }

// type SvgFilepath = `${string}.svg`;
// // type TexFilepath = `${string}.tex`;
// type IntFilepath = `${string}.${'pdf' | 'dvi'}`;

// type TexComponentHash = string;
// type SveltexFilename = string;

// const svgSourceMap = new Map<`${string}.svg`, `${string}.tex`>();

// // const texComponents = new Set<TexComponentCache>();

// const texOutputMap = new Map<`${string}.tex`, `${string}.svg`>();

// const fileToTexComponentsUsedMap = new Map<
//     SveltexFilename,
//     `${string}.tex`[]
// >();

// function getDeps(filename: SveltexFilename) {
//     return fileToTexComponentsUsedMap.get(filename);
// }

// Things that should stay in the cache:
// - `get`

// class MetaCache extends Map<SvgFilepath, IntFilepath[]> {
// }

/**
 * Whenever we execute a `dvisvgm` command to transform a DVI/PDF file at
 * `intFilepath` into an SVG file at `svgFilepath`, we add `intFilepath` to the
 * array stored for `svgFilepath`. If the array goes over a certain length, we
 * remove the first element from the array and delete the corresponding PDF/DVI
 * and TeX and auxiliary files.
 *
 * #### Notes
 *
 * - Changing the `ref` attribute of a TeX component in a Svelte file: to deal
 *   with this, the key in the `texComponentsMap` should be updated to the new
 *   SVG filepath, and the corresponding array of TeX components should be moved
 *   to the new key.
 * - TeX compilation failing, or DVI/PDF to SVG conversion failing:
 *   `addSvgSource` should not be called if the compilation or conversion
 *   failed, since the SVG file won't have been updated and hence it's source
 *   won't have changed. It should only be called if the compilation and the
 *   conversion *both* succeed.
 */
// export const svgSources = new Map<SvgFilepath, IntFilepath[]>();

// export function addSvgSource(
//     svgFilepath: SvgFilepath,
//     intFilepath: IntFilepath,
// ) {
//     const arr = svgSources.get(svgFilepath);
//     if (arr) {
//         if (arr.length > 10) {
//             const oldIntFilepath = arr.shift();
//             if (oldIntFilepath) {
//                 // Delete the old TeX and PDF/DVI files
//                 unlinkSync(oldIntFilepath);
//                 const matchArray = oldIntFilepath.match(/(.*)\.(pdf|dvi)/);
//                 if (!matchArray) {
//                     throw new Error(
//                         `Unexpected file extension for ${oldIntFilepath}.`,
//                     );
//                 }
//                 const oldIntFilepathBase = matchArray[1];
//                 const oldIntFilepathExt = matchArray[2];
//                 if (!oldIntFilepathBase || !oldIntFilepathExt) {
//                     throw new Error(
//                         `Unexpected file extension for ${oldIntFilepath}.`,
//                     );
//                 }
//                 const otherExt = oldIntFilepathExt === 'pdf' ? 'dvi' : 'pdf';
//                 if (existsSync(`${oldIntFilepathBase}.${otherExt}`)) {
//                     unlinkSync(`${oldIntFilepathBase}.${otherExt}`);
//                 }
//                 unlinkSync(`${oldIntFilepathBase}.tex`);
//                 unlinkSync(`${oldIntFilepathBase}.aux`);
//                 unlinkSync(`${oldIntFilepathBase}.log`);
//             }
//         }
//         arr.push(intFilepath);
//     } else {
//         svgSources.set(svgFilepath, [intFilepath]);
//     }
// }

type GeneratedFilepath = `${string}.${'svg' | 'pdf' | 'dvi'}`;
type SourceFilepath = `${string}.${'tex' | 'pdf' | 'dvi'}`;
type Filepath = `${string}.${'tex' | 'svg' | 'pdf' | 'dvi'}`;

type HashSHA256 = string;
interface SveltexCacheJson {
    hashes: Record<Filepath, HashSHA256>;
    sources: Record<GeneratedFilepath, HashSHA256>;
    __delete: Filepath[];
}

const cache = createWriteStream('cache.json');

export class SveltexCache {
    readonly globOptions = { absolute: false, follow: false };
    readonly outputDirectoryGlob: Glob<typeof this.globOptions>;
    readonly cacheDirectoryGlob: Glob<typeof this.globOptions>;
    readonly outputDirRel: string;
    readonly outputDirAbs: string;
    private readonly upToOutputDirRelRegex;
    readonly pathToCacheJson: string;
    readonly cacheDirRel: string;
    readonly cacheDirAbs: string;
    private readonly upToCacheDirRelRegex;
    private readonly cache: SveltexCacheJson;

    private constructor(
        outputDirectory: string,
        cacheDirectory: string,
        cache: SveltexCacheJson,
        pathToCacheJson: string = join(cacheDirectory, 'cache.json'),
    ) {
        this.cache = cache;
        this.cacheDirRel = normalize(cacheDirectory);
        this.outputDirRel = normalize(outputDirectory);
        this.pathToCacheJson = pathToCacheJson;
        this.outputDirectoryGlob = new Glob(
            normalize(`${this.outputDirRel}/**/*`),
            this.globOptions,
        );
        this.cacheDirectoryGlob = new Glob(
            normalize(`${this.cacheDirRel}/**/*`),
            this.globOptions,
        );
        this.outputDirAbs = resolve(this.outputDirRel);
        this.cacheDirAbs = resolve(this.cacheDirRel);
        this.upToOutputDirRelRegex = new RegExp(
            `^.*${this.outputDirRel}/?`,
            'u',
        );
        this.upToCacheDirRelRegex = new RegExp(`^.*${this.cacheDirRel}/?`, 'u');
    }

    static async load(
        outputDirectory: string,
        cacheDirectory: string = defaultCacheDirectory,
    ): Promise<SveltexCache> {
        const pathToCacheJson = join(cacheDirectory, 'cache.json');
        try {
            const cache = JSON.parse(
                await readFile(pathToCacheJson, { encoding: 'utf8' }),
            ) as SveltexCacheJson;
            return new SveltexCache(
                outputDirectory,
                cacheDirectory,
                cache,
                pathToCacheJson,
            );
        } catch {
            const cache = {
                hashes: {},
                sources: {},
                __delete: [],
            };
            writeFileSyncEnsureDir(pathToCacheJson, JSON.stringify(cache));
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
            await writeFile(this.cacheDirRel, JSON.stringify(this.cache));
            return 0;
        } catch (err) {
            log('error')(err);
            return 1;
        }
    }

    /**
     * Cache the hash of a file.
     * @param filepath - The path to the file.
     * @param hash - The hash of the file.
     * @returns Promise resolving to:
     * - If old hash was found, and is not equal to the new hash: the old hash
     *   of the file
     * - If old hash was found, and is equal to the new hash: `false`
     * - If old hash was not found: `undefined`.
     */
    async cacheHash(
        filepath: Filepath,
        hash?: string | undefined,
        save: boolean = true,
    ): Promise<string | false | undefined> {
        if (hash === undefined) {
            const fileContents = await readFile(filepath, { encoding: 'utf8' });
            hash = sha256(fileContents);
        }
        const oldHash = this.cache.hashes[filepath];
        if (hash !== oldHash) {
            this.cache.hashes[filepath] = hash;
            if (save) await this.save();
            return oldHash;
        }
        return false;
    }

    async cacheHashAndSourceHash(
        filepath: GeneratedFilepath,
        hash: string,
        sourceHash: string,
        save: boolean = true,
    ): Promise<void> {
        this.cache.hashes[filepath] = hash;
        this.cache.sources[filepath] = sourceHash;
        if (save) await this.save();
    }

    keyify(filepath: string): string {
        filepath = normalize(filepath);
        const isSvg = filepath.endsWith('svg');
        if (isAbsolute(filepath)) {
            const dir = isSvg ? this.outputDirAbs : this.cacheDirAbs;
            return (
                normalize(relative(dir, filepath))
                    // Remove leading and trailing slashes
                    .replace(/((^\/+)|(\/+$))/gu, '')
            );
        } else {
            const regex = isSvg
                ? this.upToOutputDirRelRegex
                : this.upToCacheDirRelRegex;
            return filepath.replace(regex, '');
        }
    }

    absolutize(keyPath: string): Filepath {
        if (keyPath.endsWith('svg')) {
            return join(this.outputDirAbs, keyPath) as `${string}.svg`;
        }
        return join(this.cacheDirAbs, keyPath) as SourceFilepath;
    }

    /**
     * If the hash is found, then we can just rename files. Otherwise, we need
     * to recompile and let the stale files be deleted by periodic cleanup.
     *
     * @param newKeyPath - The new relative path of the file.
     * @param hash - The hash of any of the files being renamed.
     * @returns Promise resolving to:
     * - `true` if files were renamed
     * - `false` if no files were renamed
     */
    async updateKeyPath(
        newKeyPath: string,
        oldKeyPathOrHash: string | undefined,
        kindOfSecondParam: 'hash' | 'keyPath',
    ): Promise<boolean> {
        if (oldKeyPathOrHash === undefined) return false;
        const newKeyPathBase = newKeyPath.replace(/\.(tex|svg|pdf|dvi)$/iu, '');
        const oldKeyPath =
            kindOfSecondParam === 'keyPath'
                ? oldKeyPathOrHash
                : (Object.entries(this.cache.hashes).find(
                      (keyval) => keyval[1] === oldKeyPathOrHash,
                  ) ?? [])[0];
        if (oldKeyPath === undefined) return false;
        const oldKeyPathBase = oldKeyPath.replace(/\.(tex|svg|pdf|dvi)$/iu, '');

        await rename('', '');
        // if (filetype === undefined) {
        //     throw new Error('filetype must be specified');
        // }
        // const oldHash = this.cache.hashes[hash];
        // if (oldHash) {
        //     this.cache.hashes[hash] = sha256(oldHash + Date.now());
        //     await this.save();
        // }
    }
}

// /**
//  * Whenever we execute a `dvisvgm` command to transform a DVI/PDF file at
//  * `intFilepath` into an SVG file at `svgFilepath`, we add the pair to the
//  * cache. If `svgFilepath` is already in the cache, we update the `intFilepath`
//  * associated with it, since this means that the source of the SVG file has
//  * changed.
//  *
//  */
// export const svgSources: Record<> = new LRUCache<SvgFilepath, IntFilepath>({
//     max: 1000,
//     maxAge: 1000 * 60 * 60,
// });
