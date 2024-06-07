import { TexHandler } from '$handlers/TexHandler.js';
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
import { TexConfiguration } from '$mod.js';
import { pathExists } from '$utils/fs.js';
import { getDefaultVerbEnvConfig } from '$config/defaults.js';

/**
 * @example 'tmp/tests-1234567890abcdefg'
 */
let tmpTestsDir: string;

let ath: TexHandler;

async function setup(hash: string, config?: TexConfiguration) {
    if (pathExists(`tmp/tests-${hash}`)) {
        await rimraf(resolve(`tmp/tests-${hash}`));
    }
    ath = await TexHandler.create();
    await ath.configure({
        compilation: { engine: 'lualatex' },
        caching: {
            enabled: false,
            cacheDirectory: `tmp/tests-${hash}/cache`,
        },
        conversion: {
            outputDirectory: `tmp/tests-${hash}/output`,
            dvisvgm: {
                svg: {
                    fontFormat: 'woff2',
                },
            },
        },
        ...config,
    });
    vi.clearAllMocks();
    tmpTestsDir = `tmp/tests-${hash}`;
}

// async function setup(handler?: TexHandler) {
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
    ath = null as unknown as TexHandler;
}

function fixture(config?: TexConfiguration) {
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

describe('TexHandler', () => {
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

    describe.each([{}])('texHandler.noteTcInFile', (config) => {
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

    describe.sequential.each([{}])('texHandler.process', (config) => {
        fixture(config);
        it('should work with self-closing components', async () => {
            expect(
                (
                    await ath.process('x', {
                        tag: 'Example',
                        attributes: { ref: 'ref' },
                        selfClosing: true,
                        filename: 'test-73cd8d85.sveltex',
                        config: getDefaultVerbEnvConfig('tex'),
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
                        config: getDefaultVerbEnvConfig('tex'),
                        outerContent:
                            '<ExampleAlias ref="ref">x</ExampleAlias>',
                    })
                ).processed,
            ).toEqual(
                '<figure>\n<svelte:component this={Sveltex__Example__ref} />\n</figure>',
            );
            expect(log).not.toHaveBeenCalled();
            expect(writeFile).toHaveBeenCalledTimes(3);

            // \\ExplSyntaxOn
            // \\str_if_exist:NF \\c_sys_backend_str
            //   { \\sys_load_backend:n { dvisvgm } }
            // \\ExplSyntaxOff

            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                `${tmpTestsDir}/cache/Example/ref/root.tex`,
                expect.stringMatching(
                    /\\documentclass\[dvisvgm\]{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\s*\\begin{document}\nx\n\\end{document}\n/s,
                ),
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
                    /\{"int":\{"Example\/ref":\{"sourceHash":".+?","hash":"(.+?)"\}\},"svg":\{"Example\/ref":\{"sourceHash":"\1"\}\}\}/,
                ),
                'utf8',
            );
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                args: [
                    '--output-format=dvi',
                    '--output-comment=""',
                    '--no-shell-escape',
                    '--interaction=batchmode',
                    'root.tex',
                ],
                command: 'lualatex',
                cwd: `${tmpTestsDir}/cache/Example/ref`,
                env: { SOURCE_DATE_EPOCH: '1' },
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
                            config: getDefaultVerbEnvConfig('tex'),
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
                '\\documentclass[dvisvgm]{standalone}\n' +
                    '\\usepackage{microtype}\n' +
                    '\\makeatletter\n' +
                    '\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n' +
                    '\\makeatother\n' +
                    '\n' +
                    '\n' +
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
                    /\{"int":\{"tex\/ath-something-test-348902":\{"sourceHash":".+?","hash":"(.+?)"\}\},"svg":\{"tex\/ath-something-test-348902":\{"sourceHash":"\1"\}\}\}/,
                ),
                'utf8',
            );

            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                args: [
                    '--output-format=dvi',
                    '--output-comment=""',
                    '--no-shell-escape',
                    '--interaction=batchmode',
                    'root.tex',
                ],
                command: 'lualatex',
                cwd: `${tmpTestsDir}/cache/tex/ath-something-test-348902`,
                env: { SOURCE_DATE_EPOCH: '1' },
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
                silent: true,
            });
        });
    });
});

describe('TexHandler.create', () => {
    fixture();

    it('returns instance of TexHandler', async () => {
        const handler = await TexHandler.create();
        expect(handler).toBeTypeOf('object');
        expect(handler).not.toBeNull();
        expect(handler).toBeInstanceOf(TexHandler);
    });

    it('edge cases', async () => {
        const handler = await TexHandler.create();
        expect(
            (
                await handler.process('', {
                    attributes: { ref: 'ref' },
                    selfClosing: false,
                    tag: '',
                    filename: 'test.sveltex',
                    config: getDefaultVerbEnvConfig('tex'),
                    outerContent: '',
                })
            ).processed,
        ).toEqual('');
    });
});
