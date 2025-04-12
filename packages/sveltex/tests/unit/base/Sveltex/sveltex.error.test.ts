import { missingDeps } from '$utils/env.js';
import { sveltex } from '$base/Sveltex.js';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
    test,
    vi,
    type MockInstance,
} from 'vitest';
import { spy } from '$tests/unit/fixtures.js';
import { cartesianProduct } from '$tests/unit/utils.js';

describe('Sveltex.markup()', () => {
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['writeFile', 'log', 'mkdir'], true);
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('catches processor errors', async () => {
        vi.doMock(
            'micromark',
            async (orig: () => Promise<typeof import('micromark')>) => {
                return {
                    ...(await orig()),
                    micromark: () => {
                        throw new Error('example error');
                    },
                };
            },
        );
        const preprocessor = await sveltex({ markdownBackend: 'micromark' });
        expect(
            (
                await preprocessor.markup({
                    content: '*something*',
                    filename: 'test.sveltex',
                })
            )?.code,
        ).toBeUndefined();
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0]?.[0]).toEqual('error');
        vi.restoreAllMocks();
    });
});

describe('Sveltex.create()', () => {
    beforeAll(async () => {
        await spy('log');
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('rethrows unknown errors it catches', () => {
        test('bad configuration', async () => {
            await expect(
                async () =>
                    await sveltex(
                        {
                            markdownBackend: 'markdown-it',
                            codeBackend: 'highlight.js',
                            mathBackend: 'katex',
                        },
                        {
                            // @ts-expect-error For testing purposes
                            math: null,
                            // @ts-expect-error For testing purposes
                            markdown: null,
                            // @ts-expect-error For testing purposes
                            code: null,
                            // @ts-expect-error For testing purposes
                            tex: null,
                            // @ts-expect-error For testing purposes
                            verbatim: null,
                        },
                    ),
            ).rejects.toThrowError(/Failed to create SvelTeX preprocessor\./);
        });
    });
    describe('logs error about missing dependencies', () => {
        test.each(
            cartesianProduct(
                ['unified', 'markdown-it', 'micromark', 'marked'] as const,
                ['shiki', 'starry-night', 'highlight.js'] as const,
                ['katex', 'mathjax'] as const,
            ),
        )('%s + %s + %s', async (markdownBackend, codeBackend, mathBackend) => {
            [
                // Markdown processors
                'unified',
                'markdown-it',
                'micromark',
                'marked',
                // Code processors
                'shiki',
                'highlight.js',
                '@wooorm/starry-night',
                // Math processors,
                'mathjax-full/js/mathjax.js',
                'katex',
            ].forEach((dep) => {
                vi.doMock(dep, () => {
                    throw new Error(`${dep} not found`);
                });
            });
            await expect(
                async () =>
                    await sveltex({
                        mathBackend,
                        markdownBackend,
                        codeBackend,
                    }),
            ).rejects.toThrowError(
                /Failed to create SvelTeX preprocessor\.\n\nPlease install the necessary dependencies by running:/,
            );
            expect(missingDeps).toContain(markdownBackend);
            expect(missingDeps).toContain(
                codeBackend === 'starry-night'
                    ? '@wooorm/starry-night'
                    : codeBackend,
            );
            expect(missingDeps).toContain(
                mathBackend === 'mathjax' ? 'mathjax-full' : mathBackend,
            );
            [
                // Markdown processors
                'unified',
                'markdown-it',
                'micromark',
                'marked',
                // Code processors
                'shiki',
                'highlight.js',
                '@wooorm/starry-night',
                // Math processors,
                'mathjax-full/js/mathjax.js',
                'katex',
            ].forEach((dep) => {
                vi.doUnmock(dep);
            });
        });
    });
});
