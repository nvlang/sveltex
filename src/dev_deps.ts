export { default as mockFs } from 'mock-fs';
export {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
    type MockInstance,
} from 'vitest';

/**
 * Fuzzy testing.
 */
export { test as fuzzyTest, fc } from '@fast-check/vitest';
