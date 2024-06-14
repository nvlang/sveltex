import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { spawnCliInstruction } from '$utils/cli.js';

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
});
