// Unit tests for cross-platform TexLab detection (`src/core/texlab.ts`).
//
// The detector is exercised with a synthetic `PATH` pointing at a temporary
// directory, so the tests deterministically cover both "texlab present" and
// "texlab absent" without depending on whether the host machine actually has
// TexLab installed.

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findTexlab, isTexlabAvailable } from '../../src/core/texlab.js';

const isWindows = process.platform === 'win32';

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
        expect(findTexlab(env)).toBeUndefined();
    });

    it('returns undefined when PATH is unset', () => {
        expect(findTexlab({})).toBeUndefined();
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
        expect(isTexlabAvailable({ PATH: dirWithout })).toBe(false);
        expect(
            isTexlabAvailable({
                PATH: dirWithTexlab,
                ...(isWindows ? { PATHEXT: '.CMD;.EXE' } : {}),
            }),
        ).toBe(true);
    });
});
