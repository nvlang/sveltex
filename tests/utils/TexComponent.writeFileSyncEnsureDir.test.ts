import { writeFileSyncEnsureDir } from '$src/utils/TexComponent.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

// Mock necessary modules and functions
vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

vi.mock('node:path', async (orig: () => Promise<object>) => ({
    ...(await orig()),
    dirname: vi.fn((path: string) => path.substring(0, path.lastIndexOf('/'))),
}));

describe('writeFileSyncEnsureDir', () => {
    const testPath = '/path/to/file.txt';
    const testData = 'Test data';

    beforeEach(() => {
        // Clear all mocks before each test
        vi.clearAllMocks();
    });

    it('writes file in an existing directory', () => {
        vi.mocked(existsSync).mockReturnValue(true); // Pretend directory exists
        writeFileSyncEnsureDir(testPath, testData);
        expect(existsSync).toHaveBeenCalledWith('/path/to');
        expect(mkdirSync).not.toHaveBeenCalled(); // Directory exists, so no need to create it
        expect(writeFileSync).toHaveBeenCalledWith(testPath, testData, 'utf8');
    });

    it('creates directory and writes file when directory does not exist', () => {
        vi.mocked(existsSync).mockReturnValue(false); // Pretend directory does not exist
        writeFileSyncEnsureDir(testPath, testData);
        expect(existsSync).toHaveBeenCalledWith('/path/to');
        expect(mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
        expect(writeFileSync).toHaveBeenCalledWith(testPath, testData, 'utf8');
    });

    it('overwrites an existing file with new content', () => {
        vi.mocked(existsSync).mockReturnValue(true); // Pretend directory and file exist
        // Assume the file also exists, though our function doesn't check this explicitly
        const newTestData = 'New test data';
        writeFileSyncEnsureDir(testPath, newTestData);
        expect(existsSync).toHaveBeenCalledWith('/path/to');
        expect(mkdirSync).not.toHaveBeenCalled(); // Directory exists, no need to create
        expect(writeFileSync).toHaveBeenCalledWith(
            testPath,
            newTestData,
            'utf8',
        );
    });

    // Additional tests could include error handling scenarios, if applicable
});
