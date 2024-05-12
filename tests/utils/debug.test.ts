import { mockFs } from '$dev_deps.js';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
} from 'vitest';

import {
    consoles,
    detectPackageManager,
    escapeWhitespace,
    getPmFromLockfile,
    getPmFromPackageJson,
    log,
    pathExists,
    prettifyError,
    runWithSpinner,
} from '$utils/debug.js';
import { spy } from 'tests/fixtures.js';

import { readFileSync } from 'node:fs';
import pc from 'picocolors';

suite('debug', async () => {
    beforeAll(async () => {
        vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default);
    });
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
    });

    const { existsSync } = await spy(['existsSync'], false);

    existsSync.mockImplementation((path: string) => {
        try {
            readFileSync(path);
            return true;
        } catch {
            return false;
        }
    });

    describe('log', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        const consoleLogMock = vi.spyOn(consoles, 'log').mockReturnValue();
        const consoleErrorMock = vi.spyOn(consoles, 'error').mockReturnValue();
        const consoleWarnMock = vi.spyOn(consoles, 'warn').mockReturnValue();

        it('should log to the console.log by default', () => {
            log('log test');
            expect(consoleLogMock).toHaveBeenCalledTimes(1);
            expect(consoleLogMock).toHaveBeenNthCalledWith(1, 'log test');
        });

        it.each([
            { severity: 'log', style: 'dim' },
            { severity: 'log', style: ['dim'] },
        ])('should support LogOptionsObject argument', (logOptions) => {
            log(logOptions, 'log test');
            expect(consoleLogMock).toHaveBeenCalledTimes(1);
            expect(consoleLogMock).toHaveBeenNthCalledWith(
                1,
                pc.dim('log test'),
            );
        });

        it('should be able to compose styles', () => {
            log({ severity: 'warn', style: 'dim' }, 'warn test');
            expect(consoleWarnMock).toHaveBeenCalledTimes(1);
            expect(consoleWarnMock).toHaveBeenNthCalledWith(
                1,
                pc.yellow(pc.dim('warn test')),
            );
        });

        it('should log to console.log if asked to, and leave message unstyled', () => {
            log('log', 'log test', { object: true }, ['array'], 123, false);
            expect(consoleLogMock).toHaveBeenCalledTimes(1);
            expect(consoleLogMock).toHaveBeenNthCalledWith(
                1,
                'log test',
                {
                    object: true,
                },
                ['array'],
                123,
                false,
            );
        });

        it('should log to console.error if asked to, and color message red using picocolors', () => {
            log('error', 'error test', { object: true }, ['array'], 123, false);
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                pc.red('error test'),
                {
                    object: true,
                },
                ['array'],
                123,
                false,
            );
        });

        it('should log to console.warn if asked to, and color message yellow using picocolors', () => {
            log('warn', 'warn test');
            expect(consoleWarnMock).toHaveBeenCalledTimes(1);
            expect(consoleWarnMock).toHaveBeenNthCalledWith(
                1,
                pc.yellow('warn test'),
            );
        });
    });

    describe('runWithSpinner', () => {
        it('should work catch errors even if no failMessage was set', () => {
            expect(
                async () =>
                    await runWithSpinner(
                        () => {
                            throw new Error('something');
                        },
                        {
                            startMessage: 'test',
                            successMessage: () => 'success',
                        },
                    ),
            ).not.toThrow();
        });

        it('should return 1 if failureValues contains return value of action', async () => {
            expect(
                await runWithSpinner(
                    () => 'something',
                    {
                        startMessage: 'test',
                        successMessage: () => 'success',
                    },
                    ['something'],
                ),
            ).toEqual(1);
        });
    });

    describe('prettifyError', () => {
        it('should work', () => {
            expect(
                prettifyError(new Error('test error')).includes('test error'),
            ).toEqual(true);
        });
        it('should work with non-error objects', () => {
            expect(prettifyError('something').includes('something')).toEqual(
                true,
            );
        });
    });

    describe('escapeWhitespace', () => {
        it('should escape whitespace characters', () => {
            const input = 'Hello\nWorld\t!';
            const expectedOutput = 'Hello\\nWorld\\t!';
            const output = escapeWhitespace(input);
            expect(output).toEqual(expectedOutput);
        });

        it('should not escape non-whitespace characters', () => {
            const input = 'Hello World!';
            const expectedOutput = 'Hello World!';
            const output = escapeWhitespace(input);
            expect(output).toEqual(expectedOutput);
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

    describe('getPmFromPackageJson', () => {
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

    describe('getPmFromLockfile', () => {
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

    describe('detectPackageManager', () => {
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
});
