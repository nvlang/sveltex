import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    type MockInstance,
    beforeAll,
} from 'vitest';

import { spy } from '../fixtures.js';
import { mockFs } from '../../../src/dev_deps.js';
import { SveltexCache } from '../../../src/utils/cache.js';

describe('SveltexCache', () => {
    let writeFile: MockInstance;
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['writeFile', 'log'], true);
        writeFile = mocks.writeFile;
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
    });

    describe('misc', () => {
        it('is serializable', async () => {
            mockFs({});
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            expect(() => JSON.stringify(cache)).not.toThrowError();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { cacheDirGlob, ...otherProps } = cache;
            expect(JSON.parse(JSON.stringify(cache))).toEqual(otherProps);
            vi.clearAllMocks();
        });
    });

    describe('save', () => {
        it('initializes cache correctly', async () => {
            mockFs({});
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                'exampleCacheDir/cache.json',
                '{"int":{},"svg":{}}',
                'utf8',
            );
            expect(cache.data).toEqual({ int: {}, svg: {} });
        });

        it('loads cache correctly', async () => {
            mockFs({
                exampleCacheDir: {
                    'cache.json':
                        '{"int":{"tex/ref":{"hash":"abc","sourceHash":"123"}},"svg":{"tex/ref":{"file":"ref.svelte","sourceHash":"abc","sourceKeyPath":"tex/ref"}}}',
                },
            });
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            expect(cache.data).toEqual({
                int: { 'tex/ref': { hash: 'abc', sourceHash: '123' } },
                svg: {
                    'tex/ref': {
                        file: 'ref.svelte',
                        sourceHash: 'abc',
                        sourceKeyPath: 'tex/ref',
                    },
                },
            });
        });

        it('saves cache correctly', async () => {
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            cache.data.int['tex/ref'] = { hash: 'abc', sourceHash: '123' };
            cache.data.svg['tex/ref'] = {
                // file: 'ref.svelte',
                sourceHash: 'abc',
                // sourceKeyPath: 'tex/ref',
            };
            expect(cache.data).toEqual({
                int: { 'tex/ref': { hash: 'abc', sourceHash: '123' } },
                svg: {
                    'tex/ref': {
                        // file: 'ref.svelte',
                        sourceHash: 'abc',
                        // sourceKeyPath: 'tex/ref',
                    },
                },
            });
            const code = await cache.save();
            expect(code).toEqual(0);
            expect(writeFile).toHaveBeenCalledTimes(2);
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                'exampleCacheDir/cache.json',
                JSON.stringify({
                    int: { 'tex/ref': { hash: 'abc', sourceHash: '123' } },
                    svg: {
                        'tex/ref': {
                            sourceHash: 'abc',
                        },
                    },
                }),
                'utf8',
            );
        });

        it('fails silently if writeFile throws error', async () => {
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            writeFile.mockClear();
            writeFile.mockImplementationOnce(() => {
                throw new Error();
            });
            const code = await cache.save();
            expect(code).toEqual(1);
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                `✖ Error trying to write to "${cache.pathToCacheJson}":\n\n`,
                expect.any(String),
            );
        });

        it('fails silently if writeFile throws "special" error', async () => {
            const cache = await SveltexCache.load(
                'exampleOutputDir',
                'exampleCacheDir',
            );
            writeFile.mockClear();
            writeFile.mockImplementationOnce(() => {
                throw new TypeError();
            });
            const code = await cache.save();
            expect(code).toEqual(1);
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalled();
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                `✖ Error trying to write to "${cache.pathToCacheJson}":\n\n`,
                expect.stringContaining('Error'),
            );
        });
    });
});
