// Types
import type { CliInstruction } from '$types/utils/CliInstruction.js';

// External dependencies
import { spawn } from '$deps.js';

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

// import { spawn } from 'child_process';

// /**
//  * Return true iff dvisvgm is installed with version ≥3.0.4.
//  *
//  * @remarks
//  * Version 3.0.4 fixes an {@link https://github.com/mgieseki/dvisvgm/issues/232 | issue} with PDF to
//  * SVG conversion, which is used by SvelTeX to render TeX blocks with the LuaTeX and XeTeX engines.
//  */
// export async function checkDvisvgm(): Promise<boolean> {
//     const version = await dvisvgmVersion();
//     const minVersion = '3.0.4';
//     if (semanticVersionIsAtLeast(version, minVersion)) {
//         return true;
//     } else {
//         console.error(
//             `dvisvgm version must be at least ${minVersion} (found ${version}). ` +
//                 'Please upgrade your TeX distribution or update dvisvgm separately ' +
//                 '(https://dvisvgm.de/Downloads/).',
//         );
//         return false;
//     }
// }

// /**
//  * Return the version of `dvisvgm`.
//  */
// export function dvisvgmVersion(): Promise<string> {
//     return new Promise((resolve, reject) => {
//         const dvisvgm = spawn('dvisvgm', ['--version']);
//         let version = '';
//         dvisvgm.stdout.on('data', (data: Buffer) => {
//             version += data.toString();
//         });
//         dvisvgm.on('exit', (code: number) => {
//             if (code === 0) {
//                 resolve(version.replace('dvisvgm ', '').trim());
//             } else {
//                 reject(new Error('dvisvgm not found'));
//             }
//         });
//     });
// }

// /**
//  * @param version - A semantic version string (e.g., '1.2.3').
//  * @param minVersion - A semantic version string (e.g., '1.2.3').
//  * @returns `true` iff `version` is at least `minVersion`.
//  */
// function semanticVersionIsAtLeast(
//     version: string,
//     minVersion: string,
// ): boolean {
//     // Parse the version strings
//     const [major, minor, patch] = version
//         .split('.')
//         .map((v) => parseInt(v, 10));
//     const [minMajor, minMinor, minPatch] = minVersion
//         .split('.')
//         .map((v) => parseInt(v, 10));

//     // Check for invalid version numbers
//     if (!major || !minor || !patch) {
//         console.warn('Invalid version number:', version);
//         return false;
//     }
//     if (!minMajor || !minMinor || !minPatch) {
//         console.warn('Invalid minVersion number:', minVersion);
//         return false;
//     }

//     // Compare the version numbers
//     return (
//         major > minMajor ||
//         (major === minMajor && minor > minMinor) ||
//         (major === minMajor && minor === minMinor && patch >= minPatch)
//     );
// }
