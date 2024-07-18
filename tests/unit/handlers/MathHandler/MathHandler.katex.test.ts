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
import { MathHandler } from '$handlers/MathHandler.js';
import { spy } from '$tests/unit/fixtures.js';
import { v4 as uuid } from 'uuid';
import type { MathConfiguration } from '$types/handlers/Math.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

describe("MathHandler<'katex'>", () => {
    let handler: MathHandler<'katex'>;
    let log: MockInstance;
    let writeFileEnsureDir: MockInstance;
    let fancyWrite: MockInstance;
    let existsSync: MockInstance;
    fixture();
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
            ['writeFileEnsureDir', 'fancyWrite', 'log', 'existsSync', 'mkdir'],
            true,
        );
        writeFileEnsureDir = mocks.writeFileEnsureDir;
        fancyWrite = mocks.fancyWrite;
        log = mocks.log;
        existsSync = mocks.existsSync;
        handler = await MathHandler.create('katex');
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("MathHandler.create('katex')", () => {
        fixture();
        it('returns instance of MathHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
        });

        it('generates CSS', async () => {
            const th = await MathHandler.create('katex', {
                css: { type: 'hybrid' },
            });
            await th.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('font-style'),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS twice", async () => {
            const handler = await MathHandler.create('katex', {
                css: { type: 'hybrid' },
            });
            await handler.process('');
            await handler.process('');
            expect(fancyWrite).toHaveBeenCalledTimes(1);
            expect(fancyWrite).toHaveBeenNthCalledWith(
                1,
                expect.stringMatching(
                    /sveltex\/katex@\d+\.\d+\.\d+.*\.min\.css/,
                ),
                expect.stringContaining('font-style'),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if the file already exists", async () => {
            existsSync.mockReturnValueOnce(true);
            const th = await MathHandler.create('katex', {
                css: { type: 'hybrid' },
            });
            await th.process('');
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });

        it("doesn't generate CSS if `configuration.css.type` is 'none'", async () => {
            existsSync.mockReturnValueOnce(true);
            const handler = await MathHandler.create('katex', {
                css: { type: 'none' },
            });
            await handler.process('');
            expect(writeFileEnsureDir).not.toHaveBeenCalled();
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('mathHandler', () => {
        fixture();
        describe('process()', () => {
            fixture();
            describe('should work with different configurations', () => {
                it.each([
                    [{}],
                    [{ css: { cdn: 'jsdelivr' } }],
                    [{ css: { cdn: ['jsdelivr'] } }],
                    [{ css: { type: 'hybrid', cdn: 'jsdelivr' } }],
                    [{ css: { type: 'hybrid', cdn: ['jsdelivr'] } }],

                    [
                        { katex: { output: 'html' } },
                        '<span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span>',
                    ],
                    [
                        { katex: { output: 'mathml' } },
                        '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span>',
                    ],
                    [{ katex: { output: 'htmlAndMathml' } }],
                ] as [MathConfiguration<'katex'>?, (string | RegExp)?][])(
                    '%o',
                    async (config, expected) => {
                        const handler = await MathHandler.create(
                            'katex',
                            config,
                        );
                        expect((await handler.process('x')).processed).toMatch(
                            expected ??
                                '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span>',
                        );
                        expect(log).not.toHaveBeenCalled();
                    },
                );
            });

            it('should work for basic inline math', async () => {
                expect((await handler.process('x')).processed).toEqual(
                    '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });

            it('should work for basic display math', async () => {
                expect(
                    (await handler.process('x', { inline: false })).processed,
                ).toEqual(
                    '<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });

            it('should skip math if math config is invalid', async () => {
                const handler = await MathHandler.create('katex', {
                    transformers: {
                        pre: 'invalid' as unknown as [string, string],
                    },
                });
                expect(
                    (await handler.process('a{b}c', { inline: false }))
                        .processed,
                ).toEqual('a&lbrace;b&rbrace;c');
                expect(log).toHaveBeenCalled();
            });

            it('should support CSS color variables', async () => {
                expect(
                    (
                        await handler.process('\\color{var(--red)}x', {
                            inline: false,
                        })
                    ).processed,
                ).toEqual(
                    '<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mstyle mathcolor="var(--red)"><mi>x</mi></mstyle></mrow><annotation encoding="application/x-tex">\\color&lbrace;var(--red)&rbrace;x</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal" style="color:var(--red);">x</span></span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });

            it('should support transformers', async () => {
                const handler = await MathHandler.create('katex', {
                    transformers: {
                        pre: [
                            [/\*/g, '\\cdot'],
                            ['a', 'b'],
                            ['b', 'c'],
                        ],
                        post: [[/ xmlns:xlink=".*?"/g, '']],
                    },
                });
                expect(
                    (await handler.process('a * b', { inline: true }))
                        .processed,
                ).toEqual(
                    '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>c</mi><mo>⋅</mo><mi>c</mi></mrow><annotation encoding="application/x-tex">c \\cdot c</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4445em;"></span><span class="mord mathnormal">c</span><span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">⋅</span><span class="mspace" style="margin-right:0.2222em;"></span></span><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">c</span></span></span></span>',
                );
                expect(log).not.toHaveBeenCalled();
            });
        });
    });
});
