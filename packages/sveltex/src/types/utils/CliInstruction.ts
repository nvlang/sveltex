// File description: Types related to SvelTeX's interaction with Node.js's
// `child_process` module.

// Types
import type { SpawnOptionsWithoutStdio } from '../../deps.js';

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

/* eslint-disable tsdoc/syntax */
/**
 * Instructions to convert a DVI/PDF/XDV file to an SVG file.
 *
 * @param opts - An object describing the location of the DVI/PDF/XDV file and
 * the location at which the output file should be placed.
 * @returns A {@link CliInstruction | `CliInstruction`} object that will be used
 * to convert the DVI/PDF/XDV file to SVG.
 */
export type ConversionCliInstruction = (opts: {
    input: {
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref/root.dvi'
         */
        path: `${string}.${'dvi' | 'pdf' | 'xdv'}`;
        /**
         * @example 'root.dvi'
         */
        name: `${string}.${'dvi' | 'pdf' | 'xdv'}`;
        /**
         * @example 'dvi'
         */
        ext: 'dvi' | 'pdf' | 'xdv';
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref'
         */
        dir: string;
        /**
         * @example 'root'
         */
        basename: string;
    };
    output: {
        /**
         * @example 'src/sveltex/tex/ref.svg'
         */
        path: `${string}.${'svg'}`;
        /**
         * @example 'ref.svg'
         */
        name: `${string}.${'svg'}`;
        /**
         * @example 'svg'
         */
        ext: 'svg';
        /**
         * @example 'src/sveltex/tex'
         */
        dir: string;
        /**
         * @example 'ref'
         */
        basename: string;
    };
}) => CliInstruction;

/**
 * Instructions to convert a TeX file to a DVI/PDF/XDV file.
 *
 * @param opts - An object describing the location of the TeX code and the
 * location at which the output file should be placed.
 * @returns A {@link CliInstruction | `CliInstruction`} object that will be used
 * to compile the TeX code.
 */
export type CompilationCliInstruction = (opts: {
    input: {
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref/root.tex'
         */
        path: `${string}.tex`;
        /**
         * @example 'root.tex'
         */
        name: `${string}.tex`;
        /**
         * @example 'tex'
         */
        ext: 'tex';
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref'
         */
        dir: string;
        /**
         * @example 'root'
         */
        basename: string;
    };
    output: {
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref/root.dvi'
         */
        path: `${string}.${'dvi' | 'pdf' | 'xdv'}`;
        /**
         * @example 'root.dvi'
         */
        name: `${string}.${'dvi' | 'pdf' | 'xdv'}`;
        /**
         * @example 'dvi'
         */
        ext: 'dvi' | 'pdf' | 'xdv';
        /**
         * @example 'node_modules/.cache/@nvl/sveltex/tex/ref'
         */
        dir: string;
        /**
         * @example 'root'
         */
        basename: string;
    };
}) => CliInstruction;
