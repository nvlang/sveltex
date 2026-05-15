import { afterEach, describe, expect, it, vi } from 'vitest';

import { getVersion } from '../../../src/utils/env.js';
import { spy } from '../fixtures.js';

describe('getVersion', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("works'", async () => {
        vi.mock('../../../src/base/defaults.js', () => {
            return {
                getDefaultCacheDirectory: () => 'a/b/c/node_modules/d/e/f',
            };
        });
        const readFile = await spy('readFile');
        await getVersion('katex');
        expect(readFile).toHaveBeenCalledOnce();
        expect(readFile).toHaveBeenCalledWith(
            expect.stringContaining('a/b/c/node_modules/katex/package.json'),
            'utf-8',
        );
    });

    it('returns undefined and logs an error if reading package.json fails', async () => {
        const readFile = await spy('readFile', () => {
            throw new Error('ENOENT: no such file or directory');
        });
        const log = await spy('log', false);
        await expect(getVersion('katex')).resolves.toBeUndefined();
        expect(readFile).toHaveBeenCalledOnce();
        expect(log).toHaveBeenCalledOnce();
        expect(log).toHaveBeenCalledWith(
            'error',
            expect.stringContaining('Error getting katex version:'),
        );
    });

    it('returns undefined if package.json has no `version` field', async () => {
        // `readFile` resolves with valid JSON that simply lacks a `version`
        // key, so the `if (json.version)` guard must take its falsy branch.
        const readFile = await spy('readFile', () =>
            JSON.stringify({ name: 'katex' }),
        );
        await expect(getVersion('katex')).resolves.toBeUndefined();
        expect(readFile).toHaveBeenCalledOnce();
    });
});
