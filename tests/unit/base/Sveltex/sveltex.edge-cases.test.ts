/**
 * Realistic tests for the Sveltex processor.
 */

import { sveltex } from '$base/Sveltex.js';
import { fc, fuzzyTest } from '$dev_deps.js';
import { describe, expect, test } from 'vitest';
import { uuid } from '$deps.js';

const arr: string[] = [];
for (let i = 0; i < 10; i++) {
    arr.push('<div>');
    arr.push('</div>');
    arr.push('\n');
    arr.push('*test*');
}

describe("fuzzy '<div>', '</div>', '\\n', and '*test*' combinations", () => {
    describe.each(['markdown-it', 'marked', 'micromark', 'unified'] as const)(
        `%s`,
        (markdownBackend) => {
            fuzzyTest.prop(
                [
                    fc.array(
                        fc.constantFrom('<div>', '</div>', '\n', '*test*'),
                        { maxLength: 5, size: 'small' },
                    ),
                ],
                {
                    verbose: true,
                    unbiased: true,
                    numRuns: 1e3,
                    examples: [[['<div>', '\n', '\n', '*test*', '</div>']]],
                },
            )('', async (permutation) => {
                const p = await sveltex({ markdownBackend });
                const content = sanitizePermutation(permutation).join('');
                const result = (
                    await p.markup({
                        content,
                        filename: uuid() + '.sveltex',
                    })
                )?.code;
                console.log({ permutation, content, result });
                expect(result).not.toContain('*test*');
            });
        },
    );
});

describe('sanitizePermutation', () => {
    test.each([
        [['<div>'], ['<div>', '</div>']],
        [
            ['<div>', '*test*', '\n', '</div>'],
            ['<div>', '*test*', '\n', '</div>'],
        ],
        [
            ['*test*', '</div>', '\n', '<div>'],
            ['*test*', '\n', '<div>', '</div>'],
        ],
    ])('%o', (input, expected) => {
        expect(sanitizePermutation(input)).toEqual(expected);
    });
});

function sanitizePermutation(permutation: string[]): string[] {
    const result: string[] = [];
    let openDivs = 0;
    for (const token of permutation) {
        if (token === '<div>') {
            openDivs++;
            result.push(token);
        } else if (token === '</div>') {
            if (openDivs > 0) {
                openDivs--;
                result.push(token);
            }
        } else {
            result.push(token);
        }
    }
    while (openDivs > 0) {
        result.push('</div>');
        openDivs--;
    }
    return result;
}
