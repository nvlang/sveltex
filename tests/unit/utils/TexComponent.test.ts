import {
    getDefaultTexConfig,
    getDefaultVerbEnvConfig,
} from '$config/defaults.js';
import { texBaseCommand, type TexLogSeverity } from '$data/tex.js';
import {
    readFile as nodeReadFile,
    readFileSync,
    resolve,
    rimraf,
    spawn,
    uuid,
    writeFile,
} from '$deps.js';
import { TexHandler } from '$handlers/TexHandler.js';
import { spy } from '$tests/unit/fixtures.js';
import { cartesianProduct } from '$tests/unit/utils.js';
import { supportedTexEngines } from '$typeGuards/verbatim.js';
import type { SupportedTexEngine } from '$types/SveltexConfiguration.js';
import type { Problem } from '$types/handlers/Tex.js';
import { VerbEnvConfigTex } from '$types/handlers/Verbatim.js';
import { CliInstruction } from '$types/utils/CliInstruction.js';
import {
    TexComponent,
    enactPresets,
    extendedPreamble,
    parseLatexLog,
    printLogProblems,
} from '$utils/TexComponent.js';
import { fs, pathExists } from '$utils/fs.js';
import { mergeConfigs } from '$utils/merge.js';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

function realSpawnCliInstruction(
    instr: CliInstruction,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    const silent = instr.silent ?? false;
    let stdout = '';
    let stderr = '';
    const instrOpts: Partial<CliInstruction> = { ...instr };
    delete instrOpts.command;
    delete instrOpts.args;
    delete instrOpts.env;
    delete instrOpts.silent;
    const spawnedProcess = spawn(instr.command, instr.args, {
        ...instrOpts,
        env: { ...process.env, ...instr.env },
    });
    return new Promise((resolve) => {
        spawnedProcess.stdout.on('data', (x) => {
            if (typeof x === 'string' || x instanceof Uint8Array) {
                stdout += x.toString();
                if (!silent) process.stdout.write(x.toString());
            }
        });
        spawnedProcess.stderr.on('data', (x) => {
            if (typeof x === 'string' || x instanceof Uint8Array) {
                stderr += x.toString();
                if (!silent) process.stderr.write(x.toString());
            }
        });
        spawnedProcess.on('exit', (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}

// let ath: TexHandler;
// let tc: TexComponent;

const defaultConfig = getDefaultVerbEnvConfig('tex');

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });
}

vi.restoreAllMocks();
// let log: MockInstance;
// let readFile: MockInstance;
// let existsSync: MockInstance;
beforeAll(async () => {
    vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
        start: vi.fn().mockReturnValue({
            stop: vi.fn(),
            text: vi.fn(),
            succeed: vi.fn(),
            fail: vi.fn(),
        }),
    })) as unknown as typeof import('ora').default);
    // const mocks = await spy(
    //     ['writeFile', 'log', 'spawnCliInstruction', 'readFile', 'existsSync'],
    //     false,
    // );
    // log = mocks.log;
    // readFile = mocks.readFile;
    // existsSync = mocks.existsSync;
    // log.mockImplementation(() => undefined);
});
afterAll(async () => {
    vi.restoreAllMocks();
    if (pathExists(`tmp/tests`)) {
        await rimraf(resolve(`tmp/tests`));
    }
});

describe('(setter) configuration', () => {
    fixture();
    it('should correctly set configuration', async () => {
        const ath = await TexHandler.create();
        const tc = TexComponent.create({
            filename: 'file.sveltex',
            texHandler: ath,
            attributes: { ref: 'ref' },
            tex: '',
            config: defaultConfig,
            tag: 'tex',
        });
        tc.configuration = {
            type: 'tex',
            aliases: ['SomethingElse'],
        };
        expect(tc.configuration.aliases).toEqual(['SomethingElse']);
    });
});

describe('(getter) documentClass', () => {
    fixture();
    it("'standalone' → '\\documentclass[dvisvgm]{standalone}'", async () => {
        const ath = await TexHandler.create();
        const config = getDefaultVerbEnvConfig('tex');
        config.documentClass = 'standalone';
        const tc = TexComponent.create({
            filename: 'file.sveltex',
            texHandler: ath,
            attributes: { ref: 'ref' },
            tex: '',
            config,
            tag: 'tex',
        });
        expect(tc.documentClass).toEqual(
            '\\documentclass[dvisvgm]{standalone}',
        );
    });
    it("{} → '\\documentclass[dvisvgm]{standalone}'", async () => {
        const ath = await TexHandler.create();
        const tc = TexComponent.create({
            filename: 'file.sveltex',
            texHandler: ath,
            attributes: { ref: 'ref' },
            tex: '',
            config: { type: 'tex', documentClass: 'standalone' },
            tag: 'tex',
        });
        tc.configuration.documentClass = {};
        expect(tc.documentClass).toEqual(
            '\\documentclass[dvisvgm]{standalone}',
        );
    });
});

// TODO: the problem has to do with verbosity prop in all likelihood
describe('compile(): catches errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    // TODO: figure out why this test has to be the first one in this describe
    // block.
    it('DVI/PDF → SVG (poppler) (unknown error)', async () => {
        vi.restoreAllMocks();
        vi.doMock(
            'node-poppler',
            async (orig: () => Promise<typeof import('node-poppler')>) => {
                return {
                    ...(await orig()),
                    Poppler: vi.fn().mockImplementation(() => {
                        throw new Error('031bbd43-4445-4976-bd3a-e46147f5bb3d');
                    }),
                };
            },
        );
        const { log } = await spy(['log']);
        const id = uuid();
        const ref = 'ref';
        const texHandler = await TexHandler.create({
            caching: { cacheDirectory: `tmp/tests/${id}/cache` },
            conversion: { outputDirectory: `tmp/tests/${id}/output` },
            debug: { verbosity: 'all' },
        });
        await texHandler.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: mergeConfigs(defaultConfig, {
                overrides: { conversion: { converter: 'poppler' } },
            }),
        });
        expect(log).toHaveBeenCalled();
        expect(log).toHaveBeenLastCalledWith(
            { severity: 'error', style: 'dim' },
            expect.stringContaining('031bbd43-4445-4976-bd3a-e46147f5bb3d'),
        );
        vi.doUnmock('node-poppler');
    });

    it.each([
        [''],
        [" (verbosity: 'error')", { verbosity: { onFailure: 'error' } }],
        [' (custom)', { custom: true }],
    ] as [string, Record<string, unknown>?][])(
        'TeX → DVI/PDF (child process)%s',
        async (_label, opts) => {
            const { spawnCliInstruction, log } = await spy(
                ['writeFile', 'spawnCliInstruction', 'log'],
                false,
            );
            log.mockImplementation(() => undefined);
            const id = uuid();
            const ref = 'ref';
            const ath = await TexHandler.create({
                caching: { cacheDirectory: `tmp/tests/${id}/cache` },
                conversion: { outputDirectory: `tmp/tests/${id}/output` },
                debug: { verbosity: opts?.['verbosity'] ?? 'all' },
                compilation: {
                    overrideCompilation: opts?.['custom']
                        ? () => ({ command: 'false' })
                        : null,
                },
            });
            if (!opts?.['custom']) {
                spawnCliInstruction.mockResolvedValueOnce({
                    code: 1,
                    stdout: '! example error\n',
                    stderr: 'example stderr',
                });
            }
            await ath.process('$x$', {
                attributes: { ref },
                filename: `file-${ref}.sveltex`,
                selfClosing: false,
                tag: 'tex',
                config: defaultConfig,
            });
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith(
                opts?.['verbosity']
                    ? 'error'
                    : { severity: 'error', style: 'dim' },
                expect.stringMatching(/example|no stderr/),
            );
        },
    );

    it('TeX → DVI/PDF (unknown error)', async () => {
        const id = uuid();
        const ref = 'ref';
        const ath = await TexHandler.create({
            caching: {
                cacheDirectory: `tmp/tests/${id}/cache`,
            },
            conversion: {
                outputDirectory: `tmp/tests/${id}/output`,
            },
        });
        const { spawnCliInstruction, log } = await spy(
            ['writeFile', 'spawnCliInstruction', 'log'],
            false,
        );
        log.mockImplementation(() => undefined);
        spawnCliInstruction.mockImplementationOnce(() => {
            throw new Error();
        });
        await ath.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: defaultConfig,
        });
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
            'error',
            `✖ Error while compiling tmp/tests/${id}/cache/tex/ref/root.tex:\n\n`,
            expect.stringContaining('Error'),
        );
    });

    it.each(['', ' (custom)'])(
        'DVI/PDF → SVG (child process)%s',
        async (custom) => {
            const id = uuid();
            const ref = 'ref';
            const ath = await TexHandler.create({
                caching: {
                    cacheDirectory: `tmp/tests/${id}/cache`,
                },
                conversion: {
                    outputDirectory: `tmp/tests/${id}/output`,
                    overrideConversion: custom
                        ? () => ({
                              command: 'false',
                          })
                        : null,
                },
            });
            const {
                writeFile,
                spawnCliInstruction: spawnCliInstructionMock,
                readFile,
                log,
            } = await spy(
                ['writeFile', 'spawnCliInstruction', 'readFile', 'log'],
                false,
            );
            log.mockImplementation(() => undefined);
            if (!custom) {
                readFile.mockResolvedValueOnce('test-pdf');
                spawnCliInstructionMock.mockImplementation(
                    async (instr: CliInstruction) => {
                        if (instr.command === 'dvisvgm') {
                            return Promise.resolve({
                                code: 1,
                                stdout: 'example stdout',
                                stderr: 'example stderr',
                            });
                        }
                        return realSpawnCliInstruction(instr);
                    },
                );
            }
            await ath.process('$x$', {
                attributes: { ref },
                filename: `file-${ref}.sveltex`,
                selfClosing: false,
                tag: 'tex',
                config: defaultConfig,
            });
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
                `tmp/tests/${id}/cache/cache.json`,
                expect.stringMatching(
                    /{"int":{"tex\/ref":{"sourceHash":"[\w-]{43}","hash":"[\w-]{43}"}},"svg":{}}/,
                ),
                'utf8',
            );
        },
    );

    it('no DVI/PDF found', { timeout: 1e9 }, async () => {
        const { writeFile, log } = await spy(['writeFile', 'log'], false);
        log.mockImplementation(() => undefined);
        const id = uuid();
        const ref = 'ref';
        const ath = await TexHandler.create({
            caching: { cacheDirectory: `tmp/tests/${id}/cache` },
            conversion: { outputDirectory: `tmp/tests/${id}/output` },
            debug: { verbosity: 'all' },
            compilation: {
                overrideCompilation: () => ({
                    command: 'true',
                }),
            },
        });
        await ath.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: defaultConfig,
        });
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
            'error',
            expect.stringContaining('Error while compiling'),
            expect.stringContaining('Error: ENOENT: no such file or directory'),
        );

        expect(writeFile).toHaveBeenCalled();
        expect(writeFile).toHaveBeenLastCalledWith(
            `tmp/tests/${id}/cache/tex/ref/root.tex`,
            '\\documentclass[dvisvgm]{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\n\n\\begin{document}\n$x$\n\\end{document}\n',
            'utf8',
        );
    });

    it('no SVG found', async () => {
        const { writeFile, log } = await spy(['writeFile', 'log'], false);
        log.mockImplementation(() => undefined);
        const id = uuid();
        const ref = 'ref';
        const ath = await TexHandler.create({
            caching: {
                cacheDirectory: `tmp/tests/${id}/cache`,
            },
            conversion: {
                outputDirectory: `tmp/tests/${id}/output`,
                overrideConversion: () => ({ command: 'true' }),
            },
        });
        await ath.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: defaultConfig,
        });
        expect(log).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(
            'error',
            expect.stringContaining(`tmp/tests/${id}/cache/tex/ref/root.dvi`),
            expect.stringContaining('Error: ENOENT: no such file or directory'),
        );
        expect(log).toHaveBeenCalledWith(
            'info',
            expect.stringMatching(
                /deleting.*\/tmp\/tests\/.{1,100}\/cache\/tex\//i,
            ),
        );
        expect(writeFile).toHaveBeenCalled();
        expect(writeFile).toHaveBeenLastCalledWith(
            `tmp/tests/${id}/cache/cache.json`,
            expect.stringMatching(
                /{"int":{"tex\/ref":{"sourceHash":".+?","hash":".+?"}},"svg":{}}/,
            ),
            'utf8',
        );
    });

    it('empty SVG found', async () => {
        const { writeFile, log } = await spy(['writeFile', 'log'], false);
        log.mockImplementation(() => undefined);
        const id = uuid();
        const ref = 'ref';
        const ath = await TexHandler.create({
            caching: { cacheDirectory: `tmp/tests/${id}/cache` },
            conversion: {
                outputDirectory: `tmp/tests/${id}/output`,
                overrideConversion: (opts) => ({
                    command: 'touch',
                    args: [opts.output.path],
                }),
            },
        });
        await ath.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: defaultConfig,
        });
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(
            1,
            'error',
            expect.stringContaining(
                `✖ Error converting tmp/tests/${id}/cache/tex/ref/root.dvi`,
            ),
            expect.stringMatching(/svg.+empty|empty.+svg/isu),
        );
        expect(log).toHaveBeenNthCalledWith(
            2,
            'info',
            expect.stringMatching(
                /Deleting unused cache subdirectory: .*\/tmp\/tests\/.{1,100}\/cache\/tex\//,
            ),
        );
        expect(writeFile).toHaveBeenCalled();
        expect(writeFile).toHaveBeenCalledWith(
            `tmp/tests/${id}/cache/tex/ref/root.tex`,
            '\\documentclass[dvisvgm]{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\n\n\\begin{document}\n$x$\n\\end{document}\n',
            'utf8',
        );
        expect(writeFile).toHaveBeenLastCalledWith(
            `tmp/tests/${id}/cache/cache.json`,
            expect.stringMatching(
                /{"int":{"tex\/ref":{"sourceHash":".+?","hash":".+?"}},"svg":{}}/,
            ),
            'utf8',
        );
    });

    it('SVG → Svelte (custom)', async () => {
        const { writeFile, log } = await spy(['writeFile', 'log'], false);
        log.mockImplementation(() => undefined);
        const id = uuid();
        const ref = 'ref';
        const ath = await TexHandler.create({
            caching: {
                cacheDirectory: `tmp/tests/${id}/cache`,
            },
            conversion: {
                outputDirectory: `tmp/tests/${id}/output`,
            },
            optimization: {
                overrideOptimization: () => {
                    throw new Error('ff20af51-f07d-4304-b5e7-eaaf38af3796');
                },
            },
        });
        await ath.process('$x$', {
            attributes: { ref },
            filename: `file-${ref}.sveltex`,
            selfClosing: false,
            tag: 'tex',
            config: defaultConfig,
        });
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(
            1,
            'error',
            expect.stringContaining(
                `✖ Error optimizing tmp/tests/${id}/output/tex/ref.svg`,
            ),
            expect.stringContaining('ff20af51-f07d-4304-b5e7-eaaf38af3796'),
        );
        expect(log).toHaveBeenNthCalledWith(
            2,
            'info',
            expect.stringMatching(
                /Deleting unused cache subdirectory: .*\/tmp\/tests\/.{1,100}\/cache\/tex\//,
            ),
        );
        expect(writeFile).toHaveBeenCalled();
        expect(writeFile).toHaveBeenCalledWith(
            `tmp/tests/${id}/cache/tex/ref/root.tex`,
            '\\documentclass[dvisvgm]{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\n\n\\begin{document}\n$x$\n\\end{document}\n',
            'utf8',
        );
        expect(writeFile).toHaveBeenLastCalledWith(
            `tmp/tests/${id}/cache/cache.json`,
            expect.stringMatching(
                /{"int":{"tex\/ref":{"sourceHash":".+?","hash":".+?"}},"svg":{}}/,
            ),
            'utf8',
        );
    });
});

describe('TexHandler.process()', () => {
    fixture();
    describe('error handling', () => {
        fixture();
        fixture();
        it.each([{}, { ref: '' }])(
            'should throw an error if no ref attribte is provided',
            async (attributes) => {
                const id = uuid();
                const ath = await TexHandler.create({
                    caching: {
                        cacheDirectory: `tmp/tests/${id}/cache`,
                    },
                    conversion: {
                        outputDirectory: `tmp/tests/${id}/output`,
                    },
                });
                await expect(
                    async () =>
                        await ath.process('content', {
                            tag: 'tex',
                            attributes,
                            filename: 'TexComponent_test_ts.sveltex',
                            selfClosing: false,
                            config: defaultConfig,
                        }),
                ).rejects.toThrowError(/ref.*attribute/isu);
            },
        );
    });

    describe('compile (poppler)', () => {
        fixture();
        it('should work', async () => {
            const id = uuid();

            const ath = await TexHandler.create({
                caching: {
                    cacheDirectory: `tmp/tests/${id}/cache`,
                },
                conversion: {
                    outputDirectory: `tmp/tests/${id}/output`,
                },
                debug: { verbosity: 'box' },
            });
            const { writeFile, spawnCliInstruction, log } = await spy(
                ['writeFile', 'spawnCliInstruction', 'log'],
                false,
            );
            await ath.process('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
                config: mergeConfigs(
                    { tag: 'tex', ...defaultConfig },
                    {
                        overrides: {
                            compilation: { intermediateFiletype: 'pdf' },
                            conversion: { converter: 'poppler' },
                            optimization: { currentColor: '#000' },
                        },
                        documentClass: 'standalone',
                    },
                ),
            });
            expect(log).not.toHaveBeenCalled();
            expect(spawnCliInstruction).toHaveBeenCalledTimes(1);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                args: [
                    '-output-format=pdf',
                    '-no-shell-escape',
                    '-interaction=nonstopmode',
                    'root.tex',
                ],
                command: 'pdflatex',
                cwd: `tmp/tests/${id}/cache/tex/ref`,
                env: { SOURCE_DATE_EPOCH: '1' },
                silent: true,
            });
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(writeFile).toHaveBeenNthCalledWith(
                1,
                `tmp/tests/${id}/cache/tex/ref/root.tex`,
                '\\documentclass{standalone}\n\\usepackage{microtype}\n\\makeatletter\n\\@ifpackageloaded{xcolor}{}{\\usepackage{xcolor}}\n\\makeatother\n\n\n\n\\begin{document}\ntest\n\\end{document}\n',
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `tmp/tests/${id}/output/tex/ref.svg`,
                expect.stringMatching(/^<svg fill="currentColor"/),
                'utf8',
            );
            expect(writeFile).toHaveBeenNthCalledWith(
                3,
                `tmp/tests/${id}/cache/cache.json`,
                expect.stringMatching(
                    /{"int":{"tex\/ref":{"sourceHash":"[\w-]{43}","hash":"([\w-]{43})"}},"svg":{"tex\/ref":{"sourceHash":"\1"}}}/,
                ),
                'utf8',
            );
            writeFile.mockRestore();
            spawnCliInstruction.mockRestore();
        });
    });

    describe('compileCmd', () => {
        fixture();
        it('should add the right output flags for lualatexmk (pdf)', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                tag: 'tex',
                config: mergeConfigs(
                    { tag: 'tex', ...defaultConfig },
                    {
                        overrides: {
                            compilation: {
                                engine: 'lualatexmk',
                                intermediateFiletype: 'pdf',
                                saferLua: true,
                            },
                        },
                    },
                ),
                texHandler,
                tex: 'test',
            });
            expect(tc.compileCmd.args).toContain('-safer');
            expect(tc.compileCmd.args).toContain('-pdflua');
            tc.configuration.overrides.compilation = {
                engine: 'lualatexmk',
                intermediateFiletype: 'dvi',
                saferLua: true,
            };
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
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                tag: 'tex',
                config: mergeConfigs(
                    { tag: 'tex', ...defaultConfig },
                    {
                        overrides: {
                            compilation: {
                                engine: data.engine ?? 'lualatex',
                                [data.option]: data.value,
                            },
                        },
                    },
                ),
                tex: 'test',
                texHandler,
            });
            expect(tc.compileCmd.args).toContain(data.flag);
        });
    });
});

describe.concurrent('compile()', () => {
    describe("ref with '/'s", () => {
        fixture();
        it('ref/a/b/c', async () => {
            const id = uuid();
            const ref = 'ref/a/b/c';
            const ath = await TexHandler.create({
                caching: {
                    cacheDirectory: `tmp/tests/${id}/cache`,
                },
                conversion: {
                    outputDirectory: `tmp/tests/${id}/output`,
                },
            });
            const config = getDefaultVerbEnvConfig('tex');
            await ath.process('f12b4544-19b9-4637-a708-7d6f257e976d', {
                attributes: { ref },
                filename: `file-${ref}.sveltex`,
                selfClosing: false,
                tag: 'tex',
                config,
            });
            expect(
                await nodeReadFile(
                    `tmp/tests/${id}/output/tex/${ref}.svelte`,
                    'utf8',
                ),
            ).toContain('f12b4544-19b9-4637-a708-7d6f257e976d');
        });
    });

    describe('tikz', () => {
        describe('gradients', () => {
            fixture();
            it.each([
                ...cartesianProduct(
                    [...supportedTexEngines],
                    ['dvi'],
                    ['dvisvgm'],
                ),
                ...cartesianProduct(
                    [...supportedTexEngines],
                    ['pdf'],
                    ['poppler'],
                ),
            ])(
                '%s (%s) + %s',
                { timeout: 10e3 },
                async (engine, intermediateFiletype, converter) => {
                    const id = uuid();
                    const ref = 'ref';
                    const ath = await TexHandler.create({
                        caching: {
                            cacheDirectory: `tmp/tests/${id}/cache`,
                        },
                        conversion: {
                            outputDirectory: `tmp/tests/${id}/output`,
                        },
                    });
                    const config = mergeConfigs(
                        getDefaultVerbEnvConfig('tex'),
                        {
                            overrides: {
                                compilation: {
                                    engine,
                                    intermediateFiletype,
                                },
                                conversion: { converter },
                            },
                            preset: {
                                name: 'tikz',
                                libraries: { shadings: true },
                            },
                        } as VerbEnvConfigTex,
                    );
                    await ath.process(
                        [
                            '',
                            '\\begin{tikzpicture}',
                            '\\fill [ left color = red, right color = blue ] (0,0) rectangle (1,1);',
                            '\\end{tikzpicture}',
                        ].join('\n'),
                        {
                            attributes: { ref },
                            filename: `file-${ref}.sveltex`,
                            selfClosing: false,
                            tag: 'tex',
                            config,
                        },
                    );
                    expect(
                        await nodeReadFile(
                            `tmp/tests/${id}/output/tex/${ref}.svelte`,
                            'utf8',
                        ),
                    ).toMatch(
                        /^<svg .*<linearGradient .*<stop .*stop-color="\s*(blue|#00F|#0000FF)\s*".*stop-color="\s*(red|#F00|#FF0000)\s*"/is,
                    );
                },
            );
        });

        describe('transparency', () => {
            it.each([
                ...cartesianProduct(
                    [...supportedTexEngines],
                    ['dvi'],
                    ['dvisvgm'],
                ),
                ...cartesianProduct(
                    [...supportedTexEngines],
                    ['pdf'],
                    ['poppler'],
                ),
            ])(
                '%s (%s) + %s',
                { timeout: 10e3 },
                async (engine, intermediateFiletype, converter) => {
                    const id = uuid();
                    const ref = 'ref';
                    const ath = await TexHandler.create({
                        caching: {
                            cacheDirectory: `tmp/tests/${id}/cache`,
                        },
                        conversion: {
                            outputDirectory: `tmp/tests/${id}/output`,
                        },
                    });
                    const config = mergeConfigs(
                        getDefaultVerbEnvConfig('tex'),
                        {
                            overrides: {
                                compilation: {
                                    engine,
                                    intermediateFiletype,
                                },
                                conversion: { converter },
                            },
                            preset: {
                                name: 'tikz',
                                libraries: { shadings: true },
                            },
                        } as VerbEnvConfigTex,
                    );
                    await ath.process(
                        [
                            '\\begin{tikzpicture}[thick, fill opacity=0.5]',
                            '\\filldraw[fill=red]   (0:1cm)    circle (12mm);',
                            '\\filldraw[fill=green] (120:1cm)  circle (12mm);',
                            '\\filldraw[fill=blue]  (-120:1cm) circle (12mm);',
                            '\\end{tikzpicture}',
                        ].join('\n'),
                        {
                            attributes: { ref },
                            filename: `file-${ref}.sveltex`,
                            selfClosing: false,
                            tag: 'tex',
                            config,
                        },
                    );
                    expect(
                        await nodeReadFile(
                            `tmp/tests/${id}/output/tex/${ref}.svelte`,
                            'utf8',
                        ),
                    ).toMatch(/^<svg .*fill-opacity\s*=\s*"\s*0.5\s*"/is);
                },
            );
        });
    });

    describe.sequential(
        // eslint-disable-next-line vitest/valid-describe-callback
        'caching',
        { timeout: 300e3, sequential: true, retry: 2 },
        () => {
            fixture();
            it.each([
                ...cartesianProduct(
                    ['pdflatex', 'lualatex', 'xelatex'],
                    ['pdf', 'dvi'],
                    ['dvisvgm'],
                ),
                ...cartesianProduct(
                    [...supportedTexEngines],
                    ['pdf'],
                    ['poppler'],
                ),
            ])(
                '%s (%s) + %s',
                { retry: 2 },
                async (engine, intermediateFiletype, converter) => {
                    const { writeFile, spawnCliInstruction, log } = await spy(
                        ['writeFile', 'spawnCliInstruction', 'log'],
                        false,
                    );
                    log.mockReset();
                    const id = uuid();
                    const ref = 'ref';

                    // Create some unused cache subdirectories
                    await fs.writeFileEnsureDir(
                        `tmp/tests/${id}/cache/test/test1.tex`,
                        'test1',
                    );
                    await fs.writeFileEnsureDir(
                        `tmp/tests/${id}/cache/a/b/c/test2.tex`,
                        'test2',
                    );
                    await fs.writeFileEnsureDir(
                        `tmp/tests/${id}/cache/tex/${ref}/a/b/c/test3.tex`,
                        'test3',
                    );

                    vi.clearAllMocks();

                    const ath = await TexHandler.create({
                        caching: { cacheDirectory: `tmp/tests/${id}/cache` },
                        conversion: {
                            outputDirectory: `tmp/tests/${id}/output`,
                        },
                    });
                    const config = mergeConfigs(
                        getDefaultVerbEnvConfig('tex'),
                        {
                            overrides: {
                                compilation: { engine, intermediateFiletype },
                                conversion: { converter },
                            },
                        },
                    );
                    await ath.process('$x$', {
                        attributes: { ref },
                        filename: `file-${ref}.sveltex`,
                        selfClosing: false,
                        tag: 'tex',
                        config,
                    });

                    // Compile
                    //
                    // Regular run:
                    // 1. 1st `writeFile`, for `cache.json` file.
                    // 2. Svelte → TeX: 2nd `writeFile`, for `.tex` file.
                    // 3. TeX → DVI/PDF: 1st `spawnCliInstruction`, for TeX
                    //    engine.
                    // 4. DVI/PDF → SVG: Now it splits into two branches:
                    //   - dvisvgm:
                    //     1. 2nd `spawnCliInstruction`, for conversion with
                    //        dvisvgm.
                    //     2. 1st `readFile`, for `.svg` file.
                    //   - Poppler:
                    //     1. Conversion with Poppler via `node-poppler`.
                    // 5. SVG → Svelte:
                    //     1. Optimization with SVGO.
                    //     2. 3rd `writeFile`, for `.svg` file.
                    //     3. Rename file via `node:fs`.
                    // 6. 4th `writeFile`, to write cache to `cache.json`.
                    expect(writeFile).toHaveBeenCalledTimes(4);
                    expect(writeFile).toHaveBeenNthCalledWith(
                        1,
                        `tmp/tests/${id}/cache/cache.json`,
                        expect.stringMatching(/{"int":{},"svg":{}}/is),
                        'utf8',
                    );
                    expect(writeFile).toHaveBeenNthCalledWith(
                        2,
                        `tmp/tests/${id}/cache/tex/${ref}/root.tex`,
                        expect.stringContaining('\\documentclass'),
                        'utf8',
                    );
                    expect(writeFile).toHaveBeenNthCalledWith(
                        3,
                        `tmp/tests/${id}/output/tex/${ref}.svg`,
                        expect.stringContaining('<svg'),
                        'utf8',
                    );
                    expect(writeFile).toHaveBeenNthCalledWith(
                        4,
                        `tmp/tests/${id}/cache/cache.json`,
                        expect.stringMatching(
                            new RegExp(
                                `{"int":{"tex/${ref}":{"sourceHash":"[\\w-]{43}","hash":"([\\w-]{43})"}},"svg":{"tex/${ref}":{"sourceHash":"\\1"}}}`,
                            ),
                        ),
                        'utf8',
                    );

                    expect(spawnCliInstruction).toHaveBeenCalledTimes(
                        1 + +(converter === 'dvisvgm'),
                    );
                    expect(spawnCliInstruction).toHaveBeenNthCalledWith(
                        1,
                        expect.objectContaining({
                            command:
                                texBaseCommand[engine as SupportedTexEngine],
                        }),
                    );

                    // const existsSync = await spy('existsSync');
                    // existsSync.mockImplementation(
                    //     (path: string) =>
                    //         !!path.match(/\.(tex|dvi|svelte)$/),
                    // );

                    expect(log).toHaveBeenCalledTimes(3);
                    expect(log).toHaveBeenNthCalledWith(
                        1,
                        'info',
                        expect.stringMatching(
                            /^Deleting unused cache subdirectory: .*\/tmp\/tests\/[\w-]{36}\/cache\/test\/?$/,
                        ),
                    );
                    expect(log).toHaveBeenNthCalledWith(
                        2,
                        'info',
                        expect.stringMatching(
                            /^Deleting unused cache subdirectory: .*\/tmp\/tests\/[\w-]{36}\/cache\/a\/?$/,
                        ),
                    );
                    expect(log).toHaveBeenNthCalledWith(
                        3,
                        'info',
                        expect.stringMatching(
                            /^Deleting unused cache subdirectory: .*\/tmp\/tests\/[\w-]{36}\/cache\/tex\/ref\/a(\/?)$/,
                        ),
                    );

                    vi.clearAllMocks();

                    // Everything as before => no compilation.
                    await ath.process('$x$', {
                        attributes: { ref },
                        filename: `file-${ref}.sveltex`,
                        selfClosing: false,
                        tag: 'tex',
                        config,
                    });

                    expect(writeFile).toHaveBeenCalledTimes(0);
                    expect(spawnCliInstruction).toHaveBeenCalledTimes(0);
                    expect(log).toHaveBeenCalledTimes(0);

                    vi.clearAllMocks();

                    // Different .tex hash, same PDF content & hash => compilation, but
                    // no conversion.
                    await ath.process('$x$%', {
                        attributes: { ref },
                        filename: `file-${ref}.sveltex`,
                        selfClosing: false,
                        tag: 'tex',
                        config,
                    });

                    expect(log).toHaveBeenCalledTimes(0);
                    expect(writeFile).toHaveBeenCalledTimes(2);
                    expect(writeFile).toHaveBeenNthCalledWith(
                        1,
                        `tmp/tests/${id}/cache/tex/${ref}/root.tex`,
                        expect.stringContaining('\\documentclass'),
                        'utf8',
                    );
                    expect(writeFile).toHaveBeenNthCalledWith(
                        2,
                        `tmp/tests/${id}/cache/cache.json`,
                        expect.stringMatching(
                            new RegExp(
                                `{"int":{"tex/${ref}":{"sourceHash":"[\\w-]{43}","hash":"([\\w-]{43})"}},"svg":{"tex/${ref}":{"sourceHash":"\\1"}}}`,
                            ),
                        ),
                        'utf8',
                    );
                    expect(spawnCliInstruction).toHaveBeenCalledTimes(1);
                    expect(spawnCliInstruction).toHaveBeenNthCalledWith(
                        1,
                        expect.objectContaining({
                            command:
                                texBaseCommand[engine as SupportedTexEngine],
                        }),
                    );
                    vi.restoreAllMocks();
                },
            );
        },
    );

    describe.sequential('overriding commands', () => {
        fixture();
        it('overrideCompilation, overrideConversion, and overrideOptimization', async () => {
            const id = uuid();
            const ath = await TexHandler.create({
                caching: { cacheDirectory: `tmp/tests/${id}/cache` },
                conversion: {
                    outputDirectory: `tmp/tests/${id}/output`,
                },
            });
            const { writeFile, spawnCliInstruction, readFile } = await spy(
                ['writeFile', 'spawnCliInstruction', 'readFile'],
                false,
            );
            readFile
                .mockResolvedValueOnce('test-pdf')
                .mockResolvedValueOnce('test-svg');

            await ath.process('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
                config: mergeConfigs({ tag: 'tex', ...defaultConfig }, {
                    type: 'tex',
                    overrides: {
                        compilation: {
                            overrideCompilation: (opts) => ({
                                command: 'touch',
                                args: [opts.output.path],
                            }),
                        },
                        conversion: {
                            overrideConversion: (opts) => ({
                                command: 'touch',
                                args: [opts.output.path],
                            }),
                        },
                        optimization: {
                            overrideOptimization: () => 'optimized svg',
                        },
                    },
                } as VerbEnvConfigTex),
            });
            // expect(log).not.toHaveBeenCalled();
            expect(spawnCliInstruction).toHaveBeenCalledTimes(2);
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(1, {
                command: 'touch',
                args: [`tmp/tests/${id}/cache/tex/ref/root.dvi`],
            });
            expect(spawnCliInstruction).toHaveBeenNthCalledWith(2, {
                command: 'touch',
                args: [`tmp/tests/${id}/output/tex/ref.svg`],
                silent: true,
            });
            expect(writeFile).toHaveBeenCalledTimes(3);
            expect(writeFile).toHaveBeenNthCalledWith(
                2,
                `tmp/tests/${id}/output/tex/ref.svg`,
                'optimized svg',
                'utf8',
            );
            vi.restoreAllMocks();
        });
    });
});

describe('extendedPreamble()', () => {
    fixture();
    describe('tikz', () => {
        it('loads tikz graphdrawing libraries if necessary', async () => {
            const { log } = await spy(['log']);
            const verbEnvConfig = getDefaultVerbEnvConfig('tex');
            const texConfig = getDefaultTexConfig();
            texConfig.compilation.engine = 'lualatex';
            verbEnvConfig.preset = {
                name: 'tikz',
                libraries: { graphdrawing: { routing: true } },
            };
            expect(extendedPreamble(verbEnvConfig, texConfig)).toMatch(
                /\\usepackage{tikz}.*\\usetikzlibrary{.*graphdrawing.*}.*\\usegdlibrary{routing}/is,
            );
            expect(log).not.toHaveBeenCalled();
        });
    });
});

describe('enactPresets()', () => {
    fixture();
    describe('tikz: graphdrawing', () => {
        it("complains if engine isn't LuaTeX", async () => {
            const { log } = await spy(['log']);
            const verbEnvConfig = getDefaultVerbEnvConfig('tex');
            const texConfig = getDefaultTexConfig();
            texConfig.compilation.engine = 'pdflatex';
            verbEnvConfig.preset = {
                name: 'tikz',
                libraries: { graphdrawing: { routing: true } },
            };
            expect(enactPresets(verbEnvConfig, texConfig)).toMatchObject({
                packages: ['tikz'],
                tikzlibraries: ['babel', 'arrows.meta', 'calc'],
                gdlibraries: [],
            });
            expect(log).toHaveBeenCalledWith(
                'error',
                'Graph drawing libraries require "compilation.engine" to be "lualatex" or "lualatexmk". Instead, got: \'pdflatex\' Ignoring graph drawing libraries.',
            );
        });

        it('works if engine is LuaTeX', async () => {
            const log = await spy('log');
            const verbEnvConfig = getDefaultVerbEnvConfig('tex');
            const texConfig = getDefaultTexConfig();
            texConfig.compilation.engine = 'lualatex';
            verbEnvConfig.preset = {
                name: 'tikz',
                libraries: { graphdrawing: { routing: true } },
            };
            expect(enactPresets(verbEnvConfig, texConfig)).toMatchObject({
                packages: ['tikz'],
                tikzlibraries: ['graphdrawing', 'babel', 'arrows.meta', 'calc'],
                gdlibraries: ['routing'],
            });
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('tikz: fixedpointarithmetic', () => {
        it('adds fp to packages array', () => {
            const verbEnvConfig = getDefaultVerbEnvConfig('tex');
            const texConfig = getDefaultTexConfig();
            texConfig.compilation.engine = 'pdflatex';
            verbEnvConfig.preset = {
                name: 'tikz',
                libraries: { fixedpointarithmetic: true },
            };
            expect(enactPresets(verbEnvConfig, texConfig)).toMatchObject({
                packages: ['tikz', 'fp'],
                tikzlibraries: [
                    'babel',
                    'arrows.meta',
                    'calc',
                    'fixedpointarithmetic',
                ],
                gdlibraries: [],
            });
        });
    });
});

describe('printLogProblems()', () => {
    it.each([
        [
            'respects verbosity setting',
            [{ line: 1, message: 'something', severity: 'info' }],
            {},
            'none',
        ],
        [
            'logs errors',
            [{ line: 1, message: 'something', severity: 'error' }],
            { error: 1 },
            'info',
        ],
        [
            'logs warnings',
            [{ line: 1, message: 'something', severity: 'warn' }],
            { warn: 1 },
            'info',
        ],
        [
            'logs boxes',
            [{ line: 1, message: 'something', severity: 'box' }],
            { box: 1 },
            'info',
        ],
        [
            'logs info',
            [{ line: 1, message: 'something', severity: 'info' }],
            { info: 1 },
            'info',
        ],
        [
            'logs info (with column)',
            [{ line: 1, col: 2, message: 'something', severity: 'info' }],
            { info: 1 },
            'info',
        ],
        [
            'ignores specified log messages',
            [
                { line: 1, message: 'something', severity: 'info' },
                { line: 1, message: 'a 123 b', severity: 'info' },
            ],
            {},
            'info',
            ['something', /\d+/],
        ],
    ] as [
        string,
        Problem[],
        { warn?: number; error?: number; box?: number; info?: number },
        ('all' | TexLogSeverity | 'none')?,
        (string | RegExp)[]?,
    ][])(
        '%s',
        async (_label, problems, expected, verbosity, ignoreLogMessages) => {
            const log = await spy('log');
            const prints: unknown[][] = [];
            log.mockImplementation((...args) => prints.push(args));
            printLogProblems(
                problems,
                verbosity ?? 'box',
                '',
                ignoreLogMessages ?? [],
            );
            const errors = expected.error ?? 0;
            const warns = expected.warn ?? 0;
            const boxes = expected.box ?? 0;
            const infos = expected.info ?? 0;
            const total = errors + warns + boxes + infos;
            expect(log).toHaveBeenCalledTimes(total);
            expect(prints.filter((args) => args[0] === 'error')).toHaveLength(
                errors,
            );
            expect(prints.filter((args) => args[0] === 'warn')).toHaveLength(
                warns,
            );
            expect(prints.filter((args) => args[0] === 'box')).toHaveLength(
                boxes,
            );
            expect(prints.filter((args) => args[0] === 'info')).toHaveLength(
                infos,
            );
        },
    );
});

describe('parseLatexLog()', () => {
    describe('real log files', () => {
        it.each([
            ['basic.log', 'basic.json'],
            ['gradient.log', 'gradient.json'],
            ['plot.log', 'plot.json'],
            ['text.log', 'text.json'],
            ['transparency.log', 'transparency.json'],
            ['gradient-error.log', 'gradient-error.json'],
            ['text-error.log', 'text-error.json'],
            ['overfull-error.log', 'overfull-error.json'],
            ['underfull-error.log', 'underfull-error.json'],
            ['biber-warning.log', 'biber-warning.json'],
        ] as [string, string, boolean?][])(
            '%o',
            async (logfile, jsonfile, golden) => {
                const logContents = readFileSync(
                    `tests/unit/utils/latex-logs/${logfile}`,
                    'utf-8',
                );
                if (golden) {
                    await writeFile(
                        `tests/unit/utils/latex-logs/${jsonfile}`,
                        JSON.stringify(parseLatexLog(logContents, 0)),
                    );
                }
                expect(parseLatexLog(logContents, 0, 0)).toEqual(
                    JSON.parse(
                        readFileSync(
                            `tests/unit/utils/latex-logs/${jsonfile}`,
                            'utf-8',
                        ),
                    ),
                );
            },
        );
    });
    describe('single lines', () => {
        it.each([
            [
                './something.tex:123: Package example Info: something',
                {
                    line: 123,
                    message: 'Package example Info: something',
                    severity: 'info',
                },
            ],
            [
                'LaTeX Info: something',
                { line: 1, message: 'LaTeX Info: something', severity: 'info' },
            ],
            [
                'LaTeX Warning: something',
                {
                    line: 1,
                    message: 'LaTeX Warning: something',
                    severity: 'warn',
                },
            ],
            [
                'LaTeX Error: something',
                {
                    line: 1,
                    message: 'LaTeX Error: something',
                    severity: 'error',
                },
            ],
        ] as [string, Problem][])('%o', (logContents, problem) => {
            expect(parseLatexLog(logContents, 0, 0)).toEqual([problem]);
        });
    });
});
