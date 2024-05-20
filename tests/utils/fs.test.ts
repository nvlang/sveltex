import { mockFs } from '$dev_deps.js';
import { fs, pathExists } from '$utils/fs.js';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterAll,
    beforeAll,
    type MockInstance,
} from 'vitest';
import { spy } from '$tests/fixtures.js';

describe('filesystem utils (`src/utils/fs.ts`)', () => {
    let existsSync: MockInstance;
    let mkdir: MockInstance;
    let writeFile: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['existsSync', 'mkdir', 'writeFile'], true);
        existsSync = mocks.existsSync;
        mkdir = mocks.mkdir;
        writeFile = mocks.writeFile;
        mockFs({});
    });
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
    });

    describe.each([
        ['/path/to/file.txt', 'Test data', '/path/to'],
        ['test.txt', 'data', '.'],
    ])('fs.writeFileEnsureDir', (testPath, testData, dir) => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockFs({});
        });

        it('writes file in an existing directory', async () => {
            existsSync.mockReturnValueOnce(true); // Pretend directory exists
            await fs.writeFileEnsureDir(testPath, testData);
            if (dir !== '.') {
                expect(existsSync).toHaveBeenCalledWith(dir);
            } else {
                expect(existsSync).not.toHaveBeenCalled();
            }
            expect(mkdir).not.toHaveBeenCalled();
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                testPath,
                testData,
                'utf8',
            );
        });

        it('creates directory and writes file when directory does not exist', async () => {
            existsSync.mockReturnValueOnce(false); // Pretend directory does not exist
            await fs.writeFileEnsureDir(testPath, testData);
            if (dir !== '.') {
                expect(existsSync).toHaveBeenCalledWith(dir);
                expect(mkdir).toHaveBeenCalledWith(dir, {
                    recursive: true,
                });
            }
            expect(writeFile).toHaveBeenCalledWith(testPath, testData, 'utf8');
        });
    });

    describe('pathExists', () => {
        it.each([[{ 'exists.txt': '' }, 'exists.txt']])(
            'returns true when the path exists',
            (files, path) => {
                mockFs(files);
                const res = pathExists(path);
                expect(existsSync).toHaveBeenCalledTimes(1);
                expect(existsSync).toHaveBeenNthCalledWith(1, path);
                expect(existsSync).toHaveNthReturnedWith(1, true);
                expect(res).toEqual(true);
            },
        );

        it('returns false when the path does not exist', () => {
            mockFs({});
            expect(pathExists('does-not-exist')).toEqual(false);
        });

        it('catches errors and silently returns false', () => {
            mockFs({});
            existsSync.mockImplementationOnce(() => {
                throw new Error();
            });
            expect(pathExists('does-not-exist')).toEqual(false);
        });
    });
});
