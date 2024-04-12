/* eslint-disable vitest/valid-describe-callback */
import {
    suite,
    describe,
    it,
    expect,
    vi,
    afterEach,
    beforeEach,
    type MockInstance,
} from 'vitest';
import { sveltex } from '$processor';
import { AdvancedTexHandler, createAdvancedTexHandler } from '$handlers';
import { readFileSync } from 'fs';

// let writeFileSyncCallStack: [string, string, string][] = [];
// vi.mock('node:fs', async (orig: () => Promise<typeof import('node:fs')>) => ({
//     __esModule: true,
//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
//     ...(await orig()),
//     writeFileSync: vi
//         .fn()
//         .mockImplementation(
//             async (path: string, content: string, encoding: string) => {
//                 writeFileSyncCallStack.push([path, content, encoding]);
//                 (await orig()).writeFileSync(path, content);
//             },
//         ),
//     // readFileSync: vi.fn().mockImplementation((path: string) => {
//     //     if (!path.match(/\.(svg|pdf|dvi|tex)$/)) return '{}';
//     //     const ans = writeFileSyncCallStack.find((v) => v[0] === path);
//     //     return ans ? ans[1] : '';
//     // }),
// }));

// vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe.each([
    {
        handler: await createAdvancedTexHandler('custom', {
            process: () => 'output',
            configure: () => {
                return;
            },
        }),
    },
])("AdvancedTexHandler<'custom'>", ({ handler }) => {
    it('should work', async () => {
        expect(
            await handler.process('input', { filename: 'test.sveltex' }),
        ).toEqual('output');
    });
});

let spawnCliInstructionMock: MockInstance;

suite.each([
    {
        handler: (
            await (
                await sveltex('none', 'none', 'none', 'local')
            ).configure({
                advancedTex: {
                    engine: 'lualatex',
                    caching: false,
                    components: {
                        tex: {
                            overrides: {
                                caching: false,
                            },
                        },
                        Example: { aliases: ['ExampleAlias'] },
                    },
                },
            })
        ).advancedTexHandler,
    },
])("AdvancedTexHandler<'local'>", async ({ handler }) => {
    beforeEach(async () => {
        spawnCliInstructionMock = vi.spyOn(
            await import('$utils/cli.js'),
            'spawnCliInstruction',
        );
    });
    afterEach(() => {
        // writeFileSyncCallStack = [];
        spawnCliInstructionMock.mockRestore();
    });

    describe.concurrent('backendIs()', () => {
        it('should return true if this.backend is equal to input', () => {
            expect(handler.backendIs('local')).toEqual(true);
            expect(handler.backendIs('custom')).toEqual(false);
            expect(handler.backendIs('none')).toEqual(false);
        });
    });

    describe.concurrent('configure()', () => {
        it('should return true if this.backend is equal to input', async () => {
            const ath = await createAdvancedTexHandler('local');
            expect(ath.configuration.components).toEqual({});
            await ath.configure({});
            expect(ath.configuration.components).toEqual({});
        });
    });

    describe.concurrent('constructor', () => {
        it('returns instance of AdvancedTexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(AdvancedTexHandler);
        });
    });

    describe.each([
        { handler },
        {
            handler: (
                await (
                    await sveltex('none', 'none', 'none', 'local')
                ).configure({
                    advancedTex: {
                        engine: 'lualatex',
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        components: undefined!,
                    },
                })
            ).advancedTexHandler,
        },
    ])('configure', ({ handler }) => {
        it.each([
            { components: undefined },
            { components: {} },
            { components: { newComponent1: {} } },
            {
                components: { newComponent2: {}, newComponent3: {} },
            },
        ])(
            'appends new tex components to current array of tex components',
            async ({ components }) => {
                const origComponents = { ...handler.configuration.components };
                expect(origComponents).toEqual(
                    handler.configuration.components,
                );
                await handler.configure({ components });
                expect(handler.configuration.components).toEqual({
                    ...origComponents,
                    ...components,
                });
                handler.configuration.components = origComponents;
            },
        );
    });

    describe.concurrent('process', () => {
        it('supports aliases', async () => {
            // console.log('handler', handler);
            expect(
                await handler.process(
                    "AdvancedTexHandler<'local'> > process > supports aliases",
                    {
                        name: 'ExampleAlias',
                        ref: 'ref',
                        filename: 'test.sveltex',
                    },
                ),
            ).toEqual(
                '<figure id="DV3aNaSmLATeQdIwic3HIGAfBvyf00UyGTyabPPKP7k"></figure>',
            );
        });

        it('uses name "unknown" if provided name was not found', async () => {
            expect(
                await handler.process(
                    'uses name "unknown" if provided name was not found',
                    {
                        name: 'SomeNameThatIsNotInComponents',
                        ref: 'ref',
                        filename: 'test.sveltex',
                    },
                ),
            ).toEqual(
                '<figure id="WkQKFfInumnfQ5KRnHKaA1Fwob9rfAzQrtOdMtSG9Ws"></figure>',
            );
        });

        it('uses name "unknown" if no name was provided', async () => {
            expect(
                await handler.process(
                    'uses name "unknown" if no name was provided',
                    {
                        ref: 'ref',
                        filename: 'test.sveltex',
                    },
                ),
            ).toEqual(
                '<figure id="5_6t94bWJGPhfujFFBlRD2XZyi3Jqulm9HufYNZMBjI"></figure>',
            );
        });
    });

    describe('advancedTexHandler', () => {
        it('css variables', async () => {
            await handler.configure({
                dvisvgmOptions: {
                    svg: {
                        fontFormat: 'woff2',
                    },
                    customArgs: ['--stdout'],
                },
            });
            expect(
                await handler.process(
                    '\\textcolor{var(--some-css-variable)}{$x$}',
                    {
                        attributes: {},
                        ref: 'ath-something-test-348902',
                        name: 'tex',
                        filename: 'test.sveltex',
                    },
                ),
            ).toEqual(
                '<figure id="MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to"></figure>',
            );
            expect(
                readFileSync(
                    'node_modules/.cache/sveltex-preprocess/tex/MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to.tex',
                ).toString(),
            ).toEqual(
                '\\documentclass{standalone}\n' +
                    '\\usepackage{xcolor}\n' +
                    '\\definecolor{sveltex1d611c}{HTML}{1d611c}\n' +
                    '\\usepackage{microtype}\n' +
                    '\\begin{document}\n' +
                    '\\textcolor{sveltex1d611c}{$x$}\n' +
                    '\\end{document}',
            );

            expect(
                readFileSync(
                    'static/sveltex/tex/ath-something-test-348902.svg',
                ).toString(),
            ).toEqual(
                `<?xml version='1.0' encoding='UTF-8'?>\n<!-- This file was generated by dvisvgm 3.2.2 -->\n<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='5.694pt' height='4.289pt' viewBox='0 0 5.694 4.289'>\n<style type='text/css'>\n<![CDATA[@font-face{font-family:MHOLNP-CMMI10;src:url(data:application/x-font-woff2;base64,d09GMgABAAAAAAJ4AAoAAAAABGQAAAIuAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANAqCEIFrCwYAATYCJAMIBCAFgmgHIBuIA0AehY0ziVjkzVvEnSNR8VC/3+/sfhfUspVCiK+h1SSRAkNPpMA92N9778sz0CAkAKxbaFR5svt8N/m/A7+Api2kxLOtbaBL48AWRRptHEsxYM/ctW3ykmjYLi8lPzfU8hApAyz5gzr+Z1Va/VgkzoMIbcIFSneviUGA89WvBgWoiajN8g+QqGGe3sxh7AJ1dYGvUmz1Px8fJUoUK+AerMLviSrIVbAO0oa3bz1qyWzVkKZYx7nkOnPCXSU5ZFpwwt84KlHYndYnWs0mNnspcHuLWBDtuXKtYmevYU9XaZRZ9ei9Vmq81Ojd56ubmxlA0gcletjFt2RZh9xUhQu3VBk8tRlOmtz2ZOqVEYH1rPOhxAh99tDMNTLGIlrGRLx7opRKL4l8PgqNpVZ5Q7hj2bmtod1Rg9eBp83bCMd63sFINUJHG/EZZrpPrP2KD3W8Ramsqy6E+1MWTytrAAgEvxql51503VcCug7+ZKRbRxtQXpMX2UFbwg3WFCAvgZ+cXwcIoIdM6BGkCtISWtb1zRiRYHUDI2UNPZszvmngZLtrnSq0qHeEbfbE160L5xuWcvimdU1514WZA21+13ndztLB1t5RzsTOzkpJ8aLcVZJX9JSeP4f8E0PiEoMiBFXklftjMBElQrQE8QLEEmQnir8g8rklB7bsOZJjwo4dK0oUucd8NU6IKJEEKZGniICFFYmyfPaCf+Arxcr9JQoRNxckgiAV8pSziAZDAAA=) format('woff2');}\ntext.f0 {font-family:MHOLNP-CMMI10;font-size:9.96px}\n]]>\n</style>\n<g id='page1'>\n<text class='f0' x='0' y='0' transform='matrix(.999735 0 0 .999735 0 4.289)'><tspan fill='var(--some-css-variable)'>x</tspan></text>\n</g>\n</svg>`,
            );

            // expect(writeFileSyncCallStack.length).toEqual(2);
            // expect(writeFileSyncCallStack[0]).toEqual([
            //     'node_modules/.cache/sveltex-preprocess/tex/MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to.tex',
            //     '\\documentclass{standalone}\n' +
            //         '\\usepackage{xcolor}\n' +
            //         '\\definecolor{sveltex1d611c}{HTML}{1d611c}\n' +
            //         '\\usepackage{microtype}\n' +
            //         '\\begin{document}\n' +
            //         '\\textcolor{sveltex1d611c}{$x$}\n' +
            //         '\\end{document}',
            //     'utf8',
            // ]);
            // expect(writeFileSyncCallStack[1]).toEqual([
            //     'static/sveltex/tex/ath-something-test-348902.svg',
            //     `<?xml version='1.0' encoding='UTF-8'?>\n<!-- This file was generated by dvisvgm 3.2.2 -->\n<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='5.694pt' height='4.289pt' viewBox='0 0 5.694 4.289'>\n<style type='text/css'>\n<![CDATA[@font-face{font-family:MHOLNP-CMMI10;src:url(data:application/x-font-woff2;base64,d09GMgABAAAAAAJ4AAoAAAAABGQAAAIuAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANAqCEIFrCwYAATYCJAMIBCAFgmgHIBuIA0AehY0ziVjkzVvEnSNR8VC/3+/sfhfUspVCiK+h1SSRAkNPpMA92N9778sz0CAkAKxbaFR5svt8N/m/A7+Api2kxLOtbaBL48AWRRptHEsxYM/ctW3ykmjYLi8lPzfU8hApAyz5gzr+Z1Va/VgkzoMIbcIFSneviUGA89WvBgWoiajN8g+QqGGe3sxh7AJ1dYGvUmz1Px8fJUoUK+AerMLviSrIVbAO0oa3bz1qyWzVkKZYx7nkOnPCXSU5ZFpwwt84KlHYndYnWs0mNnspcHuLWBDtuXKtYmevYU9XaZRZ9ei9Vmq81Ojd56ubmxlA0gcletjFt2RZh9xUhQu3VBk8tRlOmtz2ZOqVEYH1rPOhxAh99tDMNTLGIlrGRLx7opRKL4l8PgqNpVZ5Q7hj2bmtod1Rg9eBp83bCMd63sFINUJHG/EZZrpPrP2KD3W8Ramsqy6E+1MWTytrAAgEvxql51503VcCug7+ZKRbRxtQXpMX2UFbwg3WFCAvgZ+cXwcIoIdM6BGkCtISWtb1zRiRYHUDI2UNPZszvmngZLtrnSq0qHeEbfbE160L5xuWcvimdU1514WZA21+13ndztLB1t5RzsTOzkpJ8aLcVZJX9JSeP4f8E0PiEoMiBFXklftjMBElQrQE8QLEEmQnir8g8rklB7bsOZJjwo4dK0oUucd8NU6IKJEEKZGniICFFYmyfPaCf+Arxcr9JQoRNxckgiAV8pSziAZDAAA=) format('woff2');}\ntext.f0 {font-family:MHOLNP-CMMI10;font-size:9.96px}\n]]>\n</style>\n<g id='page1'>\n<text class='f0' x='0' y='0' transform='matrix(.999735 0 0 .999735 0 4.289)'><tspan fill='var(--some-css-variable)'>x</tspan></text>\n</g>\n</svg>`,
            //     undefined,
            // ]);
            expect(spawnCliInstructionMock).toHaveBeenCalledTimes(2);
            expect(spawnCliInstructionMock).toHaveBeenNthCalledWith(1, {
                args: [
                    '--output-format=pdf',
                    '--no-shell-escape',
                    '--interaction=nonstopmode',
                    '"MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to.tex"',
                ],
                command: 'lualatex',
                cwd: 'node_modules/.cache/sveltex-preprocess/tex',
                env: {
                    FILENAME: 'MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to.tex',
                    FILENAME_BASE:
                        'MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to',
                    FILEPATH:
                        'node_modules/.cache/sveltex-preprocess/tex/MlVEjUFNpso2WfT7aWd4FMxn6n2S2I-UdVU6XU0j8to.tex',
                    OUTDIR: 'node_modules/.cache/sveltex-preprocess/tex',
                    OUTFILETYPE: 'pdf',
                },
                silent: true,
            });
        });
    });
});

describe.concurrent('createAdvancedTexHandler', () => {
    it('edge cases', async () => {
        // vi.mock('node:fs', () => ({
        //     existsSync: vi.fn().mockReturnValue(true),
        // }));
        const ath = await createAdvancedTexHandler('local');
        expect(await ath.process('', { filename: 'test.sveltex' })).toEqual('');
        // expect(await ath.process('x')).toEqual(
        //     '<img alt="2azgFtbWfieP3uQaD41I2wi1B7Ckn12JcHetlahfjRo.svg" src="sveltex/unknown/2azgFtbWfieP3uQaD41I2wi1B7Ckn12JcHetlahfjRo.svg">',
        // );
        // vi.unmock('node:fs');
    });

    it("should require custom param if backend is 'custom'", async () => {
        await expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            createAdvancedTexHandler('custom', undefined!),
        ).rejects.toThrowError('');
    });

    it('should accept noncustom backend', async () => {
        const handler = await createAdvancedTexHandler('none');
        expect(handler).toBeTypeOf('object');
        expect(handler).not.toBeNull();
        expect(handler).toBeInstanceOf(AdvancedTexHandler);
        expect(
            handler.process('ath-something-test-908423', {
                filename: 'test.sveltex',
            }),
        ).toEqual('ath-something-test-908423');
    });

    it("should set `configure` to noop by default if backend is 'custom'", async () => {
        const handler = await createAdvancedTexHandler('custom', {
            process: () => 'output',
        });
        expect(handler.configure).toBeTypeOf('function');
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(await handler.configure({})).toBeUndefined();
    });

    it('should support all expected params', async () => {
        const handler = await createAdvancedTexHandler('custom', {
            process: () => 'custom process',
            configuration: {},
            configure: () => {
                return;
            },
            processor: {},
        });
        expect(handler.configuration).toEqual({});
        expect(handler.configure).toBeTypeOf('function');
        expect(handler.processor).toEqual({});
        expect(handler.process).toBeTypeOf('function');
        expect(
            await handler.process('input', { filename: 'test.sveltex' }),
        ).toEqual('custom process');
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(await handler.configure({})).toBeUndefined();
    });
});
