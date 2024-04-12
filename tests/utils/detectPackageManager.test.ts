import { describe, it, expect, beforeEach, vi } from 'vitest';
import { accessSync, readFileSync } from 'node:fs';
import {
    detectPackageManager,
    getPmFromLockfile,
    getPmFromPackageJson,
    pathExists,
} from '$utils'; // Update with your actual module path

// Mock 'node:fs' and 'node:path' modules
vi.mock('node:fs', () => ({
    accessSync: vi.fn(),
    readFileSync: vi.fn(),
}));
vi.mock('node:path', async (orig: () => Promise<object>) => ({
    ...(await orig()),
    resolve: vi.fn((...args) => args.join('/')),
}));

describe('pathExists', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true when the path exists', () => {
        vi.mocked(accessSync).mockImplementation(() => {
            return;
        });
        expect(pathExists('/exists')).toBe(true);
    });

    it('returns false when the path does not exist', () => {
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(pathExists('/does-not-exist')).toBe(false);
    });
});

describe('getPmFromPackageJson', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('identifies a valid package manager (pnpm)', () => {
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({ packageManager: 'pnpm@6.14.2' }),
        );
        expect(getPmFromPackageJson('/project')).toBe('pnpm');
    });

    it('identifies a valid package manager (yarn)', () => {
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({ packageManager: 'yarn@6.14.2' }),
        );
        expect(getPmFromPackageJson('/project')).toBe('yarn');
    });

    it('returns undefined for an unrecognized package manager', () => {
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({ packageManager: 'unknown@1.0.0' }),
        );
        expect(getPmFromPackageJson('/project')).toBeUndefined();
    });

    it('returns undefined if package.json does not have packageManager set', () => {
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));
        expect(getPmFromPackageJson('/project')).toBeUndefined();
    });

    it('returns undefined if package.json does not exist', () => {
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(getPmFromPackageJson('/project')).toBeUndefined();
    });
});

describe('getPmFromLockfile', () => {
    beforeEach(() => {
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
    });

    it.each([
        { file: 'pnpm-lock.yaml', pm: 'pnpm' },
        { file: 'bun.lockb', pm: 'bun' },
        { file: 'package-lock.json', pm: 'npm' },
        { file: 'yarn.lock', pm: 'yarn' },
    ])('detects $pm from the lockfile', ({ file, pm }) => {
        vi.mocked(accessSync).mockImplementation((path) => {
            if (path.toString().endsWith(file)) {
                return;
            }
            throw new Error('ENOENT');
        });
        expect(getPmFromLockfile('/project')).toBe(pm);
    });

    it('returns undefined if no known lock file is found', () => {
        expect(getPmFromLockfile('/project')).toBeUndefined();
    });
});

describe('detectPackageManager', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    it('defaults to npm if no package manager is detected', () => {
        vi.mocked(readFileSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(detectPackageManager('/project')).toBe('npm');
    });

    it('detects package manager from package.json', () => {
        vi.mocked(readFileSync).mockReturnValue(
            JSON.stringify({ packageManager: 'yarn@6.14.2' }),
        );
        expect(detectPackageManager('/project')).toBe('yarn');
    });

    it('detects package manager from lockfile when not found in package.json', () => {
        vi.mocked(readFileSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });
        vi.mocked(accessSync).mockImplementation((path) => {
            if (path.toString().endsWith('pnpm-lock.yaml')) {
                return;
            }
            throw new Error('ENOENT');
        });
        expect(detectPackageManager('/project')).toBe('pnpm');
    });
});
