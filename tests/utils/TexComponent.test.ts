import { resolve, rimraf } from '$deps.js';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { spy } from '$tests/fixtures.js';
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import { TexComponent } from '$utils/TexComponent.js';
import { unescapeCssColorVars } from '$utils/css.js';
import { pathExists } from '$utils/fs.js';
import { sha256 } from '$utils/misc.js';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';

let ath: AdvancedTexHandler<'local'>;
let tc: TexComponent<'local'>;

async function setup(hash: string) {
    if (pathExists(`tmp/tests-${hash}`)) {
        await rimraf(resolve(`tmp/tests-${hash}`));
    }
    ath = await AdvancedTexHandler.create('local');
    await ath.configure({
        components: { tex: {} },
        cacheDirectory: `tmp/tests-${hash}/cache`,
        outputDirectory: `tmp/tests-${hash}/output`,
    });
    tc = ath.createTexComponent('TexComponent.test.ts content', {
        attributes: { ref: 'TexComponent_test_ref' },
        filename: 'TexComponent_test_ts.sveltex',
        selfClosing: false,
        tag: 'tex',
    });
    vi.clearAllMocks();
    tmpTestsDir = `tmp/tests-${hash}`;
}

async function teardown(hash: string) {
    if (pathExists(`tmp/tests-${hash}`)) {
        await rimraf(resolve(`tmp/tests-${hash}`));
    }
    vi.clearAllMocks();
    tmpTestsDir = '';
}

/**
 * @example 'tmp/tests-1234567890abcdefg'
 */
let tmpTestsDir: string;

function fixture() {
    beforeEach(async ({ task }) => {
        const hash = sha256(task.name, 'hex').slice(0, 16);
        await setup(hash);
        vi.clearAllMocks();
    });
    afterEach(async ({ task }) => {
        const hash = sha256(task.name, 'hex').slice(0, 16);
        await teardown(hash);
        vi.clearAllMocks();
    });
}

describe('TexComponent', () => {
    vi.restoreAllMocks();
    let log: MockInstance;
    let writeFile: MockInstance;
    let spawnCliInstruction: MockInstance;
    let readFile: MockInstance;
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
            ['writeFile', 'log', 'spawnCliInstruction', 'readFile'],
            false,
        );
        log = mocks.log;
        writeFile = mocks.writeFile;
        spawnCliInstruction = mocks.spawnCliInstruction;
        readFile = mocks.readFile;
        log.mockImplementation(() => undefined);
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        if (pathExists(`tmp/tests`)) {
            await rimraf(resolve(`tmp/tests`));
        }
    });

    describe('create', () => {
        describe('error handling', () => {
            fixture();
            it.each([{}, { ref: '' }])(
                'should throw an error if no ref attribte is provided',
                (attributes) => {
                    expect(() =>
                        ath.createTexComponent('content', {
                            tag: 'tex',
                            attributes,
                            filename: 'TexComponent_test_ts.sveltex',
                            selfClosing: false,
                        }),
                    ).toThrowError(/ref.*attribute/isu);
                },
            );
        });
    });

    describe('configuration setter', () => {
        fixture();
        it('should correctly set configuration', async () => {
            const ath = await AdvancedTexHandler.create('local');
            const tc = TexComponent.create<'local'>({
                advancedTexHandler: ath,
                tag: 'div',
                attributes: { ref: 'ref' },
                tex: '',
            });
            tc.configuration = { aliases: ['SomethingElse'] };
            expect(tc.configuration.aliases).toEqual(['SomethingElse']);
        });
    });

    describe('compile (error handling)', () => {
        fixture();
        it.each([false, true])(
            'should fail silently (TeX compilation, overrideCompileCmd: %s)',
            async (overrideCompileCmd) => {
                if (overrideCompileCmd) {
                    tc.configuration.overrides.overrideCompilationCommand = {
                        command: 'false',
                    };
                } else {
                    spawnCliInstruction.mockResolvedValueOnce({
                        code: 1,
                        stdout: 'example stdout',
                        stderr: 'example stderr',
                    });
                }
                const code = await tc.compile();
                expect(code).toEqual(1);
                expect(log).toHaveBeenCalledTimes(1);
                expect(log).toHaveBeenCalledWith(
                    { severity: 'error', style: 'dim' },
                    overrideCompileCmd
                        ? expect.stringMatching(
                              /[\w\W]*compilation[\w\W]*The following stderr was produced:[\w\W]*\(no stderr output\)/,
                          )
                        : expect.stringMatching(
                              /[\w\W]*compilation[\w\W]*The following stderr was produced:\n\nexample stderr/,
                          ),
                );
            },
        );

        it.each([false, true])(
            'should fail silently (PDF/DVI to SVG conversion, overrideConversionCmd: %s)',
            async (overrideConversionCmd) => {
                if (overrideConversionCmd) {
                    await ath.configure({
                        overrideConversionCommand: {
                            command: 'false',
                        },
                    });
                } else {
                    readFile.mockResolvedValueOnce('test-pdf');
                    spawnCliInstruction
                        .mockResolvedValueOnce({
                            code: 0,
                            stdout: '',
                            stderr: '',
                        })
                        .mockResolvedValueOnce({
                            code: 1,
                            stdout: 'example stdout',
                            stderr: 'example stderr',
                        });
                }
                const code = await tc.compile();
                expect(code).toEqual(1);
                expect(log).toHaveBeenCalledTimes(1);
                expect(log).toHaveBeenCalledWith(
                    { severity: 'error', style: 'dim' },
                    expect.stringContaining(
                        'The conversion was attempted by running the following command',
                    ),
                );
                expect(writeFile).toHaveBeenCalledTimes(2);
                expect(writeFile).toHaveBeenNthCalledWith(
                    2,
                    `${tmpTestsDir}/cache/cache.json`,
                    expect.stringMatching(
                        /{"int":{"tex\/TexComponent_test_ref":{"sourceHash":"84oQdkLNva39DF_TvAx6Rb39qd0Ml7QemlCu9Zds3nY","hash":"[\w-]{43}"}},"svg":{}}/,
                    ),
                    'utf8',
                );
            },
        );

        it('should fail silently (no PDF/DVI found)', async () => {
            await ath.configure({
                overrideCompilationCommand: {
                    command: 'true',
                },
            });
            const code = await tc.compile();
            expect(code).toEqual(2);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                'error',
                expect.stringMatching(
                    /✖ Error while reading tmp\/tests-.*\/cache\/tex\/TexComponent_test_ref\/root.pdf/,
                ),
                expect.stringContaining(
                    'Error: ENOENT: no such file or directory',
                ),
            );
            expect(writeFile).toHaveBeenCalledTimes(1);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                'tmp/tests-32311a2c0e59378a/cache/tex/TexComponent_test_ref/root.tex',
                '\\documentclass{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\\begin{document}\nTexComponent.test.ts content\n\\end{document}\n',
                'utf8',
            );
        });

        it('should fail silently (no SVG found)', async () => {
            await ath.configure({
                overrideConversionCommand: {
                    command: 'true',
                },
            });
            const code = await tc.compile();
            expect(code).toEqual(3);
            expect(log).toHaveBeenCalledTimes(2);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(
                    `✖ Error converting ${tmpTestsDir}/cache/tex/TexComponent_test_ref/root.pdf`,
                ),
                expect.stringContaining(
                    'Error: ENOENT: no such file or directory',
                ),
            );
            expect(log).toHaveBeenNthCalledWith(
                2,
                'info',
                expect.stringMatching(
                    /Deleting unused cache subdirectory: .*\/tmp\/tests-.{16}\/cache\/tex\/TexComponent_test_ref\//,
                ),
            );
            expect(writeFile).toHaveBeenCalledTimes(2);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                `${tmpTestsDir}/cache/tex/TexComponent_test_ref/root.tex`,
                '\\documentclass{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\\begin{document}\nTexComponent.test.ts content\n\\end{document}\n',
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/cache/cache.json`,
                '{"int":{"tex/TexComponent_test_ref":{"sourceHash":"84oQdkLNva39DF_TvAx6Rb39qd0Ml7QemlCu9Zds3nY","hash":"xItOhLUMPCyteMUX4EXGHuxe39GTOkpf8w0G8dU6src"}},"svg":{}}',
                'utf8',
            );
        });

        it('should fail silently (unknown error caught)', async () => {
            spawnCliInstruction.mockImplementationOnce(() => {
                throw new Error();
            });
            const code = await tc.compile();
            expect(code).toEqual(1);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                'error',
                `✖ Error while compiling ${tmpTestsDir}/cache/tex/TexComponent_test_ref/root.tex:\n\n`,
                expect.stringContaining('Error'),
            );
        });
    });

    describe('compile (caching)', () => {
        fixture();
        it('should support caching', { timeout: 10000 }, async () => {
            await ath.configure({
                cacheDirectory: `${tmpTestsDir}/cache`,
                outputDirectory: `${tmpTestsDir}/output`,
                overrideCompilationCommand: null,
                overrideConversionCommand: null,
            });
            await tc.compile();
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `${tmpTestsDir}/cache/cache.json`,
                '{"int":{"tex/TexComponent_test_ref":{"sourceHash":"84oQdkLNva39DF_TvAx6Rb39qd0Ml7QemlCu9Zds3nY","hash":"GzbtTYgwJ_sC8wsgEaT_ATk_A5otgMMJMngvHUToHPI"}},"svg":{"tex/TexComponent_test_ref":{"sourceHash":"GzbtTYgwJ_sC8wsgEaT_ATk_A5otgMMJMngvHUToHPI"}}}',
                'utf8',
            );
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            await tc.compile();
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            // Different .tex hash, same PDF content & hash => compilation, but
            // no conversion.
            tc = ath.createTexComponent('TexComponent.test.ts    content', {
                attributes: { ref: 'TexComponent_test_ref' },
                filename: 'TexComponent_test_ts.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            await tc.compile();
            expect(writeFile).toHaveBeenCalledTimes(5);
            expect(spawnCliInstruction).toHaveBeenCalledTimes(3);
        });

        it('should faithfully execute override commands', async () => {
            readFile
                .mockResolvedValueOnce('test-pdf')
                .mockResolvedValueOnce('test-svg');
            await ath.configure({
                // caching: false,
                components: {
                    tex: {
                        overrides: {
                            overrideCompilationCommand: { command: 'echo' },
                            overrideConversionCommand: { command: 'ls' },
                            overrideSvgPostprocess: () => 'optimized svg',
                        },
                    },
                },
            });

            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            const code = await tc.compile();
            expect(code).toEqual(0);
            // expect(log).not.toHaveBeenCalled();
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                command: 'echo',
                env: {
                    FILENAME: 'root.tex',
                    FILENAME_BASE: 'root',
                    FILEPATH: tc.source.texPath,
                    OUTDIR: tc.source.dir,
                    OUTFILETYPE: 'pdf',
                    SOURCE_DATE_EPOCH: '1',
                },
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                command: 'ls',
                env: {
                    FILENAME: 'root.pdf',
                    FILENAME_BASE: 'root',
                    FILEPATH: tc.source.intPath,
                    FILETYPE: 'pdf',
                    OUTDIR: `${tmpTestsDir}/output/tex`,
                    OUTFILEPATH: `${tmpTestsDir}/output/tex/ref.svg`,
                },
                silent: true,
            });
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `${tmpTestsDir}/output/tex/ref.svg`,
                'optimized svg',
                'utf8',
            );
            spawnCliInstruction.mockRestore();
        });
    });

    describe('compileCmd', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should log error if plain tex is used and pdf output is requested', async () => {
            const ath = await AdvancedTexHandler.create('local');
            await ath.configure({
                components: {
                    tex: {
                        overrides: {
                            engine: 'tex',
                            intermediateFiletype: 'pdf',
                        },
                    },
                },
            });
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            tc.compileCmd;
            expect(log).toHaveBeenCalledOnce();
            expect(log).toHaveBeenCalledWith(
                'error',
                'Plain TeX does not support PDF output.',
            );
        });

        it('should add the right output flags for lualatexmk (pdf)', async () => {
            const ath = await AdvancedTexHandler.create('local');
            await ath.configure({
                // caching: false,
                components: {
                    tex: {
                        overrides: {
                            // caching: false,
                            engine: 'lualatexmk',
                            intermediateFiletype: 'pdf',
                            saferLua: true,
                        },
                    },
                },
            });
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            expect(tc.compileCmd.args).toContain('-safer');
            expect(tc.compileCmd.args).toContain('-pdflua');
            tc.configuration.overrides.intermediateFiletype = 'dvi';
            expect(tc.compileCmd.args).toContain('-dvilua');
        });

        const cases: {
            engine?: SupportedTexEngine;
            option: string;
            value: unknown;
            flag: string;
        }[] = [
            {
                engine: 'lualatexmk',
                option: 'shellEscape',
                value: true,
                flag: '-shell-escape',
            },
            {
                option: 'shellEscape',
                value: false,
                flag: '--no-shell-escape',
            },
            {
                option: 'shellEscape',
                value: 'restricted',
                flag: '--shell-restricted',
            },
        ];

        it.each(cases)(`should add $flag flag`, async (data) => {
            const ath = await AdvancedTexHandler.create('local');
            await ath.configure({
                // caching: false,
                components: {
                    tex: {
                        overrides: {
                            // caching: false,
                            engine: data.engine ?? 'lualatex',
                            [data.option]: data.value,
                        },
                    },
                },
            });
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            expect(tc.compileCmd.args).toContain(data.flag);
        });
    });
});

describe.concurrent('unescapeCssColorVarsFromSvg', () => {
    it('should work', () => {
        const map = new Map<`--${string}`, string>();
        map.set('--css-var-123456', '123456');
        expect(unescapeCssColorVars('#123456', map)).toEqual(
            'var(--css-var-123456)',
        );
    });

    it('should convert #RRGGBB to #RGB if applicable', () => {
        const map = new Map<`--${string}`, string>();
        map.set('--css-var', '112233');
        expect(unescapeCssColorVars('#123', map)).toEqual('var(--css-var)');
    });
});
