import { describe, it, expect } from 'vitest';
import { consumeFrontmatter } from '$utils/frontmatter.js';

describe('consumeFrontmatter(content: string)', () => {
    it('basic functionality', () => {
        const contentWithFrontmatter =
            '<!-- This is a comment -->\n' +
            '---\n' +
            'title: "My Document"\n' +
            'author: "John Doe"\n' +
            '---\n' +
            'This is the content without frontmatter.';

        const expectedContentWithoutFrontmatter =
            '<!-- This is a comment -->\n\nThis is the content without frontmatter.';

        const expectedFrontmatter = {
            title: 'My Document',
            author: 'John Doe',
        };

        const result = consumeFrontmatter(contentWithFrontmatter);

        expect(result.contentWithoutFrontmatter).toEqual(
            expectedContentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual(expectedFrontmatter);
    });

    it('edge case: empty frontmatter', () => {
        const contentWithFrontmatter =
            '<!-- This is a comment -->\n' +
            '---\n' +
            '---\n' +
            'This is the content without frontmatter.';

        const expectedContentWithoutFrontmatter =
            '<!-- This is a comment -->\n\nThis is the content without frontmatter.';

        const expectedFrontmatter = {};

        const result = consumeFrontmatter(contentWithFrontmatter);

        expect(result.contentWithoutFrontmatter).toEqual(
            expectedContentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual(expectedFrontmatter);
    });

    it('edge case: no frontmatter', () => {
        const contentWithoutFrontmatter =
            'This is the content without frontmatter.';
        const result = consumeFrontmatter(contentWithoutFrontmatter);
        expect(result.contentWithoutFrontmatter).toEqual(
            contentWithoutFrontmatter,
        );
        expect(result.frontmatter).toEqual({});
    });

    describe('edge cases: invalid frontmatter delimeters', () => {
        it.each([
            'A---\nB: C\n---',
            '---A: B\n---',
            '---\nA: B\n---C',
            ' ---\nA: B\n---',
        ])('should noop "$input"', (input) => {
            const result = consumeFrontmatter(input);
            expect(result.contentWithoutFrontmatter).toEqual(input);
            expect(result.frontmatter).toEqual({});
        });
    });

    describe('edge cases: HTML comments', () => {
        const tests = [
            {
                label: '-, <, >, and ! inside HTML comments',
                input: '<!-- A -- B <-- C - -> D <!- - E -->\n---\nkey: val\n---\ntext',
                expected: '<!-- A -- B <-- C - -> D <!- - E -->\n\ntext',
            },
            {
                label: 'empty HTML comment',
                input: '<!---->\n---\nkey: val\n---\ntext',
                expected: '<!---->\n\ntext',
            },
            {
                label: 'multiline HTML comment',
                input: '<!--\nA\n-->\n---\nkey: val\n---\ntext',
                expected: '<!--\nA\n-->\n\ntext',
            },
            {
                label: 'two HTML comments',
                input: '<!-- A --> \n<!-- B -->\n---\nkey: val\n---\ntext',
                expected: '<!-- A --> \n<!-- B -->\n\ntext',
            },
            {
                label: 'unicode support',
                input: '<!-- üñǐçøďė -->\n---\nkey: val\n---\nüñǐçøďė',
                expected: '<!-- üñǐçøďė -->\n\nüñǐçøďė',
            },
        ];
        it.each(tests)('$test.label', (test) => {
            const result = consumeFrontmatter(test.input);
            expect(result.contentWithoutFrontmatter).toEqual(test.expected);
        });

        // [
        //     { input: 'Hello, world!', expected: 'Hello, world!' },
        //     { input: '<!-- A -->\nB.', expected: '<!-- A -->\nB.' },
        //     { input: '---\nB.', expected: '---\nB.' },
        // ];
        // const contentWithFrontmatter = '<!-- A -->\n---\nB.';
        // const expectedContentWithoutFrontmatter = '<!-- A -->\n---\nB.';
        // const expectedFrontmatter = {};
        // const result = consumeFrontmatter(contentWithFrontmatter);
        // expect(result.contentWithoutFrontmatter).toEqual(expectedContentWithoutFrontmatter);
        // expect(result.frontmatter).toEqual(expectedFrontmatter);
    });
});
