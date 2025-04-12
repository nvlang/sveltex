/* eslint-disable tsdoc/syntax */
import { spawn, type SpawnOptionsWithoutStdio } from 'child_process';
import { default as process } from 'node:process';

/**
 * Spawns a child process to execute a command.
 *
 * @param instr {import('./index.d.mts').CliInstruction} - The instruction to execute.
 * @returns - A promise that resolves with the exit code, `stdout`, and `stderr`
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

/**
 * Instructions to execute within a child process (spawned via the `spawn`
 * method from the `node:child_process` module).
 */
export interface CliInstruction
    extends SpawnOptionsWithoutStdio,
        Record<string, unknown> {
    /**
     * Command to execute.
     *
     * @remarks
     * ⚠ **Warning**: This field is not sanitized. Do not pass untrusted input
     *   to it (especially if {@link shell | `shell`} is set to `true`).
     *
     * @remarks
     * _As far as I can tell:_ Node.js doesn't accept spaces in the `command`
     * property, so running multiple commands would require a `.sh` file or
     * something similar (passing commands to the {@link args | `args`} property
     * also doesn't work.)
     *
     * @remarks
     * The command is (essentially) spawned as follows (where `instr` is the
     * {@link CliInstruction | `CliInstruction`} in question):
     *
     * ```ts
     * // import { spawn } from 'node:child_process';
     * const { command, args, env, silent, ...opts } = instr;
     * const spawnedProcess = spawn(command, args, {
     *     ...opts,
     *     env: { ...process.env, ...env },
     * });
     * ```
     *
     * @see
     * {@link https://nodejs.org/api/child_process.html#child_processspawncommand-args-options | Node.js documentation} for `spawn`.
     */
    command: string;

    /**
     * Arguments to pass to the command.
     *
     * @remarks
     * Node.js takes care of escaping arguments for you, so you don't need to
     * surround them with quotes.
     */
    args?: string[] | undefined;

    /**
     * Environment variables to set for the command, *in addition to* those set
     * in {@link process.env | `process.env`}.
     *
     * @remarks
     * The following code will create a file named `$FOO`, not `bar`:
     *
     * ```ts
     * import { spawn } from 'node:child_process';
     * spawn('touch', ['$FOO'], { env: { FOO: 'bar' } });
     * ```
     *
     * However, the following code _will_ work as expected (assuming that a
     * `$HOME` environment variable exists):
     *
     * ```ts
     * import { spawn } from 'node:child_process';
     * spawn('touch', ['$HOME/test']);
     * ```
     */
    env?: NodeJS.ProcessEnv | undefined;

    /**
     * If `true`, `stdout` and `stderr` will not be written to the console.
     *
     * @defaultValue `undefined`
     */
    silent?: boolean | undefined;
}
