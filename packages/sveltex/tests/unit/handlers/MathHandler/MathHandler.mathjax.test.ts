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
                    /sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/u,
                ),
                expect.stringContaining('[jax='),
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
                    /sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/u,
                ),
                expect.stringContaining('[jax='),
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
            '<mjx-container class="MathJax" jax="SVG"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-1-TEX-I-1D465"></use></g></g></g></svg></mjx-container>';
        const xSvgV4 =
            '<mjx-container class="MathJax" jax="SVG" overflow="overflow"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-MM-I-1D465" d="M527 376C527 428 468 442 434 442C376 442 341 389 329 366C304 432 250 442 221 442C117 442 60 313 60 288C60 278 72 278 72 278C80 278 83 280 85 289C119 395 185 420 219 420C238 420 273 411 273 353C273 322 256 255 219 115C203 53 168 11 124 11C118 11 95 11 74 24C99 29 121 50 121 78C121 105 99 113 84 113C54 113 29 87 29 55C29 9 79-11 123-11C189-11 225 59 228 65C240 28 276-11 336-11C439-11 496 118 496 143C496 153 487 153 484 153C475 153 473 149 471 142C438 35 370 11 338 11C299 11 283 43 283 77C283 99 289 121 300 165L334 302C340 328 363 420 433 420C438 420 462 420 483 407C455 402 435 377 435 353C435 337 446 318 473 318C495 318 527 336 527 376Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="x"><g data-mml-node="mi" data-latex="x"><use data-c="1D465" xlink:href="#MJX-1-MM-I-1D465"></use></g></g></g></svg></mjx-container>';
        const xChtml =
            '<mjx-container class="MathJax" jax="CHTML"><mjx-math class=" MJX-TEX"><mjx-mi class="mjx-i"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi></mjx-math></mjx-container>';
        const xChtmlV4 =
            '<mjx-container class="MathJax" jax="CHTML" overflow="overflow"><mjx-math data-latex="x" class=" MM-N"><mjx-mi data-latex="x"><mjx-c class="mjx-c1D465">𝑥</mjx-c></mjx-mi></mjx-math></mjx-container>';

        describe('process()', () => {
            fixture();
            it('should be able to output SVG', async () => {
                const handler = await MathHandler.create('mathjax', {
                    outputFormat: 'svg',
                });
                expect((await handler.process('x')).processed).oneOf([
                    xSvg,
                    xSvgV4,
                ]);
                expect(log).not.toHaveBeenCalled();
            });

            describe('should be able to output CHTML', () => {
                it.each([
                    ['hybrid', 1],
                    ['none', 0],
                    ['hybrid', 0, [], {}, undefined, true],
                    ['hybrid', 1, ['jsdelivr'], {}],
                    ['hybrid', 1, 'jsdelivr', {}],
                    [
                        'hybrid',
                        0,
                        [],
                        { chtml: { fontURL: undefined } },
                        undefined,
                        true,
                    ],
                    [
                        'hybrid',
                        0,
                        [],
                        {
                            chtml: {
                                fontURL:
                                    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
                            },
                        },
                        undefined,
                        true,
                    ],
                    ['hybrid', 1, undefined, { chtml: null }],
                ] as [
                    PossibleMathCssApproach<'mathjax'>,
                    number,
                    (SupportedCdn | [SupportedCdn, ...SupportedCdn[]])?,
                    object?,
                    boolean?,
                    boolean?,
                ][])(
                    '%o, %o, %o',
                    async (
                        type,
                        nWrites,
                        cdns,
                        mathjaxConfig,
                        mockFancyFetch,
                        expectError,
                    ) => {
                        let fancyFetch: MockInstance = vi.fn();
                        if (mockFancyFetch) {
                            fancyFetch = vi
                                .spyOn(
                                    await import(
                                        '../../../../src/utils/cdn.js'
                                    ),
                                    'fancyFetch',
                                )
                                .mockResolvedValue(undefined);
                        }
                        const handler = await MathHandler.create('mathjax', {
                            outputFormat: 'chtml',
                            css:
                                type === 'none'
                                    ? { type }
                                    : { type, cdn: cdns },
                            mathjax: { ...mathjaxConfig },
                        });

                        expect((await handler.process('x')).processed).oneOf([
                            xChtml,
                            xChtmlV4,
                        ]);
                        if (expectError) {
                            expect(() => {
                                handler.updateCss();
                            }).toThrowError();
                        } else {
                            handler.updateCss();
                        }
                        expect(log).not.toHaveBeenCalled();
                        expect(writeFileEnsureDirSync).toHaveBeenCalledTimes(
                            nWrites,
                        );
                        if (mockFancyFetch) fancyFetch.mockRestore();
                    },
                );
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
                ).oneOf([
                    '<mjx-container class="MathJax" jax="CHTML" display="true"><mjx-math display="true" style="margin-left: 0; margin-right: 0;" class=" MJX-TEX"><mjx-mstyle style="color: var(--red);"><mjx-mi class="mjx-i"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi></mjx-mstyle></mjx-math></mjx-container>',
                ]);
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
                ).oneOf([
                    '<mjx-container class="MathJax" jax="SVG" display="true"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mstyle" fill="var(--red)" stroke="var(--red)"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-1-TEX-I-1D465"></use></g></g></g></g></svg></mjx-container>',
                    '<mjx-container class="MathJax" jax="SVG" overflow="overflow" display="true"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-MM-I-1D465" d="M527 376C527 428 468 442 434 442C376 442 341 389 329 366C304 432 250 442 221 442C117 442 60 313 60 288C60 278 72 278 72 278C80 278 83 280 85 289C119 395 185 420 219 420C238 420 273 411 273 353C273 322 256 255 219 115C203 53 168 11 124 11C118 11 95 11 74 24C99 29 121 50 121 78C121 105 99 113 84 113C54 113 29 87 29 55C29 9 79-11 123-11C189-11 225 59 228 65C240 28 276-11 336-11C439-11 496 118 496 143C496 153 487 153 484 153C475 153 473 149 471 142C438 35 370 11 338 11C299 11 283 43 283 77C283 99 289 121 300 165L334 302C340 328 363 420 433 420C438 420 462 420 483 407C455 402 435 377 435 353C435 337 446 318 473 318C495 318 527 336 527 376Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="\\color&lbrace;var(--red)&rbrace;x"><g data-mml-node="mstyle" fill="var(--red)" stroke="var(--red)" data-latex="\\color&lbrace;var(--red)&rbrace;x"><g data-mml-node="mi" data-latex="x"><use data-c="1D465" xlink:href="#MJX-1-MM-I-1D465"></use></g></g></g></g></svg></mjx-container>',
                ]);
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
                expect(
                    (await handler.process('a * b', { inline: true }))
                        .processed,
                ).oneOf([
                    '<mjx-container class="MathJax mathjax-transformed" jax="CHTML"><mjx-math class=" MJX-TEX mathjax-transformed"><mjx-mi class="mjx-i mathjax-transformed"><mjx-c class="mjx-c1D450 TEX-I mathjax-transformed"></mjx-c></mjx-mi><mjx-mo class="mjx-n mathjax-transformed" space="3"><mjx-c class="mjx-c22C5 mathjax-transformed"></mjx-c></mjx-mo><mjx-mi class="mjx-i mathjax-transformed" space="3"><mjx-c class="mjx-c1D450 TEX-I mathjax-transformed"></mjx-c></mjx-mi></mjx-math></mjx-container>',
                ]);
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
