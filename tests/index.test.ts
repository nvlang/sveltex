import { preprocess } from 'svelte/compiler';
import preprocessSveltex from '../src/index.js';

type Test = {
    input: string;
    expected: string;
};

describe('preprocessSveltex: exceptions', () => {
    it('ignore non-sveltex files (even if called)', async () => {
        const input = 'Hello, *world*!';
        const processed = await preprocess(input, preprocessSveltex(), {
            filename: 'example.svelte',
        });
        expect(processed.code).toEqual(input);
    });
});

describe('preprocessSveltex: markdown', () => {
    const tests: Test[] = [
        { input: 'Hello, world!', expected: 'Hello, world!' },
        { input: '*italic*', expected: '<em>italic</em>' },
        { input: '_italic_', expected: '<em>italic</em>' },
        { input: '**bold**', expected: '<strong>bold</strong>' },
        { input: '***italic bold***', expected: '<em><strong>italic bold</strong></em>' },
        { input: '_**italic bold**_', expected: '<em><strong>italic bold</strong></em>' },
        { input: '**_bold italic_**', expected: '<strong><em>bold italic</em></strong>' },
        { input: '~~strikethrough~~', expected: '<del>strikethrough</del>' },
        { input: '[text](link)', expected: '<a href="link">text</a>' },
    ];

    tests.forEach(({ input, expected }) => {
        it(input, async () => {
            const processed = await preprocess(input, preprocessSveltex(), {
                filename: 'example.sveltex',
            });
            const expectedOutput = `<div class="sveltex-output"><p>${expected}</p>\n</div>`;
            expect(processed.code).toEqual(expectedOutput);
        });
    });

    // it('[text](link)', async () => {
    //     const input = '[text](link)';
    //     const expectedOutput = simpleOutput('<a href="link">text</a>');
    //     const processed = await preprocess(input, preprocessSveltex());
    //     expect(processed.code).toEqual(expectedOutput);
    // });

    // it('*italic*', async () => {
    //     const input = '*italic*';
    //     const expectedOutput = simpleOutput('<em>italic</em>');
    //     const processed = await preprocess(input, preprocessSveltex());
    //     expect(processed.code).toEqual(expectedOutput);
    // });
});

// function simpleOutput(str: string) {
//     return `<div class="sveltex-output"><p>${str}</p>\n</div>`;
// }
