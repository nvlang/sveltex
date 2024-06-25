import { describe, expect, it, vi } from 'vitest';

import { getVersion } from '$utils/env.js';
import { spy } from '$tests/unit/fixtures.js';

describe('getVersion', () => {
    it("works even if defaultCacheDirectory doesn't contain 'node_modules'", async () => {
        vi.mock('$base/defaults.js', () => {
            return { defaultCacheDirectory: 'a/b/c/node_modules/d/e/f' };
        });
        const readFile = await spy('readFile');
        await getVersion('katex');
        expect(readFile).toHaveBeenCalledOnce();
        expect(readFile).toHaveBeenCalledWith(
            expect.stringContaining('a/b/c/node_modules/katex/package.json'),
            'utf-8',
        );
    });
});
