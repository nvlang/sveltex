import type { SpawnOptionsWithoutStdio } from 'child_process';

/**
 * Instructions to execute on the command-line interface (CLI).
 */
export interface CliInstruction
    extends SpawnOptionsWithoutStdio,
        Record<string, unknown> {
    /**
     * Command to execute.
     */
    command: string;

    /**
     * Arguments to pass to the command.
     */
    args?: string[] | undefined;

    /**
     * Environment variables to set for the command, *in addition to* those set in
     * {@link process.env | `process.env`}.
     */
    env?: NodeJS.ProcessEnv | undefined;

    /**
     * If `true`, `stdout` and `stderr` will not be written to the console.
     *
     * @defaultValue `false`
     */
    silent?: boolean | undefined;
}
