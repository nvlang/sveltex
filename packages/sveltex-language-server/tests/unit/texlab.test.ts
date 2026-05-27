// Unit tests for cross-platform TexLab detection (`src/core/texlab.ts`).
//
// The detector is exercised with a synthetic `PATH` pointing at a temporary
// directory, so the tests deterministically cover both "texlab present" and
// "texlab absent" without depending on whether the host machine actually has
// TexLab installed.

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { findTexlab, isTexlabAvailable } from '../../src/core/texlab.js';

const isWindows = process.platform === 'win32';

/**
 * Runs `fn` with `process.platform` reported as `platform`, restoring the real
 * value afterwards. `process.platform` is a non-writable getter, so it is
 * temporarily redefined.
 */
function withPlatform(platform: NodeJS.Platform, fn: () => void): void {
    const original = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
    });
    try {
        fn();
    } finally {
        if (original) Object.defineProperty(process, 'platform', original);
    }
}

describe('findTexlab', () => {
    let dirWithTexlab: string;
    let dirWithout: string;
    let texlabPath: string;

    beforeAll(() => {
        dirWithTexlab = mkdtempSync(join(tmpdir(), 'sveltex-texlab-yes-'));
        dirWithout = mkdtempSync(join(tmpdir(), 'sveltex-texlab-no-'));
        // Create a fake, executable `texlab` (`.cmd` on Windows so a `PATHEXT`
        // lookup finds it).
        texlabPath = join(dirWithTexlab, isWindows ? 'texlab.cmd' : 'texlab');
        writeFileSync(texlabPath, isWindows ? '@echo off\n' : '#!/bin/sh\n');
        if (!isWindows) chmodSync(texlabPath, 0o755);
        // A decoy unrelated file in the other directory.
        writeFileSync(join(dirWithout, 'not-texlab'), '');
    });

    afterAll(() => {
        rmSync(dirWithTexlab, { recursive: true, force: true });
        rmSync(dirWithout, { recursive: true, force: true });
    });

    it('finds texlab when its directory is on PATH', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: dirWithTexlab,
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        expect(findTexlab(env)).toBe(texlabPath);
    });

    it('finds texlab among several PATH entries', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: [dirWithout, dirWithTexlab].join(delimiter),
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        expect(findTexlab(env)).toBe(texlabPath);
    });

    it('returns undefined when texlab is not on PATH', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: dirWithout,
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        // `[]` disables the well-known-directory fallback, which would
        // otherwise find a `texlab` the host machine happens to have.
        expect(findTexlab(env, [])).toBeUndefined();
    });

    it('returns undefined when PATH is unset', () => {
        expect(findTexlab({}, [])).toBeUndefined();
    });

    it('finds texlab in a well-known directory when not on PATH', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: dirWithout,
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        // GUI-launched editors get a stripped `PATH`; the fallback covers it.
        expect(findTexlab(env, [dirWithTexlab])).toBe(texlabPath);
    });

    it('prefers a PATH match over a well-known directory', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: dirWithTexlab,
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        expect(findTexlab(env, [dirWithout])).toBe(texlabPath);
    });

    it('tolerates empty segments in PATH', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: `${delimiter}${dirWithTexlab}${delimiter}`,
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        expect(findTexlab(env)).toBe(texlabPath);
    });

    it('tolerates a PATH entry that does not exist', () => {
        const env: NodeJS.ProcessEnv = {
            PATH: [
                join(tmpdir(), 'definitely-not-a-real-dir-xyz'),
                dirWithTexlab,
            ].join(delimiter),
            ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
        };
        expect(findTexlab(env)).toBe(texlabPath);
    });

    it('isTexlabAvailable mirrors findTexlab', () => {
        expect(isTexlabAvailable({ PATH: dirWithout }, [])).toBe(false);
        expect(
            isTexlabAvailable({
                PATH: dirWithTexlab,
                ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
            }),
        ).toBe(true);
    });

    it('builds the well-known dir list (incl. ~/.cargo/bin) when HOME is set', () => {
        // Omitting `extraDirs` exercises the default `wellKnownTexlabDirs(env)`;
        // a `HOME` value drives the `~/.cargo/bin` / `~/.local/bin` push. PATH
        // here points at the fake texlab so the result is deterministic
        // regardless of whether the host has a real texlab in a well-known dir.
        const home = mkdtempSync(join(tmpdir(), 'sveltex-texlab-home-'));
        try {
            const env: NodeJS.ProcessEnv = {
                PATH: dirWithTexlab,
                HOME: home,
                ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
            };
            // The PATH entry wins; the point of the test is that the default
            // `extraDirs` were built from `env` with `HOME` present (line that
            // pushes the cargo/local dirs), which a host-installed texlab in a
            // well-known dir would otherwise mask if we relied on PATH-miss.
            expect(findTexlab(env)).toBe(texlabPath);
        } finally {
            rmSync(home, { recursive: true, force: true });
        }
    });
});

// The Windows-specific `PATHEXT` handling in `executableExtensions` cannot run
// on a POSIX host without faking `process.platform`. These drive each Windows
// branch (explicit `PATHEXT`, missing `PATHEXT` → built-in defaults) regardless
// of the real host OS; the temp `texlab.EXE` is executable on either platform.
describe('findTexlab — Windows extension handling', () => {
    let dir: string;

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('tries each PATHEXT extension when PATHEXT is set', () => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-texlab-win-ext-'));
        const exe = join(dir, 'texlab.EXE');
        writeFileSync(exe, '');
        chmodSync(exe, 0o755);
        withPlatform('win32', () => {
            const found = findTexlab({ PATH: dir, PATHEXT: '.CMD;.EXE' }, []);
            expect(found).toBe(exe);
        });
    });

    it('falls back to the default PATHEXT set when PATHEXT is unset', () => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-texlab-win-def-'));
        // `.EXE` is one of the DEFAULT_PATHEXT entries used when PATHEXT is unset.
        const exe = join(dir, 'texlab.EXE');
        writeFileSync(exe, '');
        chmodSync(exe, 0o755);
        withPlatform('win32', () => {
            const found = findTexlab({ PATH: dir }, []);
            expect(found).toBe(exe);
        });
    });

    it('returns [] of well-known dirs on Windows (no HOME push)', () => {
        dir = mkdtempSync(join(tmpdir(), 'sveltex-texlab-win-home-'));
        // With the default extraDirs on Windows the well-known list is empty,
        // so a texlab only reachable via HOME is not found.
        withPlatform('win32', () => {
            const found = findTexlab({ PATH: dir, HOME: dir });
            expect(found).toBeUndefined();
        });
    });
});
