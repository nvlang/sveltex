import mockFs from 'mock-fs';
import { fs } from '$utils/fs.js';
import { describe, it, expect, vi, beforeEach, afterAll, suite } from 'vitest';
import { spy } from '$tests/fixtures.js';

suite('filesystem utils (`src/utils/fs.ts`)', async () => {
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
    });
    const { existsSync, mkdir, writeFile } = await spy(
        ['existsSync', 'mkdir', 'writeFile'],
        true,
    );
    mockFs({});

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
});
