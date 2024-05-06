import { describe, it, expect } from 'vitest';
import { consumeFrontmatter } from '$utils';

describe('consumeFrontmatter', () => {
    it('should consume frontmatter and return content without frontmatter and frontmatter object', () => {
        const contentWithFrontmatter =
            '<!-- Comment -->\n---\ntitle: My Title\nauthor: John Doe\n---\nContent without frontmatter';

        const expectedContentWithoutFrontmatter =
            '<!-- Comment -->\n\nContent without frontmatter';

        const expectedFrontmatter = {
            title: 'My Title',
            author: 'John Doe',
        };

        const result = consumeFrontmatter(contentWithFrontmatter);

        expect(result.contentWithoutFrontmatter).toEqual(
            expectedContentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual(expectedFrontmatter);
    });

    it('frontmatter without html comments above it', () => {
        const contentWithFrontmatter =
            '---\ntitle: My Title\nauthor: John Doe\n---\nContent without frontmatter';

        const expectedContentWithoutFrontmatter = 'Content without frontmatter';

        const expectedFrontmatter = {
            title: 'My Title',
            author: 'John Doe',
        };

        const result = consumeFrontmatter(contentWithFrontmatter);

        expect(result.contentWithoutFrontmatter).toEqual(
            expectedContentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual(expectedFrontmatter);
    });

    it('invalid frontmatter throws error', () => {
        const contentWithFrontmatter =
            '---\ntitle\n- item 1\n  - item 2\nauthor: John Doe\n---\nContent without frontmatter';
        expect(() => consumeFrontmatter(contentWithFrontmatter)).toThrowError(
            'Implicit keys need to be on a single line at line 1, column 1:\n\ntitle\n^',
        );
    });

    it('should return empty content without frontmatter and empty frontmatter object if no frontmatter is found', () => {
        const contentWithoutFrontmatter = 'Content without frontmatter';

        const result = consumeFrontmatter(contentWithoutFrontmatter);

        expect(result.contentWithoutFrontmatter).toEqual(
            contentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual({});
    });
});
