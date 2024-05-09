/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { TexHandler } from '$handlers';
import { spy } from '$tests/fixtures.js';
import { v4 as uuid } from 'uuid';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

suite("TexHandler<'katex'>", async () => {
    fixture();
    const { writeFile, log, existsSync } = await spy(
        ['writeFile', 'log', 'existsSync', 'mkdir'],
        true,
    );
    const handler = await TexHandler.create('katex');
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("TexHandler.create('katex')", () => {
        fixture();
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });

        it('generates CSS', async () => {
            await (await TexHandler.create('katex')).process('');
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('fonts/KaTeX'),
                'utf8',
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await TexHandler.create('katex');
            await handler.process('');
            await handler.process('');
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('fonts/KaTeX'),
                'utf8',
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if the file already exists", async () => {
            existsSync.mockReturnValueOnce(true);
            await (await TexHandler.create('katex')).process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if `configuration.css.write` is false", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await TexHandler.create('katex');
            await handler.configure({ css: { write: false } });
            await handler.process('');
            expect(writeFile).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('texHandler', () => {
        fixture();
        describe('process()', () => {
            fixture();
            it('should work for basic inline math', async () => {
                expect(await handler.process('$x$')).toEqual(
                    '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });

            it('should work for basic display math', async () => {
                expect(await handler.process('$$x$$')).toEqual(
                    '<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });
        });

        describe('processor', () => {
            fixture();
            it('should equal {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configure()', () => {
            fixture();
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                await handler.configure({ katex: { output: 'mathml' } });
                expect(await handler.process('$x$')).toEqual(
                    '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span>',
                );
                await handler.configure({ katex: { output: 'html' } });
                expect(log).not.toHaveBeenCalled();
            });
        });
    });

    describe('error handling', () => {
        fixture();
        it("should silently log error if katex version can't be fetched from katex/package.json", async () => {
            const id = uuid();
            const versionMock = vi.spyOn(
                (await import('katex/package.json')).default,
                'version',
                'get',
            );
            versionMock.mockImplementationOnce(() => {
                throw new Error(id);
            });
            await (await TexHandler.create('katex')).process('');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
            versionMock.mockRestore();
        });
        it("should silently log error if there's a problem writing stylesheet", async () => {
            const id = uuid();
            writeFile.mockImplementationOnce(() => {
                throw new Error(id);
            });
            await (await TexHandler.create('katex')).process('');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
        });
    });
});
