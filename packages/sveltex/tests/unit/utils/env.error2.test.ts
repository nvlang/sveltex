import { describe, expect, it, vi } from 'vitest';

import { getVersion } from '../../../src/utils/env.js';
import { spy } from '../fixtures.js';

describe('getVersion', () => {
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
});
