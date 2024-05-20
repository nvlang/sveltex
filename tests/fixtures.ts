import { isArray, isString } from '$type-guards/utils.js';
import { mockFs } from '$dev_deps.js';
import { type MockInstance, vi, beforeEach, afterAll, expect } from 'vitest';

type Mockable = (typeof mockableFunctions)[number];

const mockableFunctions = [
    'ensureDir',
    'existsSync',
    'fancyWrite',
    'log',
    'mkdir',
    'readFile',
    'readFileSync',
    'rename',
    'spawnCliInstruction',
    'writeFile',
    'writeFileEnsureDir',
] as const;

function isMockable(target: unknown): target is Mockable {
    return isString(target) && mockableFunctions.includes(target as Mockable);
}

function isMockableArray(target: unknown): target is Mockable[] {
    return isArray(target, isMockable);
}

export async function spy<M extends Mockable[]>(
    target: M,
    fn?: ((...args: unknown[]) => unknown) | boolean | undefined,
): Promise<Record<M[number], MockInstance>>;

export async function spy(
    target: Mockable,
    fn?: ((...args: unknown[]) => unknown) | boolean | undefined,
): Promise<MockInstance>;

export async function spy(
    target: Mockable | Mockable[],
    fn: ((...args: unknown[]) => unknown) | boolean | undefined = true,
): Promise<MockInstance | Record<(typeof target)[number], MockInstance>> {
    let spyFn: MockInstance;
    switch (target) {
        case 'log':
            spyFn = vi.spyOn(await import('$utils/debug.js'), 'log');
            break;
        case 'spawnCliInstruction':
            spyFn = vi.spyOn(
                await import('$utils/cli.js'),
                'spawnCliInstruction',
            );
            break;
        case 'fancyWrite':
            spyFn = vi.spyOn(await import('$utils/cdn.js'), 'fancyWrite');
            break;
        case 'writeFile':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'writeFile');
            break;
        case 'readFile':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'readFile');
            break;
        case 'readFileSync':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'readFileSync');
            break;
        case 'existsSync':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'existsSync');
            break;
        case 'rename':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'rename');
            break;
        case 'mkdir':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'mkdir');
            break;
        case 'ensureDir':
            spyFn = vi.spyOn((await import('$utils/fs.js')).fs, 'ensureDir');
            break;
        case 'writeFileEnsureDir':
            spyFn = vi.spyOn(
                (await import('$utils/fs.js')).fs,
                'writeFileEnsureDir',
            );
            break;
        default: {
            if (isMockableArray(target)) {
                const rv: Record<string, MockInstance> = {};
                for (const t of target) {
                    rv[t] = await spy(t, fn);
                }
                return rv;
            } else {
                throw new Error('Invalid arguments');
            }
        }
    }

    if (typeof fn === 'function') {
        spyFn = spyFn.mockImplementation(fn);
    } else if (fn) {
        spyFn = spyFn.mockImplementation(() => undefined);
    }
    return spyFn;
}

export function fixture1(
    spawnCliInstructionMock: MockInstance,
    logMock: MockInstance,
) {
    beforeEach(async () => {
        vi.clearAllMocks();
        spawnCliInstructionMock = await spy('spawnCliInstruction');
        logMock = await spy('log');
        mockFs({});
        spawnCliInstructionMock.mockClear();
        logMock.mockClear();
    });
    afterAll(() => {
        mockFs.restore();
        vi.restoreAllMocks();
    });
}

export function removeEmptyLines(input: string = '') {
    return input
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .join('\n');
}

export function equalUpToNewlines(a: string = '', b: string = '') {
    expect(removeEmptyLines(a)).toEqual(removeEmptyLines(b));
}

// export async function mockNodeFs() {
//     vi.mock(
//         'node:fs',
//         async (orig: () => Promise<typeof import('node:fs')>) => {
//             const original = await orig();
//             return {
//                 ...original,
//                 writeFileSync: vi.fn().mockImplementation(() => undefined),
//                 readFileSync: vi.fn().mockImplementation(() => ''),
//                 existsSync: vi.fn().mockImplementation(original.existsSync),
//                 renameSync: vi.fn().mockImplementation(() => undefined),
//             };
//         },
//     );
//     const mockedModule = await import('node:fs');
//     return {
//         writeFileSyncMock: vi.mocked(mockedModule.writeFileSync),
//         readFileSyncMock: vi.mocked(mockedModule.readFileSync),
//         existsSyncMock: vi.mocked(mockedModule.existsSync),
//         renameSyncMock: vi.mocked(mockedModule.renameSync),
//     };
// }

// export async function mockNodeFsPromises() {
//     vi.mock(
//         'node:fs/promises',
//         async (orig: () => Promise<typeof import('node:fs/promises')>) => {
//             const original = await orig();
//             return {
//                 ...original,
//                 readFile: vi.fn().mockImplementation(() => Promise.resolve('')),
//             };
//         },
//     );
//     const mockedModule = await import('node:fs/promises');
//     return {
//         readFileMock: vi.mocked(mockedModule.readFile),
//     };
// }

// export async function spy(target: {
//     module: 'node:fs';
//     readFileSync?: 'spy' | 'mock' | undefined;
//     writeFileSync?: 'spy' | 'mock' | undefined;
//     existsSync?: 'spy' | 'mock' | undefined;
// }): Promise<{
//     readFileSyncMock?: MockInstance;
//     writeFileSyncMock?: MockInstance;
//     existsSyncMock?: MockInstance;
// }>;
// export async function spy(
//     target:
//         | 'log'
//         | 'spawnCliInstruction'
//         | {
//               module: 'node:fs';
//               readFileSync?: 'spy' | 'mock' | undefined;
//               writeFileSync?: 'spy' | 'mock' | undefined;
//               existsSync?: 'spy' | 'mock' | undefined;
//           }
//         | { module: '' },
//     fn: ((...args: unknown[]) => unknown) | boolean | undefined = true,
// ): Promise<MockInstance | Record<`${string}Mock`, MockInstance>> {
//     if (isNonNullObject(target)) {
//         if (target.module === 'node:fs' && isArray(target)) {
//             const { writeFileSyncMock, readFileSyncMock, existsSyncMock } =
//                 vi.hoisted(() => {
//                     return {
//                         writeFileSyncMock: vi
//                             .fn()
//                             .mockImplementation(
//                                 target.writeFileSync === 'mock'
//                                     ? () => undefined
//                                     : writeFileSync,
//                             ),
//                         readFileSyncMock: vi
//                             .fn()
//                             .mockImplementation(
//                                 target.readFileSync === 'mock'
//                                     ? () => ''
//                                     : readFileSync,
//                             ),
//                         existsSyncMock: vi
//                             .fn()
//                             .mockImplementation(
//                                 target.existsSync === 'mock'
//                                     ? () => false
//                                     : existsSync,
//                             ),
//                     };
//                 });
//             vi.mock(
//                 'node:fs',
//                 async (orig: () => Promise<typeof import('node:fs')>) => {
//                     return {
//                         ...(await orig()),
//                         writeFileSync: writeFileSyncMock,
//                         readFileSync: readFileSyncMock,
//                         existsSync: existsSyncMock,
//                     };
//                 },
//             );
//             return { writeFileSyncMock, readFileSyncMock, existsSyncMock };
//         } else {
//             throw new Error('Invalid arguments');
//         }
//     }
