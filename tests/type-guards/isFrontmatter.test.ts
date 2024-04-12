import { isFrontmatter } from '$type-guards';
import { describe, it, expect } from 'vitest';

describe('isFrontmatter', () => {
    it('should return true for valid frontmatter object', () => {
        expect(
            isFrontmatter({
                title: 'Sample Title',
                description: 'Sample Description',
                author: 'John Doe',
                tags: ['sample', 'tags'],
            }),
        ).toBe(true);
    });

    it('should return true for {}', () => {
        expect(isFrontmatter({})).toBe(true);
    });

    it('should return false for invalid frontmatter object', () => {
        expect(
            isFrontmatter({
                title: 'Sample Title',
                description: 'Sample Description',
                author: undefined,
            }),
        ).toBe(false);
    });

    it('should return false for non-object input', () => {
        expect(isFrontmatter('Sample Frontmatter')).toBe(false);
    });

    it('should return false for null input', () => {
        expect(isFrontmatter(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
        expect(isFrontmatter(undefined)).toBe(false);
    });
});
