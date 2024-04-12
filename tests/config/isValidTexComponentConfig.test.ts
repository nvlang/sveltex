import { describe, it, expect } from 'vitest';
import { isValidComponentName } from '$config';

describe('isValidTexComponentConfig', () => {
    it('should return true for a valid configuration', () => {
        expect(isValidComponentName('something')).toBe(true);
    });
    it('should return false for a valid configuration', () => {
        expect(isValidComponentName('div')).toBe(false);
    });
});
