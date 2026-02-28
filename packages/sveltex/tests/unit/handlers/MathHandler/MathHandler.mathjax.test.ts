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

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

describe("MathHandler<'mathjax'>", () => {
    fixture();
    let writeFile: MockInstance;
    let fancyWrite: MockInstance;
    let log: MockInstance;
    let existsSync: MockInstance;
    let writeFileEnsureDirSync: MockInstance;
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
        fancyWrite = mocks.fancyWrite;
        log = mocks.log;
        existsSync = mocks.existsSync;
        writeFileEnsureDirSync = mocks.writeFileEnsureDirSync;
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
            // existsSync.mockReturnValueOnce(true);
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

    describe('mathHandler', () => {
        fixture();
        const xSvg =
            '<mjx-container class="MathJax" jax="SVG" overflow="overflow" style="position: relative;"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true"><defs><path id="MJX-1-NCM-I-1D465" d="M527 373C527 419 482 442 432 442C389 442 355 419 329 373C308 419 273 442 222 442C173 442 133 419 101 374C74 335 60 306 60 287C60 278 65 273 75 273C84 273 90 278 92 287C111 345 153 413 220 413C253 413 269 392 269 351C269 330 251 252 216 118C199 51 169 18 126 18C112 18 99 21 88 26C114 36 127 54 127 80C127 106 114 119 87 119C54 119 29 91 29 58C29 12 76-11 125-11C167-11 201 12 228 58C247 12 283-11 335-11C383-11 423 12 455 57C482 96 496 125 496 144C496 153 491 158 481 158C472 158 467 153 464 144C447 87 402 18 337 18C304 18 287 38 287 79C287 92 292 120 303 165L337 300C356 375 387 413 431 413C445 413 458 410 469 405C442 396 429 378 429 351C429 325 443 312 470 312C502 312 527 341 527 373Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="x"><g data-mml-node="mi" data-latex="x"><use data-c="1D465" xlink:href="#MJX-1-NCM-I-1D465"></use></g></g></g></svg><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML" data-latex="x"><mi data-latex="x">x</mi></math></mjx-assistive-mml></mjx-container>';
        const xChtml =
            '<mjx-container class="MathJax" jax="CHTML" overflow="overflow" style="position: relative;"><mjx-math data-latex="x" class="NCM-N" aria-hidden="true"><mjx-mi data-latex="x"><mjx-c class="mjx-c1D465">𝑥</mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML" data-latex="x"><mi data-latex="x">x</mi></math></mjx-assistive-mml></mjx-container>';

        describe('process()', () => {
            fixture();
            it('should be able to output SVG', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'svg',
                });
                expect((await handler.process('x')).processed).toEqual(xSvg);
                expect(log).not.toHaveBeenCalled();
            });

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
                        handler.updateCss();
                        expect(log).not.toHaveBeenCalled();
                        expect(writeFileEnsureDirSync).toHaveBeenCalledTimes(
                            nWrites,
                        );
                    },
                );
            });

            it('should return accessible math (CHTML)', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'chtml',
                    mathjax: {
                        options: {
                            enableSpeech: false,
                            enableBraille: false,
                            enableAssistiveMml: true,
                            enableEnrichment: false,
                        },
                    },
                });
                expect(
                    (await handler.process('\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'))
                        .processed,
                ).toContain('mjx-assistive-mml');
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
