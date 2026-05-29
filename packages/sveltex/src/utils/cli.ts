// File description: Spawn Node.js child processes.

// Types
import type { CliInstruction } from '../types/utils/CliInstruction.js';

// External dependencies
import { process, spawn } from '../deps.js';

/**
 * Spawns a child process to execute a command.
 *
 * @param instr - The instruction to execute.
 * @returns A promise that resolves with the exit code, `stdout`, and `stderr`
 * of the process. If the process could not be spawned at all (e.g. the command
 * isn't on the `PATH`, yielding an `ENOENT` error), `code` is `null` and the
 * spawn `error` is included so callers can produce an actionable message.
 */
export async function spawnCliInstruction(instr: CliInstruction): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
}> {
    let stdout = '';
    let stderr = '';
    const { command, args, env, silent, ...opts } = instr;
    const spawnedProcess = spawn(command, args, {
        ...opts,
        env: { ...process.env, ...env },
    });
    return new Promise((resolve) => {
        spawnedProcess.stdout.on('data', (x) => {
            if (typeof x === 'string' || x instanceof Uint8Array) {
                stdout += x.toString();
                if (!silent) process.stdout.write(x.toString());
            }
        });
        spawnedProcess.stderr.on('data', (x) => {
            if (typeof x === 'string' || x instanceof Uint8Array) {
                stderr += x.toString();
                if (!silent) process.stderr.write(x.toString());
            }
        });
        // Without an `error` listener, Node re-throws the child's `error`
        // event as an uncaught exception (e.g. `spawn pdflatex ENOENT` when
        // no TeX distribution is installed), which would crash the whole
        // build. Resolve gracefully instead and let the caller decide.
        spawnedProcess.on('error', (error) => {
            resolve({ code: null, stdout, stderr, error });
        });
        spawnedProcess.on('exit', (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}
