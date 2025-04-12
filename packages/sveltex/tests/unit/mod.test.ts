import { describe, it, expect } from 'vitest';

const src = await import('../../src/mod.ts');

describe('src+index', () => {
    it('is an object', () => {
        expect(src).toBeDefined();
        expect(src).toBeTypeOf('object');
    });

    it('exports `sveltex`', () => {
        expect(src).toHaveProperty('sveltex');
    });
});
