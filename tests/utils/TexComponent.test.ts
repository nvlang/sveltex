import { createAdvancedTexHandler } from '$handlers';
import { CliInstruction, SupportedTexEngine } from '$src/types/index.js';
import {
    TexComponent,
    unescapeCssColorVarsFromSvg,
} from '$utils/TexComponent.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    describe,
    it,
    expect,
    suite,
    vi,
    beforeEach,
    afterEach,
    type MockInstance,
} from 'vitest';

let writeFileSyncCallStack: [string, string, string][] = [];
let consoleErrorCallStack: unknown[][] = [];

suite('TexComponent', () => {
    describe.concurrent('constructor', () => {
        it.skip('should throw error if invalid tex component config is provided', async () => {
            const ath = await createAdvancedTexHandler('local');
            expect(
                () =>
                    new TexComponent({
                        advancedTexHandler: ath,
                        config: {},
                        name: 'div',
                    }),
            ).toThrowError();
        });

        it('should ensure svgFilename ends with .svg', async () => {
            const ath = await createAdvancedTexHandler('local');
            expect(
                new TexComponent({
                    advancedTexHandler: ath,
                    config: {},
                    name: 'something',
                }).ref.endsWith('.svg'),
            ).toBeTruthy();
            expect(
                new TexComponent({
                    advancedTexHandler: ath,
                    config: {},
                    name: 'something',
                    ref: 'something.svg',
                }).ref.endsWith('.svg'),
            ).toBeTruthy();
            expect(
                new TexComponent({
                    advancedTexHandler: ath,
                    config: {},
                    name: 'something',
                    ref: 'something.SVG',
                }).ref.endsWith('.svg'),
            ).toBeTruthy();
            expect(
                new TexComponent({
                    advancedTexHandler: ath,
                    config: {},
                    name: 'something',
                    ref: 'something',
                }).ref.endsWith('.svg'),
            ).toBeTruthy();
        });

        it.skip('should add alt attribute automatically if needed', async () => {
            // const ath = await createAdvancedTexHandler('local');
            // expect(
            //     new TexComponent({
            //         advancedTexHandler: ath,
            //         config: {},
            //         name: 'something',
            //         svgFilename: 'something.svg',
            //     }).attributes.alt,
            // ).toEqual('something.svg');
        });

        it.skip('should respect manually set alt attribute', async () => {
            // const ath = await createAdvancedTexHandler('local');
            // expect(
            //     new TexComponent({
            //         advancedTexHandler: ath,
            //         config: {},
            //         name: 'something',
            //         svgFilename: 'something.svg',
            //         attributes: { alt: 'something else' },
            //     }).attributes.alt,
            // ).toEqual('something else');
        });
    });

    describe.concurrent('configuration setter', () => {
        it('should correctly set configuration', async () => {
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                config: {},
                name: 'something',
            });
            tc.configuration = { aliases: ['SomethingElse'] };
            expect(tc.configuration.aliases).toEqual(['SomethingElse']);
        });

        it.skip('should throw error if invalid tex component name is passed to constructor', async () => {
            const ath = await createAdvancedTexHandler('local');
            expect(
                () =>
                    new TexComponent({
                        name: 'div',
                        advancedTexHandler: ath,
                    }),
            ).toThrowError();
        });
    });

    describe('compile', () => {
        vi.mock('node:fs', async (orig) => ({
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            ...((await orig()) as object),
            writeFileSync: vi
                .fn()
                .mockImplementation(
                    (path: string, content: string, encoding: string) => {
                        writeFileSyncCallStack.push([path, content, encoding]);
                    },
                ),
            readFileSync: vi.fn().mockImplementation(() => '{}'),
        }));

        let spawnCliInstructionMock: MockInstance;
        let consoleErrorMock: MockInstance;
        beforeEach(async () => {
            vi.restoreAllMocks();
            spawnCliInstructionMock = vi
                .spyOn(await import('$utils/cli.js'), 'spawnCliInstruction')
                .mockImplementation(() =>
                    Promise.resolve({ code: 0, stdout: '', stderr: '' }),
                );
            consoleErrorMock = vi
                .spyOn(console, 'error')
                .mockImplementation((...msg: unknown[]) =>
                    consoleErrorCallStack.push(msg),
                );
        });
        afterEach(() => {
            vi.restoreAllMocks();
            spawnCliInstructionMock.mockReset();
            consoleErrorMock.mockReset();
            writeFileSyncCallStack = [];
            consoleErrorCallStack = [];
        });
        it('should support caching', async () => {
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                config: {},
                name: 'something',
            });
            await tc.compile();
            expect(spawnCliInstructionMock).toHaveBeenCalledTimes(1);
            expect(writeFileSyncCallStack.length).toEqual(0);
        });

        it.each([
            { overrideCompileCmdCwd: false },
            { overrideCompileCmdCwd: true },
        ])(
            'should fail silently (TeX compilation)',
            async ({ overrideCompileCmdCwd }) => {
                spawnCliInstructionMock = vi
                    .spyOn(await import('$utils/cli.js'), 'spawnCliInstruction')
                    .mockImplementation(() =>
                        Promise.resolve({
                            code: 1,
                            stdout: '',
                            stderr: 'something',
                        }),
                    );
                const ath = await createAdvancedTexHandler('local');
                const tc = new TexComponent({
                    advancedTexHandler: ath,
                    name: 'something',
                    config: {
                        overrides: { caching: false },
                    },
                });
                if (overrideCompileCmdCwd && tc.compileCmd.env)
                    tc.configuration.overrides.overrideCompilationCommand = {
                        command: 'echo',
                        env: { cwd: undefined },
                    };
                const code = await tc.compile();
                expect(writeFileSyncCallStack.length).toEqual(0);
                expect(code).toEqual(1);
                expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                expect(consoleErrorCallStack[0]?.join(' ')).toMatch(
                    'The compilation was attempted by running the following command from within',
                );
            },
        );

        it('should fail silently (PDF/DVI to SVG conversion)', async () => {
            spawnCliInstructionMock = vi
                .spyOn(await import('$utils/cli.js'), 'spawnCliInstruction')
                .mockImplementation((instr: CliInstruction) => {
                    if (instr.command === 'dvisvgm') {
                        return Promise.resolve({
                            code: 1,
                            stdout: '',
                            stderr: 'something',
                        });
                    } else {
                        return Promise.resolve({
                            code: 0,
                            stdout: '',
                            stderr: '',
                        });
                    }
                });
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                name: 'something',
                config: {
                    overrides: { caching: false },
                },
            });
            const code = await tc.compile();
            expect(writeFileSyncCallStack.length).toEqual(0);
            expect(code).toEqual(1);
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorCallStack[0]?.join(' ')).toMatch(
                'The conversion was attempted by running the following command from within',
            );
        });

        it('should fail silently (unknown error caught)', async () => {
            vi.mocked(writeFileSync).mockImplementation(() => {
                throw new Error('ENOENT');
            });

            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                name: 'something',
                config: {
                    overrides: { caching: false },
                },
            });
            const code = await tc.compile();
            expect(writeFileSyncCallStack.length).toEqual(0);
            expect(code).toEqual(1);
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorCallStack[0]?.join(' ')).toMatch(
                'Error while compiling or converting',
            );
        });

        it.each([
            {
                overrideCompilationCommand: { command: 'echo' },
                overrideConversionCommand: { command: 'ls' },
            },
            {
                overrideCompilationCommand: {
                    command: 'echo',
                    env: { cwd: undefined },
                },
                overrideConversionCommand: {
                    command: 'ls',
                    env: { cwd: undefined },
                },
            },
        ])(
            'should faithfully execute override commands',
            async ({
                overrideCompilationCommand,
                overrideConversionCommand,
            }) => {
                vi.mock('node:fs', async (orig) => {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const original = (await orig()) as typeof import('node:fs');
                    return {
                        ...original,
                        writeFileSync: vi
                            .fn()
                            .mockImplementation(() => Promise.resolve(0)),
                        readFileSync: vi
                            .fn()
                            .mockImplementation((path: string) =>
                                path.match(/.*\.(tex|dvi|pdf|svg)/)
                                    ? Promise.resolve(0)
                                    : original.readFileSync(path),
                            ),
                    };
                });

                const ath = await createAdvancedTexHandler('local');
                const tc = new TexComponent({
                    advancedTexHandler: ath,
                    name: 'something',
                    config: {
                        overrides: {
                            caching: false,
                            overrideCompilationCommand,
                            overrideConversionCommand,
                        },
                    },
                });
                const code = await tc.compile();
                expect(code).toEqual(0);
                const dir = join(
                    ath.configuration.cacheDirectory,
                    tc.name,
                ).toString();
                expect(spawnCliInstructionMock).toHaveBeenCalledTimes(2);
                expect(spawnCliInstructionMock).toHaveBeenNthCalledWith(1, {
                    command: 'echo',
                    env: {
                        FILENAME: tc.hash + '.tex',
                        FILENAME_BASE: tc.hash,
                        FILEPATH: join(dir, tc.hash + '.tex'),
                        OUTDIR: dir,
                        OUTFILETYPE: 'pdf',
                    },
                });
                expect(spawnCliInstructionMock).toHaveBeenNthCalledWith(2, {
                    command: 'ls',
                    env: {
                        FILENAME: tc.hash + '.pdf',
                        FILENAME_BASE: tc.hash,
                        FILEPATH: join(dir, tc.hash + '.pdf'),
                        FILETYPE: 'pdf',
                        OUTDIR: 'static/sveltex/something',
                        OUTFILEPATH:
                            'static/sveltex/something/' + tc.hash + '.svg',
                        cwd: undefined,
                    },
                    silent: true,
                });
            },
        );
    });

    describe('compileCmd', () => {
        let consoleErrorMock: MockInstance;
        beforeEach(() => {
            vi.restoreAllMocks();
            consoleErrorMock = vi
                .spyOn(console, 'error')
                .mockImplementation((...msg: unknown[]) =>
                    consoleErrorCallStack.push(msg),
                );
        });
        afterEach(() => {
            vi.restoreAllMocks();
            consoleErrorMock.mockReset();
            consoleErrorCallStack = [];
        });

        it('should log error if plain tex is used and pdf output is requested', async () => {
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                name: 'something',
                config: {
                    overrides: {
                        caching: false,
                        engine: 'tex',
                        intermediateFiletype: 'pdf',
                    },
                },
            });
            tc.compileCmd;
            expect(consoleErrorCallStack.length).toEqual(1);
            expect(consoleErrorCallStack[0]?.join(' ')).toMatch(
                'Plain TeX does not support PDF output.',
            );
        });

        it('should add the right output flags for lualatexmk (pdf)', async () => {
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                name: 'something',
                config: {
                    overrides: {
                        caching: false,
                        engine: 'lualatexmk',
                        intermediateFiletype: 'pdf',
                    },
                },
            });
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
            const ath = await createAdvancedTexHandler('local');
            const tc = new TexComponent({
                advancedTexHandler: ath,
                name: 'something',
                config: {
                    overrides: {
                        caching: false,
                        engine: data.engine ?? 'lualatex',
                        [data.option]: data.value,
                    },
                },
            });
            expect(tc.compileCmd.args).toContain(data.flag);
        });
    });
});

describe.concurrent('unescapeCssColorVarsFromSvg', () => {
    it('should work', () => {
        const map = new Map<`var(--${string})`, string>();
        map.set('var(--css-var-123456)', '123456');
        expect(unescapeCssColorVarsFromSvg('#123456', map)).toEqual(
            'var(--css-var-123456)',
        );
    });

    it('should convert #RRGGBB to #RGB if applicable', () => {
        const map = new Map<`var(--${string})`, string>();
        map.set('var(--css-var)', '112233');
        expect(unescapeCssColorVarsFromSvg('#123', map)).toEqual(
            'var(--css-var)',
        );
    });
});
