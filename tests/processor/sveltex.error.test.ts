import { missingDeps } from '$utils/globals.js';
import { sveltex } from '$Sveltex.js';
import { consoles } from '$utils/debug.js';
import { afterAll, describe, expect, it, suite, vi } from 'vitest';
import { spy } from '$tests/fixtures.js';

suite('sveltex error handling', async () => {
    await spy(['writeFile', 'log', 'mkdir'], true);
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('catches errors', async () => {
        vi.mock('svelte/compiler', async (importOriginal) => {
            const actual = await importOriginal();
            if (typeof actual !== 'object') {
                throw new Error('test error');
            }
            return {
                ...actual,
                parse: () => {
                    throw new Error('test error');
                },
            };
        });
        const consoleErrorMock = vi
            .spyOn(consoles, 'error')
            .mockImplementation(() => undefined);

        const preprocessor = await sveltex({
            markdownBackend: 'none',
            codeBackend: 'none',
            texBackend: 'none',
            advancedTexBackend: 'none',
        });
        const preprocess = async (
            input: string,
            filename: string = 'test.sveltex',
        ) => {
            return (await preprocessor.markup({ content: input, filename }))
                ?.code;
        };
        expect(await preprocess('*something*', 'test.sveltex')).toBeUndefined();
        // const consoleSpy = vi.spyOn(console, 'error');

        // await preprocess('*something*', 'test.sveltex');
        // expect(consoleErrorMock).toHaveBeenCalled();
        // expect((consoleErrorMock.mock.calls[0] ?? [])[0]).toBeInstanceOf(Error);
        // expect(
        //     ((consoleErrorMock.mock.calls[0] ?? [])[0] as Error).message,
        // ).toBe('test error');

        consoleErrorMock.mockRestore();
        // vi.unmock('svelte/compiler');
    });
});

describe('Sveltex.create()', () => {
    vi.doMock('unified', () => {
        throw new Error('unified not found');
    });
    vi.doMock('@wooorm/starry-night', () => {
        throw new Error('starry-night not found');
    });
    vi.doMock('mathjax-full/js/mathjax.js', () => {
        throw new Error('mathjax-full not found');
    });
    it('should complain any dependencies are missing', async () => {
        await expect(
            async () =>
                await sveltex({
                    markdownBackend: 'unified',
                    codeBackend: 'starry-night',
                    texBackend: 'mathjax',
                    advancedTexBackend: 'local',
                }),
        ).rejects.toThrowError(
            'Failed to create Sveltex preprocessor.\n\nPlease install the necessary dependencies by running:\n\npnpm add -D unified remark-parse remark-rehype rehype-stringify @types/mdast @wooorm/starry-night hast-util-find-and-replace hast-util-to-html mathjax',
        );
        expect(missingDeps).toEqual([
            'unified',
            'remark-parse',
            'remark-rehype',
            'rehype-stringify',
            '@types/mdast',
            '@wooorm/starry-night',
            'hast-util-find-and-replace',
            'hast-util-to-html',
            'mathjax-full',
        ]);
    });
    vi.unmock('unified');
    vi.unmock('@wooorm/starry-night');
    vi.unmock('mathjax-full/js/mathjax.js');
    vi.restoreAllMocks();
});
