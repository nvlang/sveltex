import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { TexHandler } from '$handlers/TexHandler.js';
import { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import { spy } from '$tests/fixtures.js';
import { v4 as uuid } from 'uuid';
import { consoles } from '$utils/debug.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

suite("TexHandler<'mathjax'>", async () => {
    fixture();
    const { writeFile, fancyWrite, log, existsSync } = await spy(
        ['writeFile', 'fancyWrite', 'mkdir', 'log', 'existsSync'],
        true,
    );

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("TexHandler.create('mathjax')", () => {
        fixture();
        it('returns instance of TexHandler', async () => {
            const handler = await TexHandler.create('mathjax');
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
            expect(log).not.toHaveBeenCalled();
        });

        it('generates CSS', async () => {
            await (await TexHandler.create('mathjax')).process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/,
                ),
                expect.stringContaining('[jax='),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            // existsSync.mockReturnValueOnce(true);
            const handler = await TexHandler.create('mathjax');
            await handler.process('');
            await handler.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/mathjax@\d+\.\d+\.\d+.*\.svg\.min\.css/,
                ),
                expect.stringContaining('[jax='),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if the file already exists", async () => {
            existsSync.mockReturnValueOnce(true);
            await (await TexHandler.create('mathjax')).process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if `configuration.css.type` is `'none'`", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await TexHandler.create('mathjax');
            await handler.configure({ css: { type: 'none' } });
            await handler.process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('texHandler', () => {
        fixture();
        const xSvg =
            '<mjx-container class="MathJax" jax="SVG"><svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-1-TEX-I-1D465"></use></g></g></g></svg></mjx-container>';
        const xChtml =
            '<mjx-container class="MathJax" jax="CHTML"><mjx-math class=" MJX-TEX"><mjx-mi class="mjx-i"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi></mjx-math></mjx-container>';

        describe('process()', () => {
            fixture();
            it('should work, and output SVG by default', async () => {
                const handler = await TexHandler.create('mathjax');
                expect(await handler.process('x')).toEqual(xSvg);
                expect(log).not.toHaveBeenCalled();
            });

            it('should be able to output CHTML', async () => {
                const handler = await TexHandler.create('mathjax');
                await handler.configure({ outputFormat: 'chtml' });
                expect(await handler.process('x')).toEqual(xChtml);
                await handler.configure({ outputFormat: 'svg' });
                expect(log).not.toHaveBeenCalled();
            });

            it('should throw error if MathJax did not return a valid node', async () => {
                const handler = await TexHandler.create('mathjax');
                handler.processor = {
                    convert: () => null,
                } as unknown as MathDocument<unknown, unknown, unknown>;
                await expect(
                    async () => await handler.process('abcde'),
                ).rejects.toThrowError(
                    'MathJax did not return a valid node (result: null).',
                );
                expect(log).not.toHaveBeenCalled();
            });
        });

        describe('processor', () => {
            fixture();
            it('is object', async () => {
                const handler = await TexHandler.create('mathjax');
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configure()', () => {
            fixture();
            it('is a function', async () => {
                const handler = await TexHandler.create('mathjax');
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                const handler = await TexHandler.create('mathjax');
                await handler.configure({ outputFormat: 'svg' });
                expect(await handler.process('x')).toEqual(xSvg);
                expect(log).not.toHaveBeenCalled();
            });

            it('works with some base cases', async () => {
                const handler = await TexHandler.create('mathjax');
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
            it("should silently log error if mathjax-full version can't be fetched from mathjax-full/package.json", async () => {
                const id = uuid();
                const versionMock = vi.spyOn(
                    (await import('mathjax-full/package.json')).default,
                    'version',
                    'get',
                );
                versionMock.mockImplementationOnce(() => {
                    throw new Error(id);
                });
                await (await TexHandler.create('mathjax')).process('');
                expect(log).toHaveBeenCalledTimes(1);
                expect(log).toHaveBeenNthCalledWith(
                    1,
                    'error',
                    expect.stringContaining(id),
                );
                versionMock.mockRestore();
            });
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
                await (await TexHandler.create('mathjax')).process('');
                expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                expect(consoleErrorMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining(id),
                );
                consoleErrorMock.mockRestore();
            });
            it('should gracefully deal with unexpected behavior from MathJax', async () => {
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
                await (await TexHandler.create('mathjax')).process('');
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
            const handler = await TexHandler.create('mathjax');
            const serialized = JSON.stringify(handler);
            expect(serialized).toBeTypeOf('string');
            expect(serialized).not.toBeNull();
            expect(log).not.toHaveBeenCalled();
        });
    });
});
