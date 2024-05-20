import {
    MockInstance,
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
} from '$utils/env.js';

import { mockFs } from '$dev_deps.js';
import { spy } from '$tests/fixtures.js';
import { readFileSync } from '$deps.js';

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
    vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
        start: vi.fn().mockReturnValue({
            stop: vi.fn(),
            text: vi.fn(),
            succeed: vi.fn(),
            fail: vi.fn(),
        }),
    })) as unknown as typeof import('ora').default);
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
            expect(await getVersion(dep)).toMatch(/(\d+\.\d+\.\d+)/);
        },
    );
});

describe('getPmFromPackageJson', () => {
    fixture();
    it('identifies a valid package manager (pnpm)', () => {
        mockFs({
            project: {
                'package.json': '{ "packageManager": "pnpm@6.14.2"}',
            },
        });
        expect(getPmFromPackageJson('project')).toEqual('pnpm');
    });

    it('identifies a valid package manager (bun)', () => {
        mockFs({
            project: {
                'package.json': JSON.stringify({
                    packageManager: 'bun@6.14.2',
                }),
            },
        });
        expect(getPmFromPackageJson('project')).toEqual('bun');
    });

    it('identifies a valid package manager (yarn)', () => {
        mockFs({
            'package.json': JSON.stringify({
                packageManager: 'yarn@6.14.2',
            }),
        });
        expect(getPmFromPackageJson()).toEqual('yarn');
    });

    it('returns undefined for an unrecognized package manager', () => {
        mockFs({
            'project/package.json': JSON.stringify({
                packageManager: 'unknown@1.0.0',
            }),
        });
        expect(getPmFromPackageJson('project')).toBeUndefined();
    });

    it('returns undefined if package.json does not have packageManager set', () => {
        mockFs({
            'project/package.json': JSON.stringify({}),
        });
        expect(getPmFromPackageJson('project')).toBeUndefined();
    });

    it('returns undefined if package.json does not exist', () => {
        mockFs({});
        expect(getPmFromPackageJson('project')).toBeUndefined();
    });
});

describe('detectPackageManager', () => {
    fixture();
    it('defaults to npm if no package manager is detected', () => {
        mockFs({});
        expect(detectPackageManager('project')).toEqual('npm');
    });

    it('detects package manager from package.json', () => {
        mockFs({
            'project/package.json': JSON.stringify({
                packageManager: 'yarn@6.14.2',
            }),
        });
        expect(detectPackageManager('project')).toEqual('yarn');
    });

    it.each([
        { file: 'pnpm-lock.yaml', pm: 'pnpm' },
        { file: 'bun.lockb', pm: 'bun' },
        { file: 'package-lock.json', pm: 'npm' },
        { file: 'yarn.lock', pm: 'yarn' },
    ])('detects package manager from lockfile', ({ file, pm }) => {
        mockFs({ [file]: 'test' });
        expect(detectPackageManager()).toEqual(pm);
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
