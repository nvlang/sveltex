/**
 * MathJax v4's component/startup model initializes a single, process-global
 * `MathDocument` whose output jax (SVG or CHTML) is fixed on first use.
 * SvelTeX therefore supports exactly one MathJax output format per process —
 * which is all a SvelteKit build (one preprocessor configuration) ever needs.
 *
 * To exercise both `svg` and `chtml` output, the MathJax tests are split
 * across two files: Vitest runs each test file in an isolated module
 * registry, so each file gets its own MathJax singleton. This file covers
 * `outputFormat: 'svg'`; CHTML and default-configuration behaviour lives in
 * `MathHandler.mathjax.test.ts`.
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

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

describe("MathHandler<'mathjax'> (SVG output)", () => {
    fixture();
    let fancyWrite: MockInstance;
    let log: MockInstance;
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
        fancyWrite = mocks.fancyWrite;
        log = mocks.log;
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("MathHandler.create('mathjax')", () => {
        fixture();
        it('generates CSS', async () => {
            log.mockRestore();
            await (
                await MathHandler.create('mathjax', { outputFormat: 'svg' })
            ).process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /^static\/sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.css$/u,
                ),
                expect.stringContaining('mjx-container'),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            const handler = await MathHandler.create('mathjax', {
                outputFormat: 'svg',
            });
            await Promise.all(
                ['a', 'b', 'c'].map(async (str) => await handler.process(str)),
            );
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /^static\/sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.css$/u,
                ),
                expect.stringContaining('mjx-container'),
            );
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('mathHandler', () => {
        fixture();
        const xSvg =
            '<mjx-container class="MathJax" jax="SVG" overflow="overflow" style="position: relative;"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true"><defs><path id="MJX-1-NCM-I-1D465" d="M527 373C527 419 482 442 432 442C389 442 355 419 329 373C308 419 273 442 222 442C173 442 133 419 101 374C74 335 60 306 60 287C60 278 65 273 75 273C84 273 90 278 92 287C111 345 153 413 220 413C253 413 269 392 269 351C269 330 251 252 216 118C199 51 169 18 126 18C112 18 99 21 88 26C114 36 127 54 127 80C127 106 114 119 87 119C54 119 29 91 29 58C29 12 76-11 125-11C167-11 201 12 228 58C247 12 283-11 335-11C383-11 423 12 455 57C482 96 496 125 496 144C496 153 491 158 481 158C472 158 467 153 464 144C447 87 402 18 337 18C304 18 287 38 287 79C287 92 292 120 303 165L337 300C356 375 387 413 431 413C445 413 458 410 469 405C442 396 429 378 429 351C429 325 443 312 470 312C502 312 527 341 527 373Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="x"><g data-mml-node="mi" data-latex="x"><use data-c="1D465" xlink:href="#MJX-1-NCM-I-1D465"></use></g></g></g></svg><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML" data-latex="x"><mi data-latex="x">x</mi></math></mjx-assistive-mml></mjx-container>';

        describe('process()', () => {
            fixture();
            it('should be able to output SVG', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'svg',
                });
                // MathJax derives SVG glyph `<defs>` IDs (`MJX-<n>-…`) from a
                // process-global counter, so its value depends on how many
                // expressions were typeset earlier; normalize it before
                // comparing the structure.
                const normalizeMjxIds = (s: string) =>
                    s.replace(/MJX-\d+-/gu, 'MJX-');
                expect(
                    normalizeMjxIds((await handler.process('x')).processed),
                ).toEqual(normalizeMjxIds(xSvg));
                expect(log).not.toHaveBeenCalled();
            });

            it('should return accessible math (SVG)', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'svg',
                });
                expect(
                    (await handler.process('\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'))
                        .processed,
                ).toContain('mjx-assistive-mml');
                expect(log).not.toHaveBeenCalled();
            });

            it('should support CSS color variables (SVG)', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'svg',
                });
                expect(
                    (
                        await handler.process('\\color{var(--red)}x', {
                            inline: false,
                        })
                    ).processed,
                ).toContain('fill="var(--red)"');
                expect(log).not.toHaveBeenCalled();
            });
        });
    });
});
