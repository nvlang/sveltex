// File description: Robust, cross-platform detection of the TexLab binary.
//
// TexLab (https://github.com/latex-lsp/texlab) is a full LaTeX language server
// shipped as a standalone native executable. When it is installed, the SvelTeX
// language server forwards hover/completion/... within LaTeX verbatim regions
// to a spawned `texlab` child. When it is NOT installed, that forwarding is
// skipped silently — no error, no crash. This module answers the one question
// that drives that decision: "where is the `texlab` executable?".
//
// `PATH` is searched first (split by the platform delimiter; on Windows every
// `PATHEXT` extension is tried). It is then backed up by a list of well-known
// install directories: an editor launched from a macOS Dock / Finder, or via a
// Linux desktop launcher, inherits only a minimal `PATH` — often just
// `/usr/bin:/bin:/usr/sbin:/sbin` — that omits `/usr/local/bin`, Homebrew and
// `~/.cargo/bin`, exactly where `texlab` tends to live. Each candidate is
// probed with `fs.accessSync(..., X_OK)`; detection never throws.

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
 * Directories `texlab` is commonly installed into but which a GUI-launched
 * editor's `PATH` frequently omits.
 *
 * Searched _after_ `PATH`, as a fallback. Empty on Windows, where the usual
 * installers (scoop, winget, choco) reliably amend `PATH`.
 *
 * @param env - The environment, read for `HOME` to locate `~/.cargo/bin` (the
 * `cargo install texlab` target) and `~/.local/bin`.
 */
function wellKnownTexlabDirs(env: NodeJS.ProcessEnv): string[] {
    if (isWindows()) return [];
    const dirs = [
        '/opt/homebrew/bin', // Homebrew, Apple silicon
        '/opt/homebrew/sbin',
        '/usr/local/bin', // Homebrew (Intel) / manual installs
        '/usr/local/sbin',
        '/opt/local/bin', // MacPorts
    ];
    const home = env['HOME'];
    if (home) {
        dirs.push(join(home, '.cargo', 'bin'), join(home, '.local', 'bin'));
    }
    return dirs;
}

/**
 * Searches for the TexLab executable — on `PATH`, then in well-known install
 * directories.
 *
 * @param env - The environment to read `PATH` / `PATHEXT` / `HOME` from.
 * Defaults to `process.env`; injectable so tests can simulate texlab being
 * present or absent without touching the real environment.
 * @param extraDirs - Directories searched after `PATH`. Defaults to
 * {@link wellKnownTexlabDirs}; tests pass `[]` to confine the search to `env`.
 * @returns The absolute path of the `texlab` executable, or `undefined` if it
 * cannot be found.
 *
 * @remarks
 * The lookup is cross-platform: on Windows every `PATHEXT` extension is tried,
 * on POSIX the bare name. A directory that does not exist, or a candidate that
 * is not executable, is simply skipped — detection never throws.
 */
export function findTexlab(
    env: NodeJS.ProcessEnv = process.env,
    extraDirs: readonly string[] = wellKnownTexlabDirs(env),
): string | undefined {
    // `PATH` casing varies (Windows uses `Path`); accept the common forms.
    const pathValue = env['PATH'] ?? env['Path'] ?? env['path'] ?? '';
    const extensions = executableExtensions(env);
    for (const dir of [...pathValue.split(delimiter), ...extraDirs]) {
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
 * @param extraDirs - Optional extra-directories override (see
 * {@link findTexlab}).
 */
export function isTexlabAvailable(
    env?: NodeJS.ProcessEnv,
    extraDirs?: readonly string[],
): boolean {
    return findTexlab(env, extraDirs) !== undefined;
}
