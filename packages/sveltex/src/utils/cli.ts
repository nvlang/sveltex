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
 * of the process.
 */
export async function spawnCliInstruction(
    instr: CliInstruction,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
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
        spawnedProcess.on('exit', (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}
