// import { preprocess } from 'svelte/compiler';
// import { sveltex } from '$src';
// import { defaultSveltexConfig } from '$config';
// import { describe, it, expect, vi } from 'vitest';

// vi.mock('find-cache-dir', () => ({ default: vi.fn(() => 'node_modules/sveltes') }));

// interface Test {
//     input: string;
//     expected: string;
// }

// describe('sveltex: exceptions', () => {
//     it('ignore non-sveltex files (even if called)', async () => {
//         const input = 'Hello, *world*!';
//         const processed = await preprocess(input, sveltex(defaultSveltexConfig), {
//             filename: 'example.svelte',
//         });
//         expect(processed.code).toEqual(input);
//     });
// });

// describe('sveltex: markdown', () => {
//     const tests: Test[] = [
//         { input: 'Hello, world!', expected: 'Hello, world!' },
//         { input: '*italic*', expected: '<em>italic</em>' },
//         { input: '_italic_', expected: '<em>italic</em>' },
//         { input: '**bold**', expected: '<strong>bold</strong>' },
//         { input: '***italic bold***', expected: '<em><strong>italic bold</strong></em>' },
//         { input: '_**italic bold**_', expected: '<em><strong>italic bold</strong></em>' },
//         { input: '**_bold italic_**', expected: '<strong><em>bold italic</em></strong>' },
//         { input: '~~strikethrough~~', expected: '<del>strikethrough</del>' },
//         { input: '[text](link)', expected: '<a href="link">text</a>' },
//     ];

//     tests.forEach(({ input, expected }) => {
//         it(`Preprocess "${input}"`, async () => {
//             const processed = await preprocess(input, sveltex(defaultSveltexConfig), {
//                 filename: 'example.sveltex',
//             });
//             const expectedOutput = `<div class="sveltex-output"><p>${expected}</p>\n</div>`;
//             expect(processed.code).toEqual(expectedOutput);
//         });
//     });
// });

// // function simpleOutput(str: string) {
// //     return `<div class="sveltex-output"><p>${str}</p>\n</div>`;
// // }
