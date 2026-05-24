/**
 * MathJax v4's component/startup model initializes a single, process-global
 * `MathDocument` whose output jax (SVG or CHTML) is fixed on first use.
 * SvelTeX therefore supports exactly one MathJax output format per process —
 * which is all a SvelteKit build (one preprocessor configuration) ever needs.
 *
 * To exercise both `svg` and `chtml` output, the MathJax tests are split
 * across two files: Vitest runs each test file in an isolated module
 * registry, so each file gets its own MathJax singleton. This file covers
 * `outputFormat: 'chtml'` and default-configuration behaviour; `svg` output
 * is tested in `MathHandler.mathjax-svg.test.ts`.
 */
import {
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
    type MockInstance,
} from 'vitest';
import { MathHandler } from '../../../../src/handlers/MathHandler.js';
import { spy } from '../../fixtures.js';
import type { SupportedCdn } from '../../../../src/types/handlers/Css.js';
import type { PossibleMathCssApproach } from '../../../../src/types/handlers/Math.js';
import { sveltex } from '../../../../src/base/Sveltex.js';
import { missingDeps } from '../../../../src/utils/env.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

describe("MathHandler<'mathjax'>", () => {
    fixture();
    let writeFile: MockInstance;
    let log: MockInstance;
    let existsSync: MockInstance;
    let writeFileEnsureDirSync: MockInstance;
    /** `console.warn` output captured while the MathJax singleton starts up. */
    const mathjaxStartupWarnings: string[] = [];
    beforeAll(async () => {
        vi.spyOn(
            await import('../../../../src/deps.js'),
            'ora',
        ).mockImplementation((() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default);
        const mocks = await spy(
            [
                'writeFile',
                'writeFileSync',
                'writeFileEnsureDir',
                'writeFileEnsureDirSync',
                'fancyWrite',
                'mkdir',
                'log',
                'existsSync',
            ],
            true,
        );
        writeFile = mocks.writeFile;
        log = mocks.log;
        existsSync = mocks.existsSync;
        writeFileEnsureDirSync = mocks.writeFileEnsureDirSync;

        // Initialize the process-global MathJax singleton once, with
        // `console.warn` captured: the accessibility-option handling must not
        // make MathJax log any `Invalid option` warnings.
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation((...args: unknown[]) => {
                mathjaxStartupWarnings.push(args.map(String).join(' '));
            });
        await MathHandler.create('mathjax');
        warnSpy.mockRestore();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("MathHandler.create('mathjax')", () => {
        fixture();
        it('returns instance of MathHandler', async () => {
            const handler = await MathHandler.create('mathjax');
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
            expect(log).not.toHaveBeenCalled();
        });

        it('defaults to accessible MathML with speech generation off', async () => {
            const handler = await MathHandler.create('mathjax');
            expect(handler.configuration.mathjax.options).toEqual({
                enableAssistiveMml: true,
                enableBraille: false,
                enableEnrichment: false,
                enableSpeech: false,
            });
            expect(log).not.toHaveBeenCalled();
        });

        it('starts MathJax without any invalid-option warnings', () => {
            // `resolveMathjaxA11y` forwards only options whose MathJax
            // component is loaded, and the `startup.ready` hook strips the
            // `menuOptions` key that the assistive-mml component injects.
            expect(mathjaxStartupWarnings.join('\n')).not.toMatch(
                /Invalid option/u,
            );
        });

        it("doesn't generate CSS if the file already exists", async () => {
            existsSync.mockReturnValueOnce(true);
            await (await MathHandler.create('mathjax')).process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if `configuration.css.type` is `'none'`", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await MathHandler.create('mathjax', {
                css: { type: 'none' },
            });
            await handler.process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it('updates css as it goes', async () => {
            const s = await sveltex({ mathBackend: 'mathjax' });
            await Promise.all(
                ['$a$', '$b$', '$c$'].map(
                    async (str) =>
                        await s.markup({
                            content: str,
                            filename: 'test.sveltex',
                        }),
                ),
            );
            expect(writeFileEnsureDirSync).toHaveBeenCalledTimes(3);
        });
    });

    describe('missing dependencies', () => {
        fixture();
        it('surfaces a missing non-default font package and rethrows', async () => {
            // `@mathjax/src` (and its default `newcm` font) are installed, so
            // the `@mathjax/src` import succeeds; but `@mathjax/mathjax-tex-
            // font` is *not* installed. Selecting `font: 'tex'` therefore makes
            // the `import.meta.resolve` font probe throw, which records the
            // font package as a missing dependency and rethrows rather than
            // letting MathJax fail opaquely later in the pipeline.
            missingDeps.length = 0;
            await expect(
                MathHandler.create('mathjax', { font: 'tex' }),
            ).rejects.toThrow();
            expect(missingDeps).toContain('@mathjax/mathjax-tex-font');
            expect(log).not.toHaveBeenCalled();
            missingDeps.length = 0;
        });
    });

    describe('mathHandler', () => {
        fixture();
        const xChtml =
            '<mjx-container class="MathJax" jax="CHTML" overflow="overflow" style="position: relative;"><mjx-math data-latex="x" class="NCM-N" aria-hidden="true"><mjx-mi data-latex="x"><mjx-c class="mjx-c1D465">𝑥</mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML" data-latex="x"><mi data-latex="x">x</mi></math></mjx-assistive-mml></mjx-container>';

        describe('process()', () => {
            fixture();
            describe('should be able to output CHTML', () => {
                it.each([
                    ['hybrid', 1],
                    ['none', 0],
                    ['hybrid', 1, [], {}],
                    ['hybrid', 1, ['jsdelivr'], {}],
                    ['hybrid', 1, 'jsdelivr', {}],
                    ['hybrid', 1, [], { chtml: { fontURL: undefined } }],
                    [
                        'hybrid',
                        1,
                        [],
                        {
                            chtml: {
                                fontURL:
                                    'https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font/chtml/woff2',
                            },
                        },
                    ],
                    ['hybrid', 1, undefined, { chtml: null }],
                ] as [
                    PossibleMathCssApproach<'mathjax'>,
                    number,
                    (SupportedCdn | [SupportedCdn, ...SupportedCdn[]])?,
                    object?,
                ][])(
                    '%o, %o, %o',
                    async (type, nWrites, cdns, mathjaxConfig) => {
                        const handler = await MathHandler.create('mathjax', {
                            outputFormat: 'chtml',
                            css:
                                type === 'none'
                                    ? { type }
                                    : { type, cdn: cdns },
                            mathjax: { ...mathjaxConfig },
                        });

                        expect((await handler.process('x')).processed).toEqual(
                            xChtml,
                        );
                        await handler.updateCss();
                        expect(log).not.toHaveBeenCalled();
                        expect(writeFileEnsureDirSync).toHaveBeenCalledTimes(
                            nWrites,
                        );
                    },
                );
            });

            it('returns accessible math by default (CHTML)', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'chtml',
                });
                const { processed } = await handler.process(
                    '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
                );
                // Assistive MathML is emitted by default, so screen readers
                // can read the expression...
                expect(processed).toContain('mjx-assistive-mml');
                // ...while MathJax's own speech strings (which would be
                // attached as an `aria-label`) are not, to avoid screen
                // readers announcing the math twice.
                expect(processed).not.toContain('aria-label');
                expect(log).not.toHaveBeenCalled();
            });

            it('should support CSS color variables (CHTML)', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'chtml',
                });
                expect(
                    (
                        await handler.process('\\color{var(--red)}x', {
                            inline: false,
                        })
                    ).processed,
                ).toContain('style="color: var(--red);"');
                expect(log).not.toHaveBeenCalled();
            });

            it('should support transformers', async () => {
                const handler = await MathHandler.create('mathjax', {
                    transformers: {
                        pre: [
                            [/\*/gu, '\\cdot'],
                            ['a', 'b'],
                            ['b', 'c'],
                        ],
                        post: [
                            [
                                / class="(.*?)"/gu,
                                ' class="$1 mathjax-transformed"',
                            ],
                        ],
                    },
                });
                const res = (await handler.process('a * b', { inline: true }))
                    .processed;
                expect(res).toContain('c \\cdot c');
                expect(res).toContain('class="MathJax mathjax-transformed"');
                expect(log).not.toHaveBeenCalled();
            });
        });

        it('should be serializable', async () => {
            const handler = await MathHandler.create('mathjax');
            const serialized = JSON.stringify(handler);
            expect(serialized).toBeTypeOf('string');
            expect(serialized).not.toBeNull();
            expect(log).not.toHaveBeenCalled();
        });
    });
});
