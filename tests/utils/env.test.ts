import { describe, it, expect, vi } from 'vitest';
import {
    SVELTE_MAJOR_VERSION,
    SVELTE_MINOR_VERSION,
    SVELTE_PATCH_VERSION,
} from '$utils';

describe('SVELTE_MAJOR_VERSION', () => {
    it('should be a number', () => {
        expect(typeof SVELTE_MAJOR_VERSION).toEqual('number');
    });

    it('should be greater than or equal to 0', () => {
        expect(SVELTE_MAJOR_VERSION).toBeGreaterThanOrEqual(0);
    });

    it('should match the major version in the VERSION string', () => {
        vi.mock('svelte/compiler', async (importOriginal) => {
            const actual = await importOriginal();
            if (typeof actual !== 'object') {
                throw new Error('test error');
            }
            return {
                ...actual,
                VERSION: '1.23',
            };
        });
        expect(SVELTE_MAJOR_VERSION).toEqual(0);
        expect(SVELTE_MINOR_VERSION).toEqual(0);
        expect(SVELTE_PATCH_VERSION).toEqual(0);
    });
});
