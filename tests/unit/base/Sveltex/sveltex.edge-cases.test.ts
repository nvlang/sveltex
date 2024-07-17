/**
 * Realistic tests for the Sveltex processor.
 */

import { sveltex } from '$base/Sveltex.js';
import { nodeAssert, sanitizeHtml } from '$deps.js';
import { fc, fuzzyTest } from '$dev_deps.js';
import { generateId } from '$utils/escape.js';
import { describe, expect, test } from 'vitest';

const arr: string[] = [];
for (let i = 0; i < 10; i++) {
    arr.push('<div>');
    arr.push('</div>');
    arr.push('\n');
    arr.push('*test*');
}

describe("fuzzy '<div>', '</div>', '\\n', and '*test*' combinations", () => {
    describe.each([
        // 'markdown-it', 'marked', 'micromark',
        'unified',
        // eslint-disable-next-line vitest/valid-describe-callback
    ] as const)(`%s`, { timeout: 120e3 }, (markdownBackend) => {
        fuzzyTest.prop(
            [
                fc.array(fc.constantFrom('<div>', '</div>', '\n', '*test*'), {
                    maxLength: 5,
                    size: 'small',
                }),
            ],
            {
                verbose: true,
                unbiased: true,
                numRuns: 2e3,
                // ...{ seed: -30175444, path: '1', endOnFailure: true },
                examples: [
                    [['<div>', '\n', '\n', '*test*', '</div>']],
                    [
                        [
                            '<div>',
                            '\n',
                            '<div>',
                            '\n',
                            '*test*',
                            '\n',
                            '</div>',
                            '\n',
                            '</div>',
                            '\n',
                            '\n',
                            '\n',
                            '<div>',
                            '\n',
                            '<div>',
                            '\n',
                            '*test*',
                            '\n',
                            '</div>',
                            '\n',
                            '</div>',
                        ],
                    ],
                ],
            },
        )('', async (permutation) => {
            const p = await sveltex({ markdownBackend });
            const content = sanitizePermutation(permutation).join('');
            const result = (
                await p.markup({
                    content,
                    filename: generateId() + '.sveltex',
                })
            )?.code;
            console.log({ permutation, content, result });
            expect(result).not.toContain('*test*');
        });
    });
});

describe('specific examples', () => {
    describe.each(['markdown-it', 'marked', 'micromark', 'unified'] as const)(
        `%s`,
        (markdownBackend) => {
            test.each([
                [
                    [
                        '<div>',
                        '<div>',
                        '*test*',
                        '</div>',
                        '</div>',
                        '\n',
                        '<div>',
                        '<div>',
                        '*test*',
                        '</div>',
                        '</div>',
                    ].join('\n'),
                    /<div>\n+<div>\n+<p><em>test<\/em><\/p>\n+<\/div>\n+<\/div>\n+<div>\n+<div>\n+<p><em>test<\/em><\/p>\n+<\/div>\n+<\/div>/,
                ],
            ])('%o', async (input, expected) => {
                const p = await sveltex(
                    { markdownBackend },
                    { markdown: { prefersInline: (tag) => tag !== 'div' } },
                );
                const result = (
                    await p.markup({
                        content: input,
                        filename: generateId() + '.sveltex',
                    })
                )?.code;
                expect(result).toBeDefined();
                nodeAssert(result !== undefined);
                expect(result).toMatch(expected);
                expect(result).toEqual(
                    sanitizeHtml(result, {
                        allowedTags: false,
                        allowVulnerableTags: true,
                    }),
                );
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
