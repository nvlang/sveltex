import { SVELTE_MAJOR_VERSION } from '$utils/globals.js';
import { afterAll, describe, expect, it, suite, vi } from 'vitest';

suite('SVELTE_MAJOR_VERSION', {}, () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('basic', () => {
        it('should be a number', () => {
            expect(typeof SVELTE_MAJOR_VERSION).toEqual('number');
        });
    });

    describe('error handling', () => {
        it('should gracefully return -1 if invalid version if found', () => {
            vi.mock(
                '$utils/debug.js',
                async (
                    orig: () => Promise<typeof import('svelte/compiler')>,
                ) => {
                    return {
                        ...(await orig()),
                        log: vi.fn().mockImplementation(() => undefined),
                    };
                },
            );
            vi.mock(
                'svelte/compiler',
                async (
                    orig: () => Promise<typeof import('svelte/compiler')>,
                ) => {
                    return {
                        ...(await orig()),
                        VERSION: '1.23',
                    };
                },
            );
            expect(SVELTE_MAJOR_VERSION).toEqual(-1);
        });
    });
});
