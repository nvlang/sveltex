import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { EventEmitter } from 'node:events';

import { spawnCliInstruction } from '../../../src/utils/cli.js';
import * as deps from '../../../src/deps.js';

describe('spawnCliInstruction', () => {
    beforeAll(() => {
        vi.restoreAllMocks();
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should spawn a CLI instruction and resolve with the right exit code', async () => {
        const instr = {
            command: 'echo',
            args: ['Hello, World!'],
            env: {},
        };

        const exitCode = await spawnCliInstruction(instr);

        expect(exitCode).toEqual({
            code: 0,
            stderr: '',
            stdout: 'Hello, World!\n',
        });
    });

    it('should handle stdout and stderr data', async () => {
        const instr = {
            command: 'touch',
        };

        let stdoutData = '';
        let stderrData = '';

        const originalStdoutWrite = (data: string | Uint8Array) => {
            stdoutData += data.toString();
            return true;
        };

        const originalStderrWrite = (data: string | Uint8Array) => {
            stderrData += data.toString();
            return true;
        };

        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;

        await spawnCliInstruction(instr);

        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;

        expect(stdoutData).toEqual('');
        expect(stderrData).not.toEqual('');
    });

    describe('with a mocked child process', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        /**
         * Builds a fake child process whose `stdout`/`stderr` streams are plain
         * `EventEmitter`s, so that tests can emit arbitrary data chunks
         * (strings, `Uint8Array`s, or values of other types).
         */
        function fakeProcess() {
            const stdout = new EventEmitter();
            const stderr = new EventEmitter();
            const proc = new EventEmitter() as EventEmitter & {
                stdout: EventEmitter;
                stderr: EventEmitter;
            };
            proc.stdout = stdout;
            proc.stderr = stderr;
            return proc;
        }

        it('collects string chunks and writes them through when not silent', async () => {
            const proc = fakeProcess();
            vi.spyOn(deps, 'spawn').mockReturnValue(
                proc as unknown as ReturnType<typeof deps.spawn>,
            );
            const stdoutWrite = vi
                .spyOn(process.stdout, 'write')
                .mockReturnValue(true);
            const stderrWrite = vi
                .spyOn(process.stderr, 'write')
                .mockReturnValue(true);

            const promise = spawnCliInstruction({ command: 'noop' });
            proc.stdout.emit('data', 'out-as-string');
            proc.stderr.emit('data', 'err-as-string');
            proc.emit('exit', 0);

            await expect(promise).resolves.toEqual({
                code: 0,
                stdout: 'out-as-string',
                stderr: 'err-as-string',
            });
            expect(stdoutWrite).toHaveBeenCalledWith('out-as-string');
            expect(stderrWrite).toHaveBeenCalledWith('err-as-string');
        });

        it('collects chunks but suppresses console output when silent', async () => {
            const proc = fakeProcess();
            vi.spyOn(deps, 'spawn').mockReturnValue(
                proc as unknown as ReturnType<typeof deps.spawn>,
            );
            const stdoutWrite = vi
                .spyOn(process.stdout, 'write')
                .mockReturnValue(true);
            const stderrWrite = vi
                .spyOn(process.stderr, 'write')
                .mockReturnValue(true);

            const promise = spawnCliInstruction({
                command: 'noop',
                silent: true,
            });
            proc.stdout.emit('data', Buffer.from('quiet-out'));
            proc.stderr.emit('data', 'quiet-err');
            proc.emit('exit', 1);

            await expect(promise).resolves.toEqual({
                code: 1,
                stdout: 'quiet-out',
                stderr: 'quiet-err',
            });
            expect(stdoutWrite).not.toHaveBeenCalled();
            expect(stderrWrite).not.toHaveBeenCalled();
        });

        it('ignores chunks that are neither strings nor Uint8Arrays', async () => {
            const proc = fakeProcess();
            vi.spyOn(deps, 'spawn').mockReturnValue(
                proc as unknown as ReturnType<typeof deps.spawn>,
            );

            const promise = spawnCliInstruction({ command: 'noop' });
            // Emit values of types that should be ignored entirely.
            proc.stdout.emit('data', { not: 'a string' });
            proc.stderr.emit('data', 42);
            proc.emit('exit', null);

            await expect(promise).resolves.toEqual({
                code: null,
                stdout: '',
                stderr: '',
            });
        });
    });
});
