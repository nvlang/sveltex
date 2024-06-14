import {
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
    MockInstance,
} from 'vitest';
import { MathHandler } from '$handlers/MathHandler.js';
import { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import { spy } from '$tests/unit/fixtures.js';
import { v4 as uuid } from 'uuid';
import { consoles } from '$utils/debug.js';
import { SupportedCdn } from '$types/handlers/Css.js';
import { PossibleMathCssApproach } from '$types/handlers/Math.js';

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
    let writeFileEnsureDir: MockInstance;
    beforeAll(async () => {
        vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
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
                'writeFileEnsureDir',
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
        writeFileEnsureDir = mocks.writeFileEnsureDir;
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
            await (await MathHandler.create('mathjax')).process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/,
                ),
                expect.stringContaining('[jax='),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            // existsSync.mockReturnValueOnce(true);
            const handler = await MathHandler.create('mathjax');
            await handler.process('');
            await handler.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/,
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
            const handler = await MathHandler.create('mathjax');
            await handler.configure({ css: { type: 'none' } });
            await handler.process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
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
            it('should work, and output SVG by default', async () => {
                const handler = await MathHandler.create('mathjax');
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
                                    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/',
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
                                    await import('$utils/cdn.js'),
                                    'fancyFetch',
                                )
                                .mockResolvedValue(undefined);
                        }
                        const handler = await MathHandler.create('mathjax');
                        await handler.configure({
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
                            await expect(async () => {
                                await handler.updateCss();
                            }).rejects.toThrowError();
                        } else {
                            await handler.updateCss();
                        }
                        await handler.configure({ outputFormat: 'svg' });
                        expect(log).not.toHaveBeenCalled();
                        expect(writeFileEnsureDir).toHaveBeenCalledTimes(
                            nWrites,
                        );
                        if (mockFancyFetch) fancyFetch.mockRestore();
                    },
                );
            });

            it('should throw error if MathJax did not return a valid node', async () => {
                const handler = await MathHandler.create('mathjax');
                handler.processor = {
                    convert: () => null,
                    outputJax: { styleSheet: () => ({ children: [] }) },
                } as unknown as MathDocument<unknown, unknown, unknown>;
                await expect(
                    async () => await handler.process('abcde'),
                ).rejects.toThrowError(
                    'MathJax did not return a valid node (result: null).',
                );
                expect(log).not.toHaveBeenCalled();
            });

            it('should support CSS color variables', async () => {
                const handler = await MathHandler.create('mathjax');
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
                const handler = await MathHandler.create('mathjax');
                await handler.configure({
                    transformers: {
                        pre: [
                            [/\*/g, '\\cdot'],
                            ['a', 'b'],
                            ['b', 'c'],
                        ],
                        post: [
                            [
                                / class="(.*?)"/g,
                                ' class="$1 mathjax-transformed"',
                            ],
                        ],
                    },
                });
                expect(
                    (await handler.process('a * b', { inline: true }))
                        .processed,
                ).oneOf([
                    '<mjx-container class="MathJax mathjax-transformed" jax="SVG"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="3.594ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 1588.4 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D450" d="M34 159Q34 268 120 355T306 442Q362 442 394 418T427 355Q427 326 408 306T360 285Q341 285 330 295T319 325T330 359T352 380T366 386H367Q367 388 361 392T340 400T306 404Q276 404 249 390Q228 381 206 359Q162 315 142 235T121 119Q121 73 147 50Q169 26 205 26H209Q321 26 394 111Q403 121 406 121Q410 121 419 112T429 98T420 83T391 55T346 25T282 0T202 -11Q127 -11 81 37T34 159Z"></path><path id="MJX-1-TEX-N-22C5" d="M78 250Q78 274 95 292T138 310Q162 310 180 294T199 251Q199 226 182 208T139 190T96 207T78 250Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D450" xlink:href="#MJX-1-TEX-I-1D450"></use></g><g data-mml-node="mo" transform="translate(655.2,0)"><use data-c="22C5" xlink:href="#MJX-1-TEX-N-22C5"></use></g><g data-mml-node="mi" transform="translate(1155.4,0)"><use data-c="1D450" xlink:href="#MJX-1-TEX-I-1D450"></use></g></g></g></svg></mjx-container>',
                    '<mjx-container class="MathJax mathjax-transformed" jax="SVG" overflow="overflow"><svg style="vertical-align: -0.566ex;" xmlns="http://www.w3.org/2000/svg" width="0.98ex" height="2.262ex" role="img" focusable="false" viewBox="0 -750 433 1000" xmlns:xlink="http://www.w3.org/1999/xlink"><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="c \\cdot c"><g data-mml-node="mi" data-latex="c"><use data-c="1D450" xlink:href="#MJX-1-MM-I-1D450"></use></g></g></g><defs><path id="MJX-1-MM-I-1D450" d="M430 107C430 113 424 120 418 120C413 120 411 118 405 110C326 11 217 11 205 11C142 11 115 60 115 120C115 161 135 258 169 320C200 377 255 420 310 420C344 420 382 407 396 380C380 380 366 380 352 366C336 351 334 334 334 327C334 303 352 292 371 292C400 292 427 316 427 356C427 405 380 442 309 442C174 442 41 299 41 158C41 68 99-11 203-11C346-11 430 95 430 107Z"></path><path id="MJX-1-MM-N-22C5" d="M192 250C192 279 168 303 139 303C110 303 86 279 86 250C86 221 110 197 139 197C168 197 192 221 192 250Z"></path></defs></svg><mjx-break size="3"></mjx-break><svg style="vertical-align: -0.566ex;" xmlns="http://www.w3.org/2000/svg" width="2.111ex" height="2.262ex" role="img" focusable="false" viewBox="0 -750 933.2 1000" xmlns:xlink="http://www.w3.org/1999/xlink"><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math" data-latex="c \\cdot c"><g data-mml-node="mo" data-latex="\\cdot"><use data-c="22C5" xlink:href="#MJX-1-MM-N-22C5"></use></g><g data-mml-node="mi" data-latex="c" transform="translate(500.2,0)"><use data-c="1D450" xlink:href="#MJX-1-MM-I-1D450"></use></g></g></g></svg></mjx-container>',
                ]);
                expect(log).not.toHaveBeenCalled();
            });
        });

        describe('processor', () => {
            fixture();
            it('is object', async () => {
                const handler = await MathHandler.create('mathjax');
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configure()', () => {
            fixture();
            it('is a function', async () => {
                const handler = await MathHandler.create('mathjax');
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                const handler = await MathHandler.create('mathjax');
                await handler.configure({ outputFormat: 'svg' });
                expect((await handler.process('x')).processed).oneOf([
                    xSvg,
                    xSvgV4,
                ]);
                expect(log).not.toHaveBeenCalled();
            });

            it('works with some base cases', async () => {
                const handler = await MathHandler.create('mathjax');
                await handler.configure({ outputFormat: 'svg' });
                expect(handler.configuration.outputFormat).toEqual('svg');
                await handler.configure({ outputFormat: 'chtml' });
                expect(handler.configuration.outputFormat).toEqual('chtml');
                await handler.configure({});
                expect(handler.configuration.outputFormat).toEqual('chtml');
                await handler.configure({ outputFormat: undefined });
                expect(handler.configuration.outputFormat).toEqual('chtml');
                expect(log).not.toHaveBeenCalled();
            });
        });

        describe('error handling during stylesheet generation', () => {
            it.skip("should silently log error if there's a problem writing stylesheet", async () => {
                const id = uuid();
                // `log` mock is not enough here, since `runWithSpinner` is
                // defined in the same file as `log` (`src/utils/debug.ts`),
                // i.e., it doesn't `import` `log`, and so it doesn't use the
                // mock. At least I think that's what's going on --- on the
                // other hand, `consoles` is also defined in
                // `src/utils/debug.ts`... I'm guessing that our approach here
                // works because it's actually `console.error` that we're
                // mocking in this case, and because `console.error` is _not_
                // defined in `src/utils/debug.ts`.
                const consoleErrorMock = vi
                    .spyOn(consoles, 'error')
                    .mockImplementation(() => undefined);
                fancyWrite.mockRejectedValueOnce(new Error(id));
                await (await MathHandler.create('mathjax')).process('');
                expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                expect(consoleErrorMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining(id),
                );
                consoleErrorMock.mockRestore();
            });
            it.skip('should gracefully deal with unexpected behavior from MathJax', async () => {
                // `log` mock is not enough here, see previous test for details
                const consoleErrorMock = vi
                    .spyOn(consoles, 'error')
                    .mockImplementation(() => undefined);
                const liteAdaptorClass = (
                    await vi.importActual<
                        typeof import('mathjax-full/js/adaptors/liteAdaptor.js')
                    >('mathjax-full/js/adaptors/liteAdaptor.js')
                ).LiteAdaptor;
                const liteAdaptorMock = vi
                    .spyOn(
                        await import('mathjax-full/js/adaptors/liteAdaptor.js'),
                        'liteAdaptor',
                    )
                    .mockImplementationOnce(() => {
                        const adaptor = new liteAdaptorClass();
                        adaptor.textContent = vi.fn().mockImplementation(() => {
                            throw new Error(
                                'cba98c7d-4d92-44fa-b853-bd8883af8ec5',
                            );
                        });
                        return adaptor;
                    });
                await (await MathHandler.create('mathjax')).process('');
                expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                expect(consoleErrorMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining(
                        'cba98c7d-4d92-44fa-b853-bd8883af8ec5',
                    ),
                );
                liteAdaptorMock.mockRestore();
                consoleErrorMock.mockRestore();
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
