import { describe, it, expect } from 'vitest';

const src = await import('$mod.js');

describe('src+index', () => {
    it('is an object', () => {
        expect(src).toBeDefined();
        expect(src).toBeTypeOf('object');
    });

    it('exports `sveltex`', () => {
        expect(src).toHaveProperty('sveltex');
    });
});
