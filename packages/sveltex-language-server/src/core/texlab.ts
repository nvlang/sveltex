// File description: Robust, cross-platform detection of the TexLab binary.
//
// TexLab (https://github.com/latex-lsp/texlab) is a full LaTeX language server
// shipped as a standalone native executable. When it is installed, the SvelTeX
// language server forwards hover/completion/... within LaTeX verbatim regions
// to a spawned `texlab` child. When it is NOT installed, that forwarding is
// skipped silently — no error, no crash. This module answers the one question
// that drives that decision: "is `texlab` on `PATH`?".
//
// `PATH` lookup is done by hand rather than shelling out (`which`/`where` are
// themselves not guaranteed to exist and spawning is slower): split `PATH`,
// and on Windows also try every `PATHEXT` extension, then probe each candidate
// with `fs.accessSync(..., X_OK)`.

import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

/** The base name of the TexLab executable (no extension). */
const TEXLAB_BASENAME = 'texlab';

/** Whether the host platform is Windows. */
function isWindows(): boolean {
    return process.platform === 'win32';
}

/** The fallback Windows executable extensions when `PATHEXT` is unset. */
const DEFAULT_PATHEXT: readonly string[] = ['.EXE', '.CMD', '.BAT', '.COM'];

/**
 * The executable file extensions to try for a bare command name.
 *
 * On Windows a command may be `texlab.exe`, `texlab.cmd`, ...; the set comes
 * from `PATHEXT`. On POSIX there is no extension, so a single empty string is
 * used.
 *
 * @param env - The environment to read `PATHEXT` from.
 */
function executableExtensions(env: NodeJS.ProcessEnv): string[] {
    if (!isWindows()) return [''];
    const pathext = env['PATHEXT'];
    if (!pathext) return [...DEFAULT_PATHEXT];
    return pathext.split(';').filter((ext) => ext.length > 0);
}

/** Whether `file` exists and is executable. */
function isExecutable(file: string): boolean {
    try {
        accessSync(file, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Searches `PATH` for the TexLab executable.
 *
 * @param env - The environment to read `PATH` / `PATHEXT` from. Defaults to
 * `process.env`; injectable so tests can simulate texlab being present or
 * absent without touching the real environment.
 * @returns The absolute path of the `texlab` executable, or `undefined` if it
 * is not found on `PATH`.
 *
 * @remarks
 * The lookup is cross-platform: on Windows every `PATHEXT` extension is tried,
 * on POSIX the bare name. A `PATH` entry that does not exist, or a candidate
 * that is not executable, is simply skipped — detection never throws.
 */
export function findTexlab(
    env: NodeJS.ProcessEnv = process.env,
): string | undefined {
    // `PATH` casing varies (Windows uses `Path`); accept the common forms.
    const pathValue = env['PATH'] ?? env['Path'] ?? env['path'];
    if (!pathValue) return undefined;
    const extensions = executableExtensions(env);
    for (const dir of pathValue.split(delimiter)) {
        if (dir.length === 0) continue;
        for (const ext of extensions) {
            const candidate = join(dir, `${TEXLAB_BASENAME}${ext}`);
            if (isExecutable(candidate)) return candidate;
        }
    }
    return undefined;
}

/**
 * Whether TexLab is available on this machine.
 *
 * @param env - Optional environment override (see {@link findTexlab}).
 */
export function isTexlabAvailable(env?: NodeJS.ProcessEnv): boolean {
    return findTexlab(env) !== undefined;
}
