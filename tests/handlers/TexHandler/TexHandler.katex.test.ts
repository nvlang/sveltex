/* eslint-disable vitest/no-commented-out-tests */
import {
    suite,
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
} from 'vitest';
import { TexHandler } from '$handlers/TexHandler.js';
import { spy } from '$tests/fixtures.js';
import { v4 as uuid } from 'uuid';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

suite("TexHandler<'katex'>", async () => {
    fixture();
    const { writeFileEnsureDir, fancyWrite, log, existsSync } = await spy(
        ['writeFileEnsureDir', 'fancyWrite', 'log', 'existsSync', 'mkdir'],
        true,
    );
    const handler = await TexHandler.create('katex');
    beforeAll(async () => {
        vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default);
    });
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
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(61);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('fonts/KaTeX'),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            const handler = await TexHandler.create('katex');
            await handler.configure({ css: { type: 'self-hosted' } });
            await handler.process('');
            await handler.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(61);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /src\/sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('fonts/KaTeX'),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if the file already exists", async () => {
            existsSync.mockReturnValueOnce(true);
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if `configuration.css.type` is 'none'", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await TexHandler.create('katex');
            await handler.configure({ css: { type: 'none' } });
            await handler.process('');
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
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

            it('should support transformations', async () => {
                await handler.configure({
                    transformations: {
                        pre: [
                            [/\*/g, '\\cdot'],
                            ['a', 'b'],
                            ['b', 'c'],
                        ],
                        post: [[/ xmlns:xlink=".*?"/g, '']],
                    },
                });
                expect(await handler.process('$a * b$')).toEqual(
                    '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>c</mi><mo>⋅</mo><mi>c</mi></mrow><annotation encoding="application/x-tex">c \\cdot c</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4445em;"></span><span class="mord mathnormal">c</span><span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">⋅</span><span class="mspace" style="margin-right:0.2222em;"></span></span><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">c</span></span></span></span>',
                );
                await handler.configure({
                    transformations: null,
                });
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
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
            versionMock.mockRestore();
        });
        it.skip("should silently log error if there's a problem writing stylesheet", async () => {
            fancyWrite.mockRestore();
            const id = uuid();
            writeFileEnsureDir.mockImplementationOnce(() => {
                throw new Error(id);
            });
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
        });
        it.skip("should silently log error if there's a problem writing fonts", async () => {
            fancyWrite.mockReset();
            const id = uuid();
            writeFileEnsureDir
                .mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => {
                    throw new Error(id);
                });
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
        });
    });
});
