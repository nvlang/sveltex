import { describe, expect, it, vi } from 'vitest';

import { getVersion } from '../../../src/utils/env.js';

describe('getVersion', () => {
    it("works even if getDefaultCacheDirectory doesn't contain 'node_modules'", async () => {
        vi.mock('../../../../src/base/defaults.js', () => {
            return { getDefaultCacheDirectory: () => 'a/b/c' };
        });
        await expect(getVersion('katex')).resolves.toMatch(/(\d+\.\d+\.\d+)/u);
        vi.restoreAllMocks();
    });
});
