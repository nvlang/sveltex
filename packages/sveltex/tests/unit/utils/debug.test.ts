import { mockFs } from '../../../src/dev_deps.js';
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
} from '../../../src/utils/debug.js';
import { spy } from '../fixtures.js';

import { readFileSync } from 'node:fs';
import pc from 'picocolors';

describe('debug', () => {
    let existsSync: MockInstance;
    beforeAll(async () => {
        vi.spyOn(
            await import('../../../src/deps.js'),
            'ora',
        ).mockImplementation((() => ({
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

        it('should treat options object without `severity` as `log`', () => {
            log({ style: 'dim' }, 'no severity');
            expect(consoleLogMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).not.toHaveBeenCalled();
            expect(consoleWarnMock).not.toHaveBeenCalled();
        });

        it('should treat options object without `style` using default styles only', () => {
            log({ severity: 'error' }, 'no style');
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                pc.red('no style'),
            );
        });
    });

    // When colours ARE supported, `log` takes the styling code path:
    // `applyPcStyles` is invoked and non-string args are passed through
    // unchanged. In the default test environment `pc.isColorSupported` is
    // `false`, so we temporarily flip it on here. Note that picocolors binds
    // its formatter functions at module-load time, so once colours were
    // unsupported at import the `pc.red`/`pc.dim` functions remain the
    // identity function; what matters for these tests is that the styling
    // branch (and `applyPcStyles`) is actually executed.
    describe('log (with colour support)', () => {
        let originalColorSupport: boolean;
        let consoleLogMock: MockInstance;
        let consoleErrorMock: MockInstance;
        let consoleWarnMock: MockInstance;
        beforeAll(() => {
            originalColorSupport = pc.isColorSupported;
            pc.isColorSupported = true;
        });
        afterAll(() => {
            pc.isColorSupported = originalColorSupport;
        });
        beforeEach(() => {
            vi.clearAllMocks();
            consoleLogMock = vi.spyOn(consoles, 'log').mockReturnValue();
            consoleErrorMock = vi.spyOn(consoles, 'error').mockReturnValue();
            consoleWarnMock = vi.spyOn(consoles, 'warn').mockReturnValue();
        });

        it('should take the styling code path when colour is supported', () => {
            log('error', 'styled error');
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            const [arg] = consoleErrorMock.mock.calls[0] as [string];
            // `applyPcStyles` ran; with picocolors' identity formatter the
            // resulting string still contains (here: equals) the input.
            expect(arg).toContain('styled error');
            expect(arg).toEqual(pc.red('styled error'));
        });

        it('should compose default and user styles', () => {
            log({ severity: 'warn', style: ['dim'] }, 'styled warn');
            expect(consoleWarnMock).toHaveBeenCalledTimes(1);
            const [arg] = consoleWarnMock.mock.calls[0] as [string];
            expect(arg).toEqual(pc.yellow(pc.dim('styled warn')));
        });

        it('should only style string args and pass others through verbatim', () => {
            const obj = { object: true };
            const arr = ['array'];
            log('error', 'styled', obj, arr, 123, false);
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            const call = consoleErrorMock.mock.calls[0] as unknown[];
            expect(call[0]).toEqual(pc.red('styled'));
            // Non-string args are returned as-is by the mapping callback.
            expect(call[1]).toBe(obj);
            expect(call[2]).toBe(arr);
            expect(call[3]).toBe(123);
            expect(call[4]).toBe(false);
        });

        it('should log without styling when severity has no default style and no user style', () => {
            log('log', 'plain log');
            expect(consoleLogMock).toHaveBeenCalledTimes(1);
            expect(consoleLogMock).toHaveBeenNthCalledWith(1, 'plain log');
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
        it('should work with failMessage()', async () => {
            expect(
                await runWithSpinner(
                    () => 'something',
                    {
                        startMessage: 'test',
                        successMessage: () => 'success',
                        failMessage: () => 'failed',
                    },
                    ['something'],
                ),
            ).toEqual(1);
        });

        it('should return 0 and succeed when the action does not fail', async () => {
            const successMessage = vi.fn(() => 'success');
            const code = await runWithSpinner(
                () => 'ok',
                {
                    startMessage: 'test',
                    successMessage,
                },
                ['failure-value'],
            );
            expect(code).toEqual(0);
            expect(successMessage).toHaveBeenCalledTimes(1);
        });

        it('should return 0 when no failureValues are provided and no error is thrown', async () => {
            const action = vi.fn(() => 'anything');
            const code = await runWithSpinner(action, {
                startMessage: 'test',
                successMessage: () => 'success',
            });
            expect(code).toEqual(0);
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('should format elapsed times above one second in seconds', async () => {
            // `runWithSpinner` measures elapsed time with
            // `process.hrtime.bigint()` and formats it via `timeToString`.
            // We fake the clock so the measured duration is 2 s, exercising
            // the `ms > 1000` branch of `timeToString`.
            const deps = await import('../../../src/deps.js');
            const hrtimeMock = vi
                .spyOn(deps.process.hrtime, 'bigint')
                .mockReturnValueOnce(0n)
                .mockReturnValue(2_000_000_000n);
            const successMessage = vi.fn(
                (timeTaken: string) => `done in ${timeTaken}`,
            );
            const code = await runWithSpinner(() => 'ok', {
                startMessage: 'test',
                successMessage,
            });
            expect(code).toEqual(0);
            expect(successMessage).toHaveBeenCalledTimes(1);
            expect(successMessage).toHaveBeenCalledWith('2.00s');
            hrtimeMock.mockRestore();
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
