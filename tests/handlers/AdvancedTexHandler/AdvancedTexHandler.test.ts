import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { spy } from '$tests/fixtures.js';

import { rimraf, resolve } from '$deps.js';
import {
    type MockInstance,
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { sha256 } from '$utils/misc.js';
import { AdvancedTexConfiguration } from '$mod.js';
import { pathExists } from '$utils/fs.js';
import { getDefaultVerbEnvConfig } from '$config/defaults.js';

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
        // components: {
        //     tex: {},
        //     Example: { aliases: ['ExampleAlias'] },
        // },
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

describe("AdvancedTexHandler<'local'>", () => {
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
        const mocks = await spy(
            ['writeFile', 'log', 'spawnCliInstruction'],
            false,
        );
        writeFile = mocks.writeFile;
        log = mocks.log;
        spawnCliInstruction = mocks.spawnCliInstruction;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    fixture();
    let writeFile: MockInstance;
    let log: MockInstance;
    let spawnCliInstruction: MockInstance;

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
                (
                    await ath.process('x', {
                        tag: 'Example',
                        attributes: { ref: 'ref' },
                        selfClosing: true,
                        filename: 'test-73cd8d85.sveltex',
                        config: getDefaultVerbEnvConfig('advancedTex'),
                        outerContent:
                            '<ExampleAlias ref="ref">x</ExampleAlias>',
                    })
                ).processed,
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
            );
            expect(log).not.toHaveBeenCalled();
            expect(writeFile).not.toHaveBeenCalled();
            expect(spawnCliInstruction).not.toHaveBeenCalled();
        });

        it('works', async () => {
            expect(
                (
                    await ath.process('x', {
                        tag: 'Example',
                        attributes: { ref: 'ref' },
                        selfClosing: false,
                        filename: 'test-d9f77b2e.sveltex',
                        config: getDefaultVerbEnvConfig('advancedTex'),
                        outerContent:
                            '<ExampleAlias ref="ref">x</ExampleAlias>',
                    })
                ).processed,
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
            );
            expect(log).not.toHaveBeenCalled();
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
                expect.stringMatching(
                    /<svg xmlns=".+?" xmlns:xlink=".+?" width=".+?" height=".+?" viewBox=".+?"><style>@font-face\{font-family:.+?;src:url\(data:application\/x-font-woff2;base64/,
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/Example/ref.svg`,
                expect.stringContaining(
                    'fill="currentColor">x</text></g></svg>',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `${tmpTestsDir}/cache/cache.json`,
                expect.stringMatching(
                    /\{"int":\{"Example\/ref":\{"sourceHash":"u9Edso_qywe0Xxw5JvIcospMYE66P8YD7POaR4ZXj74","hash":"(.+?)"\}\},"svg":\{"Example\/ref":\{"sourceHash":"\1"\}\}\}/,
                ),
                'utf8',
            );
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                args: [
                    '--output-format=dvi',
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
                    OUTFILETYPE: 'dvi',
                    SOURCE_DATE_EPOCH: '1',
                },
                silent: true,
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                args: [
                    `--output=${tmpTestsDir}/output/Example/ref.svg`,
                    '--exact-bbox',
                    '--bbox=2pt',
                    '--bitmap-format=png',
                    '--currentcolor=#000',
                    '--embed-bitmaps',
                    '--font-format=woff2',
                    '--linkmark=none',
                    '--optimize=all',
                    '--precision=0',
                    '--relative',
                    '--color',
                    '--progress',
                    '--verbosity=3',
                    `${tmpTestsDir}/cache/Example/ref/root.dvi`,
                ],
                command: 'dvisvgm',
                env: {
                    FILENAME: 'root.dvi',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/Example/ref/root.dvi`,
                    FILETYPE: 'dvi',
                    OUTDIR: `${tmpTestsDir}/output/Example`,
                    OUTFILEPATH: `${tmpTestsDir}/output/Example/ref.svg`,
                },
                silent: true,
            });
        });

        it('css variables', async () => {
            expect(
                (
                    await ath.process(
                        '\\textcolor{var(--some-css-variable)}{$x$}',
                        {
                            attributes: { ref: 'ath-something-test-348902' },
                            selfClosing: false,
                            tag: 'tex',
                            filename:
                                'css variables (ath-something-test-348902).sveltex',
                            config: getDefaultVerbEnvConfig('advancedTex'),
                            outerContent:
                                '<tex ref="ath-something-test-348902">\\textcolor{var(--some-css-variable)}{$x$}</tex>',
                        },
                    )
                ).processed,
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__tex__ath_something_test_348902} />\n</figure>',
            );
            expect(log).not.toHaveBeenCalled();
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
                expect.stringMatching(
                    /<svg xmlns=".+?" xmlns:xlink=".+?" width=".+?" height=".+?" viewBox=".+?"><style>@font-face\{font-family:.+?;src:url\(data:application\/x-font-woff2;base64,/,
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
                expect.stringContaining(
                    'fill="var(--some-css-variable)">x</text></g></svg>',
                ),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `${tmpTestsDir}/cache/cache.json`,
                expect.stringMatching(
                    /\{"int":\{"tex\/ath-something-test-348902":\{"sourceHash":"h9-U6Zhw1McrSM7asY81sDMuYA9YFTDQH22j6ewlwTo","hash":"(.+?)"\}\},"svg":\{"tex\/ath-something-test-348902":\{"sourceHash":"\1"\}\}\}/,
                ),
                'utf8',
            );

            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                args: [
                    '--output-format=dvi',
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
                    OUTFILETYPE: 'dvi',
                    SOURCE_DATE_EPOCH: '1',
                },
                silent: true,
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                args: [
                    `--output=${tmpTestsDir}/output/tex/ath-something-test-348902.svg`,
                    '--exact-bbox',
                    '--bbox=2pt',
                    '--bitmap-format=png',
                    '--currentcolor=#000',
                    '--embed-bitmaps',
                    '--font-format=woff2',
                    '--linkmark=none',
                    '--optimize=all',
                    '--precision=0',
                    '--relative',
                    '--color',
                    '--progress',
                    '--verbosity=3',
                    `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.dvi`,
                ],
                command: 'dvisvgm',
                env: {
                    FILENAME: 'root.dvi',
                    FILENAME_BASE: 'root',
                    FILEPATH: `${tmpTestsDir}/cache/tex/ath-something-test-348902/root.dvi`,
                    FILETYPE: 'dvi',
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
            (
                await handler.process('input', {
                    tag: '',
                    attributes: { ref: '' },
                    selfClosing: false,
                    filename: 'test.sveltex',
                    config: getDefaultVerbEnvConfig('advancedTex'),
                    outerContent: '',
                })
            ).processed,
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
            (
                await handler.process('', {
                    attributes: { ref: 'ref' },
                    selfClosing: false,
                    tag: '',
                    filename: 'test.sveltex',
                    config: getDefaultVerbEnvConfig('advancedTex'),
                    outerContent: '',
                })
            ).processed,
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
            (
                await handler.process('ath-something-test-908423', {
                    tag: '',
                    attributes: { ref: '' },
                    selfClosing: false,
                    filename: 'test.sveltex',
                    config: getDefaultVerbEnvConfig('advancedTex'),
                    outerContent: '',
                })
            ).processed,
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
            (
                await handler.process('input', {
                    attributes: { ref: '' },
                    selfClosing: false,
                    tag: '',
                    filename: 'test.sveltex',
                    config: getDefaultVerbEnvConfig('advancedTex'),
                    outerContent: '',
                })
            ).processed,
        ).toEqual('custom process');
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        expect(await handler.configure({})).toBeUndefined();
    });
});
