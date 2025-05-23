import {
    type MockInstance,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    detectPackageManager,
    getPmFromLockfile,
    getPmFromPackageJson,
    getVersion,
} from '../../../src/utils/env.js';

import { mockFs } from '../../../src/dev_deps.js';
import { spy } from '../fixtures.js';
import { readFileSync } from '../../../src/deps.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

let existsSync: MockInstance;
beforeAll(async () => {
    vi.spyOn(await import('../../../src/deps.js'), 'ora').mockImplementation(
        (() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default,
    );
    const mocks = await spy(['existsSync'], false);
    existsSync = mocks.existsSync;
    existsSync.mockImplementation((path: string) => {
        try {
            readFileSync(path);
            return true;
        } catch {
            return false;
        }
    });
});

describe('getVersion', () => {
    fixture();
    it.each(['katex', 'highlight.js', 'mathjax-full'] as const)(
        'getVersion(%o) has format "x.y.z"',
        async (dep) => {
            expect(await getVersion(dep)).toMatch(/(\d+\.\d+\.\d+)/u);
        },
    );
});

describe('getPmFromPackageJson', () => {
    fixture();
    it('identifies a valid package manager (pnpm)', async () => {
        mockFs({
            project: {
                'package.json': '{ "packageManager": "pnpm@6.14.2"}',
            },
        });
        expect(await getPmFromPackageJson('project')).toEqual('pnpm');
    });

    it('identifies a valid package manager (bun)', async () => {
        mockFs({
            project: {
                'package.json': JSON.stringify({
                    packageManager: 'bun@6.14.2',
                }),
            },
        });
        expect(await getPmFromPackageJson('project')).toEqual('bun');
    });

    it('identifies a valid package manager (yarn)', async () => {
        mockFs({
            'package.json': JSON.stringify({
                packageManager: 'yarn@6.14.2',
            }),
        });
        expect(await getPmFromPackageJson()).toEqual('yarn');
    });

    it('returns undefined for an unrecognized package manager', async () => {
        mockFs({
            'project/package.json': JSON.stringify({
                packageManager: 'unknown@1.0.0',
            }),
        });
        expect(await getPmFromPackageJson('project')).toBeUndefined();
    });

    it('returns undefined if package.json does not have packageManager set', async () => {
        mockFs({
            'project/package.json': JSON.stringify({}),
        });
        expect(await getPmFromPackageJson('project')).toBeUndefined();
    });

    it('returns undefined if package.json does not exist', async () => {
        mockFs({});
        expect(await getPmFromPackageJson('project')).toBeUndefined();
    });
});

describe('detectPackageManager', () => {
    fixture();
    it('defaults to npm if no package manager is detected', async () => {
        mockFs({});
        expect(await detectPackageManager('project')).toEqual('npm');
    });

    it('detects package manager from package.json', async () => {
        mockFs({
            'project/package.json': JSON.stringify({
                packageManager: 'yarn@6.14.2',
            }),
        });
        expect(await detectPackageManager('project')).toEqual('yarn');
    });

    it.each([
        { file: 'pnpm-lock.yaml', pm: 'pnpm' },
        { file: 'bun.lockb', pm: 'bun' },
        { file: 'package-lock.json', pm: 'npm' },
        { file: 'yarn.lock', pm: 'yarn' },
    ])('detects package manager from lockfile', async ({ file, pm }) => {
        mockFs({ [file]: 'test' });
        expect(await detectPackageManager()).toEqual(pm);
    });
});

describe('getPmFromLockfile', () => {
    fixture();
    it.each([
        { file: 'pnpm-lock.yaml', pm: 'pnpm' },
        { file: 'bun.lockb', pm: 'bun' },
        { file: 'package-lock.json', pm: 'npm' },
        { file: 'yarn.lock', pm: 'yarn' },
    ])('detects $pm from the lockfile', ({ file, pm }) => {
        mockFs({ [file]: '' });
        expect(getPmFromLockfile()).toEqual(pm);
    });

    it('returns undefined if no known lock file is found', () => {
        mockFs({});
        expect(getPmFromLockfile()).toBeUndefined();
    });
});
