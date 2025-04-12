import { mockFs } from '../../../src/dev_deps.js';
import { fs, pathExists } from '../../../src/utils/fs.js';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterAll,
    beforeAll,
    afterEach,
} from 'vitest';
import { spy } from '../fixtures.js';

describe('filesystem utils (`src/utils/fs.ts`)', () => {
    beforeAll(() => {
        mockFs({});
    });
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
    });

    describe.each([
        ['/path/to/file.txt', 'Test data', '/path/to'],
        ['test.txt', 'data', '.'],
    ])('fs.writeFileEnsureDir(%o)', (testPath, testData, dir) => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockFs({});
        });
        afterEach(() => {
            vi.clearAllMocks();
            vi.restoreAllMocks();
        });

        it('writes file in an existing directory', async () => {
            const { existsSync, mkdir, writeFile } = await spy([
                'existsSync',
                'mkdir',
                'writeFile',
            ]);
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
            const { existsSync, mkdir, writeFile } = await spy([
                'existsSync',
                'mkdir',
                'writeFile',
            ]);
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

    describe.each([
        ['/path/to/file.txt', 'Test data', '/path/to'],
        ['test.txt', 'data', '.'],
    ])('fs.writeFileEnsureDirSync(%o)', (testPath, testData, dir) => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockFs({});
        });
        afterEach(() => {
            vi.clearAllMocks();
            vi.restoreAllMocks();
        });
        it('writes file in an existing directory', async () => {
            const { existsSync, mkdirSync, writeFileSync } = await spy([
                'existsSync',
                'mkdirSync',
                'writeFileSync',
            ]);
            existsSync.mockReturnValueOnce(true); // Pretend directory exists
            fs.writeFileEnsureDirSync(testPath, testData);
            if (dir !== '.') {
                expect(existsSync).toHaveBeenCalledWith(dir);
            } else {
                expect(existsSync).not.toHaveBeenCalled();
            }
            expect(mkdirSync).not.toHaveBeenCalled();
            expect(writeFileSync).toHaveBeenCalledTimes(1);
            expect(writeFileSync).toHaveBeenNthCalledWith(
                1,
                testPath,
                testData,
                'utf8',
            );
        });

        it('creates directory and writes file when directory does not exist', async () => {
            const { existsSync, mkdirSync, writeFileSync } = await spy([
                'existsSync',
                'mkdirSync',
                'writeFileSync',
            ]);
            existsSync.mockReturnValueOnce(false); // Pretend directory does not exist
            fs.writeFileEnsureDirSync(testPath, testData);
            if (dir !== '.') {
                expect(existsSync).toHaveBeenCalledWith(dir);
                expect(mkdirSync).toHaveBeenCalledWith(dir, {
                    recursive: true,
                });
            }
            expect(writeFileSync).toHaveBeenCalledWith(
                testPath,
                testData,
                'utf8',
            );
        });
    });

    describe('pathExists', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockFs({});
        });
        afterEach(() => {
            vi.clearAllMocks();
            vi.restoreAllMocks();
        });
        it('returns true when the path exists', async () => {
            const { existsSync } = await spy(['existsSync']);
            existsSync.mockReturnValueOnce(true);
            const res = pathExists('exists.txt');
            expect(existsSync).toHaveBeenCalledTimes(1);
            expect(existsSync).toHaveBeenNthCalledWith(1, 'exists.txt');
            expect(existsSync).toHaveNthReturnedWith(1, true);
            expect(res).toEqual(true);
        });

        it('returns false when the path does not exist', () => {
            expect(pathExists('does-not-exist')).toEqual(false);
        });

        it('catches errors and silently returns false', async () => {
            const { existsSync } = await spy(['existsSync']);
            existsSync.mockImplementationOnce(() => {
                throw new Error();
            });
            expect(pathExists('does-not-exist')).toEqual(false);
        });
    });
});
