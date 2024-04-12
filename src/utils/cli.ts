import { spawn } from 'child_process';
import { CliInstruction } from '$types';

/**
 * Spawns a child process to execute a command.
 *
 * @param instr - The instruction to execute.
 * @returns A promise that resolves with the exit code, `stdout`, and `stderr`
 * of the process.
 */
export function spawnCliInstruction(
    instr: CliInstruction,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    const silent = instr.silent ?? false;
    let stdout = '';
    let stderr = '';
    const instrOpts: Partial<CliInstruction> = { ...instr };
    delete instrOpts.command;
    delete instrOpts.args;
    delete instrOpts.env;
    delete instrOpts.silent;
    const spawnedProcess = spawn(instr.command, instr.args, {
        ...instrOpts,
        env: { ...process.env, ...instr.env },
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
