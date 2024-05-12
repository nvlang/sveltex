import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
// import { sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { pathExists } from '$utils/debug.js';

import { rimraf, resolve } from '$deps.js';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
} from 'vitest';
import { sha256 } from '$utils/misc.js';
import { AdvancedTexConfiguration } from '$mod.js';

// async function handlers() {
//     const ath = await AdvancedTexHandler.create('local');
//     await ath.configure({
//         engine: 'lualatex',
//         caching: false,
//         cacheDirectory: `${tmpTestsDir}/cache`,
//         outputDirectory: `${tmpTestsDir}/output`,
//         components: {
//             tex: {},
//             Example: { aliases: ['ExampleAlias'] },
//         },
//         dvisvgmOptions: {
//             svg: {
//                 fontFormat: 'woff2',
//             },
//         },
//     });
//     return [ath];
// }

/**
 * @example 'tmp/tests-1234567890abcdefg'
 */
let tmpTestsDir: string;

let ath: AdvancedTexHandler<'local'>;

async function setup(hash: string, config?: AdvancedTexConfiguration<'local'>) {
    if (pathExists(`tmp/tests-${hash}`)) {
        await rimraf(resolve(`tmp/tests-${hash}`));
    }
    ath = await AdvancedTexHandler.create('local');
    await ath.configure({
        engine: 'lualatex',
        caching: false,
        cacheDirectory: `tmp/tests-${hash}/cache`,
        outputDirectory: `tmp/tests-${hash}/output`,
        components: {
            tex: {},
            Example: { aliases: ['ExampleAlias'] },
        },
        dvisvgmOptions: {
            svg: {
                fontFormat: 'woff2',
            },
        },
        ...config,
    });
    vi.clearAllMocks();
    tmpTestsDir = `tmp/tests-${hash}`;
}

// async function setup(handler?: AdvancedTexHandler<'local'>) {
//     if (handler) {
//         handler.cache.data.int = {};
//         handler.cache.data.svg = {};
//     }
//     if (pathExists('tmp/tests')) await rimraf(resolve('tmp/tests'));
//     vi.clearAllMocks();
// }

async function teardown(hash: string) {
    if (pathExists(`tmp/tests-${hash}`)) {
        await rimraf(resolve(`tmp/tests-${hash}`));
    }
    vi.clearAllMocks();
    tmpTestsDir = '';
    ath = null as unknown as AdvancedTexHandler<'local'>;
}

function fixture(config?: AdvancedTexConfiguration<'local'>) {
    beforeEach(async ({ task }) => {
        const hash = sha256(task.name, 'hex').slice(0, 16);
        await setup(hash, config);
        vi.clearAllMocks();
    });
    afterEach(async ({ task }) => {
        const hash = sha256(task.name, 'hex').slice(0, 16);
        await teardown(hash);
        vi.clearAllMocks();
    });
}

suite("AdvancedTexHandler<'local'>", async () => {
    vi.restoreAllMocks();
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
    fixture();
    const { writeFile, log, spawnCliInstruction } = await spy(
        ['writeFile', 'log', 'spawnCliInstruction'],
        false,
    );
    log.mockImplementation(() => undefined);
    // writeFile.mockImplementation(
    //     async (path: string, data: string, opts: ObjectEncodingOptions) => {
    //         if (path.endsWith('cache.json')) {
    //             return;
    //         }
    //         await writeFileOrig(path, data, opts);
    //     },
    // );

    describe('configure()', () => {
        fixture();
        it('should return true if this.backend is equal to input', async () => {
            const ath = await AdvancedTexHandler.create('local');
            expect(ath.configuration.components).toEqual({});
            await ath.configure({});
            expect(ath.configuration.components).toEqual({});
        });
    });

    describe.each([
        {},
        {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            components: undefined!,
        },
    ] as const)('configure', (config) => {
        fixture(config);
        afterEach(async () => {
            await ath.configure({ components: null });
        });

        it('`configure({components: null})` sets `configuration.components` to `{}`', async () => {
            await ath.configure({ components: { something: {} } });
            expect(ath.configuration.components).not.toEqual({});
            await ath.configure({ components: null });
            expect(ath.configuration.components).toEqual({});
            expect(ath.tccAliases).toEqual([]);
            expect(ath.tccNames).toEqual([]);
            expect(ath.tccMap.size).toEqual(0);
        });

        it('complains about conflicting tex component names', async () => {
            await ath.configure({
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
                    ...ath.configuration.components,
                };
                expect(origComponents).toEqual(ath.configuration.components);
                await ath.configure({ components });
                expect(ath.configuration.components).toEqual({
                    ...origComponents,
                    ...components,
                });
            },
        );
    });

    describe.each([{}])('advancedTexHandler.noteTcInFile', (config) => {
        fixture(config);
        it('should work', () => {
            // initializes for file
            ath.noteTcInFile('test1.sveltex', {
                id: 'Sveltex__tex__ref',
                path: 'src/sveltex/tex/ref.svelte',
            });
            expect(ath.texComponents).toEqual({
                'test1.sveltex': [
                    {
                        id: 'Sveltex__tex__ref',
                        path: 'src/sveltex/tex/ref.svelte',
                    },
                ],
            });
            // deals with duplicates
            ath.noteTcInFile('test1.sveltex', {
                id: 'Sveltex__tex__ref',
                path: 'src/sveltex/tex/ref.svelte',
            });
            expect(ath.texComponents).toEqual({
                'test1.sveltex': [
                    {
                        id: 'Sveltex__tex__ref',
                        path: 'src/sveltex/tex/ref.svelte',
                    },
                ],
            });
            // adds to existing file
            ath.noteTcInFile('test1.sveltex', {
                id: 'Sveltex__tex__ref2',
                path: 'src/sveltex/tex/ref2.svelte',
            });
            expect(ath.texComponents).toEqual({
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
    });

    describe.sequential.each([{}])('advancedTexHandler.process', (config) => {
        fixture(config);
        it('should work with self-closing components', async () => {
            expect(
                await ath.process('x', {
                    tag: 'ExampleAlias',
                    attributes: { ref: 'ref' },
                    selfClosing: true,
                    filename: 'test-73cd8d85.sveltex',
                }),
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
            );
            expect(writeFile).not.toHaveBeenCalled();
            expect(spawnCliInstruction).not.toHaveBeenCalled();
        });

        it('supports aliases', async () => {
            expect(
                await ath.process('x', {
                    tag: 'ExampleAlias',
                    attributes: { ref: 'ref' },
                    selfClosing: false,
                    filename: 'test-d9f77b2e.sveltex',
                }),
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
            );
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                `${tmpTestsDir}/cache/Example/ref/root.tex`,
                '\\documentclass{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\\begin{document}\nx\n\\end{document}\n',
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/Example/ref.svg`,
                expect.stringContaining(
                    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="5.26pt" height="4.294pt" viewBox="0 0 5.26 4.294"><style>@font-face{font-family:XWTZSC-LMRoman10-Regular;src:url(data:application/x-font-woff2;base64',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/Example/ref.svg`,
                expect.stringContaining(
                    ' format(\'woff2\');}\ntext.f0 {font-family:XWTZSC-LMRoman10-Regular;font-size:9.96px}\n</style><g id="page1"><text class="f0" x="-0.258931" transform="translate(0 4.294)scale(.999735)" fill="currentColor">x</text></g></svg>',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `${tmpTestsDir}/cache/cache.json`,
                '{"int":{"Example/ref":{"sourceHash":"u9Edso_qywe0Xxw5JvIcospMYE66P8YD7POaR4ZXj74","hash":"7hRIkzoDKUPuoGwLB3Z0yCJio9YC4uwmBbF4KV9lvvA"}},"svg":{"Example/ref":{"sourceHash":"7hRIkzoDKUPuoGwLB3Z0yCJio9YC4uwmBbF4KV9lvvA"}}}',
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
                cwd: `${tmpTestsDir}/cache/Example/ref`,
                env: {
                    FILENAME: 'root.tex',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/Example/ref/root.tex`,
                    OUTDIR: `${tmpTestsDir}/cache/Example/ref`,
                    OUTFILETYPE: 'pdf',
                    SOURCE_DATE_EPOCH: '1',
                },
                silent: true,
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                args: [
                    '--pdf',
                    `--output=${tmpTestsDir}/output/Example/ref.svg`,
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
                    `${tmpTestsDir}/cache/Example/ref/root.pdf`,
                ],
                command: 'dvisvgm',
                env: {
                    FILENAME: 'root.pdf',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/Example/ref/root.pdf`,
                    FILETYPE: 'pdf',
                    OUTDIR: `${tmpTestsDir}/output/Example`,
                    OUTFILEPATH: `${tmpTestsDir}/output/Example/ref.svg`,
                },
                silent: true,
            });
        });

        it('css variables', async () => {
            expect(
                await ath.process(
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
                `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.tex`,
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
                `${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
                expect.stringContaining(
                    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="7.592" height="4.289pt" viewBox="0 0 5.694 4.289"><style>@font-face{font-family:MHOLNP-CMMI10;src:url(data:application/x-font-woff2;base64,',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
                expect.stringContaining(
                    ' format(\'woff2\');}\ntext.f0 {font-family:MHOLNP-CMMI10;font-size:9.96px}\n</style><g id="page1"><text class="f0" transform="translate(0 4.289)scale(.999735)" fill="var(--some-css-variable)">x</text></g></svg>',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `${tmpTestsDir}/cache/cache.json`,
                '{"int":{"tex/ath-something-test-348902":{"sourceHash":"h9-U6Zhw1McrSM7asY81sDMuYA9YFTDQH22j6ewlwTo","hash":"v_4noskoq9-WRYAgyuCCcaKfOAnqK1w7xlsgkUH1udg"}},"svg":{"tex/ath-something-test-348902":{"sourceHash":"v_4noskoq9-WRYAgyuCCcaKfOAnqK1w7xlsgkUH1udg"}}}',
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
                cwd: `${tmpTestsDir}/cache/tex/ath-something-test-348902`,
                env: {
                    FILENAME: 'root.tex',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.tex`,
                    OUTDIR: `${tmpTestsDir}/cache/tex/ath-something-test-348902`,
                    OUTFILETYPE: 'pdf',
                    SOURCE_DATE_EPOCH: '1',
                },
                silent: true,
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                args: [
                    '--pdf',
                    `--output=${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
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
                    `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.pdf`,
                ],
                command: 'dvisvgm',
                env: {
                    FILENAME: 'root.pdf',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.pdf`,
                    FILETYPE: 'pdf',
                    OUTDIR: `${tmpTestsDir}/output/tex`,
                    OUTFILEPATH: `${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
                },
                silent: true,
            });
        });
    });
});

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

describe('AdvancedTexHandler.create', () => {
    fixture();

    it('returns instance of AdvancedTexHandler', async () => {
        const handler = await AdvancedTexHandler.create('local');
        expect(handler).toBeTypeOf('object');
        expect(handler).not.toBeNull();
        expect(handler).toBeInstanceOf(AdvancedTexHandler);
    });

    it('edge cases', async () => {
        const handler = await AdvancedTexHandler.create('local');
        expect(
            await handler.process('', {
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
                cacheDirectory: `${tmpTestsDir}/cache`,
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
