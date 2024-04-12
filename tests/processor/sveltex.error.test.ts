import { describe, it, expect, vi } from 'vitest';
import { sveltex } from '$src/processor/index.js';
import { missingDeps } from '$src/globals/index.js';

describe('sveltex error handling', () => {
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
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
            return;
        });

        const preprocessor = await sveltex('none', 'none', 'none', 'none');
        const preprocess = async (
            input: string,
            filename: string = 'test.sveltex',
        ) => {
            return (await preprocessor.markup({ content: input, filename }))
                ?.code;
        };
        expect(await preprocess('*something*', 'test.sveltex')).toBeUndefined();
        // const consoleSpy = vi.spyOn(console, 'error');

        await preprocess('*something*', 'test.sveltex');
        expect(consoleSpy).toHaveBeenCalled();
        expect((consoleSpy.mock.calls[0] ?? [])[0]).toBeInstanceOf(Error);
        expect(((consoleSpy.mock.calls[0] ?? [])[0] as Error).message).toBe(
            'test error',
        );

        consoleSpy.mockRestore();
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
                await sveltex(
                    'unified',
                    'starry-night',
                    'mathjax-full',
                    'local',
                ),
        ).rejects.toThrowError(
            'Failed to create Sveltex preprocessor.\n\nPlease install the necessary dependencies by running:\n\npnpm add -D unified remark-parse remark-rehype rehype-stringify @types/mdast @wooorm/starry-night hast-util-find-and-replace hast-util-to-html mathjax-full',
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
