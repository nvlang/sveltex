import { missingDeps } from '../../../../src/utils/env.js';
import { sveltex } from '../../../../src/base/Sveltex.js';
import { afterAll, beforeAll, describe, expect, it, test, vi } from 'vitest';
import { spy } from '../../fixtures.js';
import { cartesianProduct } from '../../utils.js';

describe('Sveltex.markup()', () => {
    beforeAll(async () => {
        await spy(['writeFile', 'log', 'mkdir'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('re-throws processor errors instead of emitting unprocessed source', async () => {
        // A swallowed error would make Svelte fall back to the original
        // markup — shipping raw Markdown and undefined components. The
        // preprocessor must reject so the build fails loudly instead.
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
        await expect(
            preprocessor.markup({
                content: '*something*',
                filename: 'test.sveltex',
            }),
        ).rejects.toThrow('example error');
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
            ).rejects.toThrow(/Failed to create SvelTeX preprocessor\./u);
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
                '@mathjax/src/js/components/global.js',
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
            ).rejects.toThrow(
                /Failed to create SvelTeX preprocessor\.\n\nPlease install the necessary dependencies by running:/u,
            );
            expect(missingDeps).toContain(markdownBackend);
            expect(missingDeps).toContain(
                codeBackend === 'starry-night'
                    ? '@wooorm/starry-night'
                    : codeBackend,
            );
            expect(missingDeps).toContain(
                mathBackend === 'mathjax' ? '@mathjax/src' : mathBackend,
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
                '@mathjax/src/js/mathjax.js',
                'katex',
            ].forEach((dep) => {
                vi.doUnmock(dep);
            });
        });

        test('lists the MathJax font package when a non-default font is set', async () => {
            vi.doMock('@mathjax/src/js/components/global.js', () => {
                throw new Error('@mathjax/src not found');
            });
            await expect(
                async () =>
                    await sveltex(
                        { mathBackend: 'mathjax' },
                        { math: { font: 'fira' } },
                    ),
            ).rejects.toThrow();
            expect(missingDeps).toContain('@mathjax/mathjax-fira-font');
            vi.doUnmock('@mathjax/src/js/components/global.js');
        });
    });
});
