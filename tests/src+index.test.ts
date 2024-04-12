import { describe, it, expect } from 'vitest';

const src = await import('$src');

describe('src+index', () => {
    it('is an object', () => {
        expect(src).toBeDefined();
        expect(src).toBeTypeOf('object');
    });

    it('exports `sveltex`', () => {
        expect(src).toHaveProperty('sveltex');
    });

    it('exports `Sveltex`', () => {
        expect(src).toHaveProperty('Sveltex');
    });
});
