import { AdvancedTexHandler } from '$handlers';
import { sveltex } from '$sveltex-preprocess';
import { spy } from '$tests/fixtures.js';
import { pathExists } from '$utils/debug.js';

import { resolve } from 'node:path';
import { rimraf } from 'rimraf';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
} from 'vitest';

describe.each([
    await AdvancedTexHandler.create('custom', {
        process: () => 'output',
        configure: () => {
            return;
        },
    }),
])("AdvancedTexHandler<'custom'>", (handler) => {
    it('should work', async () => {
        expect(
            await handler.process('input', {
                tag: '',
                attributes: { ref: '' },
                selfClosing: false,
                filename: 'test.sveltex',
            }),
        ).toEqual('output');
    });
});

async function handlers() {
    const ath = await AdvancedTexHandler.create('local');
    await ath.configure({
        engine: 'lualatex',
        caching: false,
        cacheDirectory: 'tmp/tests/cache',
        outputDirectory: 'tmp/tests/output',
        components: {
            tex: {},
            Example: { aliases: ['ExampleAlias'] },
        },
        dvisvgmOptions: {
            svg: {
                fontFormat: 'woff2',
            },
        },
    });
    return [ath];
}

async function setup(handler?: AdvancedTexHandler<'local'>) {
    if (handler) {
        handler.cache.data.int = {};
        handler.cache.data.svg = {};
    }
    if (pathExists('tmp/tests')) await rimraf(resolve('tmp/tests'));
    vi.clearAllMocks();
}

async function teardown() {
    if (pathExists('tmp/tests')) await rimraf(resolve('tmp/tests'));
    vi.clearAllMocks();
}

function fixture(handler?: AdvancedTexHandler<'local'>) {
    beforeEach(async () => {
        await setup(handler);
    });
    afterEach(async () => {
        await teardown();
    });
}

suite("AdvancedTexHandler<'local'>", async () => {
    vi.restoreAllMocks();
    afterAll(() => {
        vi.restoreAllMocks();
    });
    fixture();
    const { writeFile, log, spawnCliInstruction } = await spy(
        ['writeFile', 'log', 'spawnCliInstruction'],
        false,
    );
    // writeFile.mockImplementation(
    //     async (path: string, data: string, opts: ObjectEncodingOptions) => {
    //         if (path.endsWith('cache.json')) {
    //             return;
    //         }
    //         await writeFileOrig(path, data, opts);
    //     },
    // );

    describe.each(await handlers())('backendIs()', (handler) => {
        it('should return true iff this.backend is equal to input', () => {
            expect(handler.backendIs('local')).toEqual(true);
            expect(handler.backendIs('custom')).toEqual(false);
            expect(handler.backendIs('none')).toEqual(false);
        });
    });

    describe.each(await handlers())('backendIsNot()', (handler) => {
        it('should return true iff this.backend is not equal to input', () => {
            expect(handler.backendIsNot('local')).toEqual(false);
            expect(handler.backendIsNot('custom')).toEqual(true);
            expect(handler.backendIsNot('none')).toEqual(true);
        });
    });

    describe('configure()', () => {
        it('should return true if this.backend is equal to input', async () => {
            const ath = await AdvancedTexHandler.create('local');
            expect(ath.configuration.components).toEqual({});
            await ath.configure({});
            expect(ath.configuration.components).toEqual({});
        });
    });

    describe.each([
        ...(await handlers()),
        await (async () => {
            const s = await sveltex({
                markdownBackend: 'none',
                codeBackend: 'none',
                texBackend: 'none',
                advancedTexBackend: 'local',
            });
            await s.configure({
                advancedTex: {
                    engine: 'lualatex',
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    components: undefined!,
                },
            });
            return s.advancedTexHandler;
        })(),
    ])('configure', (handler) => {
        afterEach(async () => {
            await handler.configure({ components: null });
        });

        it('`configure({components: null})` sets `configuration.components` to `{}`', async () => {
            await handler.configure({ components: { something: {} } });
            expect(handler.configuration.components).not.toEqual({});
            await handler.configure({ components: null });
            expect(handler.configuration.components).toEqual({});
            expect(handler.tccAliases).toEqual([]);
            expect(handler.tccNames).toEqual([]);
            expect(handler.tccMap.size).toEqual(0);
        });

        it('complains about conflicting tex component names', async () => {
            await handler.configure({
                components: {
                    tex: {},
                    tex2: { aliases: ['tex'] },
                },
            });
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Duplicate advanced TeX component name/alias "tex".',
            );
        });

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
                const origComponents = {
                    ...handler.configuration.components,
                };
                expect(origComponents).toEqual(
                    handler.configuration.components,
                );
                await handler.configure({ components });
                expect(handler.configuration.components).toEqual({
                    ...origComponents,
                    ...components,
                });
            },
        );
    });

    describe.each(await handlers())(
        'advancedTexHandler.noteTcInFile',
        (handler) => {
            it('should work', () => {
                // initializes for file
                handler.noteTcInFile('test1.sveltex', {
                    id: 'Sveltex__tex__ref',
                    path: 'src/sveltex/tex/ref.svelte',
                });
                expect(handler.texComponents).toEqual({
                    'test1.sveltex': [
                        {
                            id: 'Sveltex__tex__ref',
                            path: 'src/sveltex/tex/ref.svelte',
                        },
                    ],
                });
                // deals with duplicates
                handler.noteTcInFile('test1.sveltex', {
                    id: 'Sveltex__tex__ref',
                    path: 'src/sveltex/tex/ref.svelte',
                });
                expect(handler.texComponents).toEqual({
                    'test1.sveltex': [
                        {
                            id: 'Sveltex__tex__ref',
                            path: 'src/sveltex/tex/ref.svelte',
                        },
                    ],
                });
                // adds to existing file
                handler.noteTcInFile('test1.sveltex', {
                    id: 'Sveltex__tex__ref2',
                    path: 'src/sveltex/tex/ref2.svelte',
                });
                expect(handler.texComponents).toEqual({
                    'test1.sveltex': [
                        {
                            id: 'Sveltex__tex__ref',
                            path: 'src/sveltex/tex/ref.svelte',
                        },
                        {
                            id: 'Sveltex__tex__ref2',
                            path: 'src/sveltex/tex/ref2.svelte',
                        },
                    ],
                });
            });
        },
    );

    describe.sequential.each(await handlers())(
        'advancedTexHandler.process',
        (handler) => {
            fixture(handler);
            it('should work with self-closing components', async () => {
                expect(
                    await handler.process('x', {
                        tag: 'ExampleAlias',
                        attributes: { ref: 'ref' },
                        selfClosing: true,
                        filename: 'test.sveltex',
                    }),
                ).toEqual(
                    '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
                );
                expect(writeFile).not.toHaveBeenCalled();
                expect(spawnCliInstruction).not.toHaveBeenCalled();
            });

            it('supports aliases', async () => {
                expect(
                    await handler.process('x', {
                        tag: 'ExampleAlias',
                        attributes: { ref: 'ref' },
                        selfClosing: false,
                        filename: 'test.sveltex',
                    }),
                ).toEqual(
                    '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
                );
                expect(writeFile).toHaveBeenCalledTimes(3);
                expect(writeFile).toHaveBeenNthCalledWith(
                    1,
                    'tmp/tests/cache/Example/ref/root.tex',
                    '\\documentclass{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\\begin{document}\nx\n\\end{document}\n',
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    2,
                    'tmp/tests/output/Example/ref.svg',
                    expect.stringContaining(
                        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="5.26pt" height="4.294pt" viewBox="0 0 5.26 4.294"><style><![CDATA[@font-face{font-family:XWTZSC-LMRoman10-Regular;src:url(data:application/x-font-woff2;base64',
                    ),
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    2,
                    'tmp/tests/output/Example/ref.svg',
                    expect.stringContaining(
                        ' format(\'woff2\');}\ntext.f0 {font-family:XWTZSC-LMRoman10-Regular;font-size:9.96px}\n]]></style><g id="page1"><text class="f0" x="-0.258931" transform="translate(0 4.294)scale(.999735)" fill="currentColor">x</text></g></svg>',
                    ),
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    3,
                    'tmp/tests/cache/cache.json',
                    '{"int":{"Example/ref":{"sourceHash":"u9Edso_qywe0Xxw5JvIcospMYE66P8YD7POaR4ZXj74","hash":"atS7849_Z15VVOHbSpqfhZgZeDd7DPOJNMtwFWPUNPM"}},"svg":{"Example/ref":{"sourceHash":"atS7849_Z15VVOHbSpqfhZgZeDd7DPOJNMtwFWPUNPM"}}}',
                    'utf8',
                );
                expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
                expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                    args: [
                        '--output-format=pdf',
                        '--no-shell-escape',
                        '--interaction=nonstopmode',
                        '"root.tex"',
                    ],
                    command: 'lualatex',
                    cwd: 'tmp/tests/cache/Example/ref',
                    env: {
                        FILENAME: 'root.tex',
                        FILENAME_BASE: 'root',
                        FILEPATH: 'tmp/tests/cache/Example/ref/root.tex',
                        OUTDIR: 'tmp/tests/cache/Example/ref',
                        OUTFILETYPE: 'pdf',
                        SOURCE_DATE_EPOCH: '1',
                    },
                    silent: true,
                });
                expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                    args: [
                        '--pdf',
                        '--output=tmp/tests/output/Example/ref.svg',
                        '--bitmap-format=png',
                        '--currentcolor=#000',
                        '--font-format=woff2',
                        '--linkmark=none',
                        '--optimize=all',
                        '--precision=0',
                        '--relative',
                        '--color',
                        '--progress',
                        '--verbosity=3',
                        'tmp/tests/cache/Example/ref/root.pdf',
                    ],
                    command: 'dvisvgm',
                    env: {
                        FILENAME: 'root.pdf',
                        FILENAME_BASE: 'root',
                        FILEPATH: 'tmp/tests/cache/Example/ref/root.pdf',
                        FILETYPE: 'pdf',
                        OUTDIR: 'tmp/tests/output/Example',
                        OUTFILEPATH: 'tmp/tests/output/Example/ref.svg',
                    },
                    silent: true,
                });
            });

            it('css variables', async () => {
                expect(
                    await handler.process(
                        '\\textcolor{var(--some-css-variable)}{$x$}',
                        {
                            attributes: { ref: 'ath-something-test-348902' },
                            selfClosing: false,
                            tag: 'tex',
                            filename:
                                'css variables (ath-something-test-348902).sveltex',
                        },
                    ),
                ).toEqual(
                    '<figure>\n<svelte:component this={Sveltex__tex__ath_something_test_348902} />\n</figure>',
                );
                expect(writeFile).toHaveBeenCalledTimes(3);
                expect(writeFile).toHaveBeenNthCalledWith(
                    1,
                    'tmp/tests/cache/tex/ath-something-test-348902/root.tex',
                    '\\documentclass{standalone}\n' +
                        '\\usepackage{microtype}\n' +
                        '\\makeatletter\n' +
                        '\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n' +
                        '\\makeatother\n' +
                        '\\definecolor{sveltexf2a5bd}{HTML}{f2a5bd}\n' +
                        '\n' +
                        '\\begin{document}\n' +
                        '\\textcolor{sveltexf2a5bd}{$x$}\n' +
                        '\\end{document}\n',
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    2,
                    'tmp/tests/output/tex/ath-something-test-348902.svg',
                    expect.stringContaining(
                        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="7.592" height="4.289pt" viewBox="0 0 5.694 4.289"><style><![CDATA[@font-face{font-family:MHOLNP-CMMI10;src:url(data:application/x-font-woff2;base64,',
                    ),
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    2,
                    'tmp/tests/output/tex/ath-something-test-348902.svg',
                    expect.stringContaining(
                        ' format(\'woff2\');}\ntext.f0 {font-family:MHOLNP-CMMI10;font-size:9.96px}\n]]></style><g id="page1"><text class="f0" transform="translate(0 4.289)scale(.999735)" fill="var(--some-css-variable)">x</text></g></svg>',
                    ),
                    'utf8',
                );
                expect(writeFile).toHaveBeenNthCalledWith(
                    3,
                    'tmp/tests/cache/cache.json',
                    '{"int":{"tex/ath-something-test-348902":{"sourceHash":"h9-U6Zhw1McrSM7asY81sDMuYA9YFTDQH22j6ewlwTo","hash":"NTmlGmCVVN7Yt_Psu8ARagV4RPbikfQ2-qu_5sS7SjE"}},"svg":{"tex/ath-something-test-348902":{"sourceHash":"NTmlGmCVVN7Yt_Psu8ARagV4RPbikfQ2-qu_5sS7SjE"}}}',
                    'utf8',
                );

                expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
                expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                    args: [
                        '--output-format=pdf',
                        '--no-shell-escape',
                        '--interaction=nonstopmode',
                        '"root.tex"',
                    ],
                    command: 'lualatex',
                    cwd: 'tmp/tests/cache/tex/ath-something-test-348902',
                    env: {
                        FILENAME: 'root.tex',
                        FILENAME_BASE: 'root',
                        FILEPATH:
                            'tmp/tests/cache/tex/ath-something-test-348902/root.tex',
                        OUTDIR: 'tmp/tests/cache/tex/ath-something-test-348902',
                        OUTFILETYPE: 'pdf',
                        SOURCE_DATE_EPOCH: '1',
                    },
                    silent: true,
                });
                expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                    args: [
                        '--pdf',
                        '--output=tmp/tests/output/tex/ath-something-test-348902.svg',
                        '--bitmap-format=png',
                        '--currentcolor=#000',
                        '--font-format=woff2',
                        '--linkmark=none',
                        '--optimize=all',
                        '--precision=0',
                        '--relative',
                        '--color',
                        '--progress',
                        '--verbosity=3',
                        'tmp/tests/cache/tex/ath-something-test-348902/root.pdf',
                    ],
                    command: 'dvisvgm',
                    env: {
                        FILENAME: 'root.pdf',
                        FILENAME_BASE: 'root',
                        FILEPATH:
                            'tmp/tests/cache/tex/ath-something-test-348902/root.pdf',
                        FILETYPE: 'pdf',
                        OUTDIR: 'tmp/tests/output/tex',
                        OUTFILEPATH:
                            'tmp/tests/output/tex/ath-something-test-348902.svg',
                    },
                    silent: true,
                });
            });
        },
    );
});

describe('AdvancedTexHandler.create', () => {
    fixture();

    it('returns instance of AdvancedTexHandler', async () => {
        const handler = await AdvancedTexHandler.create('local');
        expect(handler).toBeTypeOf('object');
        expect(handler).not.toBeNull();
        expect(handler).toBeInstanceOf(AdvancedTexHandler);
    });

    it('edge cases', async () => {
        const ath = await AdvancedTexHandler.create('local');
        expect(
            await ath.process('', {
                attributes: { ref: 'ref' },
                selfClosing: false,
                tag: '',
                filename: 'test.sveltex',
            }),
        ).toEqual('');
    });

    it("should require custom param if backend is 'custom'", async () => {
        await expect(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            AdvancedTexHandler.create('custom', undefined!),
        ).rejects.toThrowError('');
    });

    it('should accept "none" backend', async () => {
        const handler = await AdvancedTexHandler.create('none');
        expect(handler).toBeTypeOf('object');
        expect(handler).not.toBeNull();
        expect(handler).toBeInstanceOf(AdvancedTexHandler);
        expect(
            handler.process('ath-something-test-908423', {
                tag: '',
                attributes: { ref: '' },
                selfClosing: false,
                filename: 'test.sveltex',
            }),
        ).toEqual('ath-something-test-908423');
    });

    it('should throw error if unsupported backend is requested', async () => {
        await expect(() =>
            AdvancedTexHandler.create('unsupported' as 'none'),
        ).rejects.toThrowError();
    });

    it("should set `configure` to noop by default if backend is 'custom'", async () => {
        const handler = await AdvancedTexHandler.create('custom', {
            process: () => 'output',
        });
        expect(handler.configure).toBeTypeOf('function');
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(await handler.configure({})).toBeUndefined();
    });

    it('should support all expected params', async () => {
        const handler = await AdvancedTexHandler.create('custom', {
            process: () => 'custom process',
            configuration: {
                cacheDirectory: 'tmp/tests/cache',
            },
            configure: () => {
                return;
            },
            processor: {},
        });
        expect(handler.configure).toBeTypeOf('function');
        expect(handler.processor).toEqual({});
        expect(handler.process).toBeTypeOf('function');
        expect(
            await handler.process('input', {
                attributes: { ref: '' },
                selfClosing: false,
                tag: '',
                filename: 'test.sveltex',
            }),
        ).toEqual('custom process');
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(await handler.configure({})).toBeUndefined();
    });
});
