import { mockFs } from '$dev_deps.js';
import {
    type MockInstance,
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    consoles,
    escapeWhitespace,
    log,
    prettifyError,
    runWithSpinner,
} from '$utils/debug.js';
import { spy } from 'tests/fixtures.js';

import { readFileSync } from 'node:fs';
import pc from 'picocolors';

describe('debug', () => {
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
    afterAll(() => {
        vi.restoreAllMocks();
        mockFs.restore();
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
});
