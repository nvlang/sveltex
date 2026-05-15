import { getDefaultTexConfig } from '../../../../src/base/defaults.js';
import { spy } from '../../fixtures.js';
import { isArray } from '../../../../src/typeGuards/utils.js';
import { diagnoseTexConfig } from '../../../../src/utils/diagnosers/texConfiguration.js';
import {
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    describe,
    beforeAll,
} from 'vitest';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('utils/diagnosers/texConfiguration', () => {
    fixture();
    beforeAll(async () => {
        await spy(['writeFileEnsureDir', 'log', 'existsSync'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('diagnoseTexConfig', () => {
        it('accepts the default TeX configuration without problems', () => {
            const res = diagnoseTexConfig(getDefaultTexConfig());
            expect(res.passed).toBe(true);
            expect(res.stats).toEqual({
                errors: 0,
                warnings: 0,
                problems: 0,
            });
        });

        it('accepts an empty object', () => {
            const res = diagnoseTexConfig({});
            expect(res.passed).toBe(true);
            expect(res.stats.problems).toBe(0);
        });

        it.each([
            // [config, errors, warnings]

            // --- Caching options ---
            [{ caching: { enabled: true } }, 0, 0],
            [{ caching: { enabled: 'yes' } }, 1, 0],
            [{ caching: { cacheDirectory: 'node_modules/.cache/x' } }, 0, 0],
            [{ caching: { cacheDirectory: 123 } }, 1, 0],
            [
                { caching: { enabled: 0, cacheDirectory: null } },
                2,
                0,
            ],

            // --- Compilation options ---
            [{ compilation: { shellEscape: false } }, 0, 0],
            [{ compilation: { shellEscape: true } }, 0, 0],
            [{ compilation: { shellEscape: 'restricted' } }, 0, 0],
            [{ compilation: { shellEscape: 'yes' } }, 1, 0],
            [{ compilation: { saferLua: true } }, 0, 0],
            [{ compilation: { saferLua: 'true' } }, 1, 0],
            [{ compilation: { intermediateFiletype: 'pdf' } }, 0, 0],
            [{ compilation: { intermediateFiletype: 'dvi' } }, 0, 0],
            [{ compilation: { intermediateFiletype: 'ps' } }, 1, 0],
            [{ compilation: { overrideCompilation: null } }, 0, 0],
            [
                {
                    compilation: {
                        overrideCompilation: { command: 'latex' },
                    },
                },
                0,
                0,
            ],
            [
                {
                    compilation: {
                        overrideCompilation: {
                            command: 'latex',
                            args: ['-a', '-b'],
                            env: { FOO: 'bar' },
                            silent: true,
                        },
                    },
                },
                0,
                0,
            ],
            [{ compilation: { overrideCompilation: 'latex' } }, 1, 0],
            // An invalid nested field makes `isCliInstruction` reject the
            // parent object too, so both the parent and the nested field
            // are reported (2 errors).
            [
                {
                    compilation: {
                        overrideCompilation: { command: 'latex', args: [1] },
                    },
                },
                2,
                0,
            ],
            [
                {
                    compilation: {
                        overrideCompilation: {
                            command: 'latex',
                            env: 'nope',
                        },
                    },
                },
                2,
                0,
            ],
            [
                {
                    compilation: {
                        overrideCompilation: {
                            command: 'latex',
                            silent: 'yes',
                        },
                    },
                },
                2,
                0,
            ],
            [{ compilation: { engine: 'pdflatex' } }, 0, 0],
            [{ compilation: { engine: 'lualatexmk' } }, 0, 0],
            [{ compilation: { engine: 'xetex' } }, 1, 0],

            // --- Optimization options ---
            [{ optimization: { currentColor: '#fff' } }, 0, 0],
            [{ optimization: { currentColor: '#abcdef' } }, 0, 0],
            [{ optimization: { currentColor: 'red' } }, 1, 0],
            [{ optimization: { currentColor: '#xyz' } }, 1, 0],
            [{ optimization: { currentColor: 123 } }, 1, 0],
            [{ optimization: { overrideOptimization: null } }, 0, 0],
            [
                { optimization: { overrideOptimization: (svg: string) => svg } },
                0,
                0,
            ],
            [{ optimization: { overrideOptimization: 'nope' } }, 1, 0],
            [{ optimization: { svgo: { multipass: true } } }, 0, 0],
            [{ optimization: { svgo: null } }, 1, 0],

            // --- Conversion options ---
            [{ conversion: { converter: 'dvisvgm' } }, 0, 0],
            [{ conversion: { converter: 'poppler' } }, 0, 0],
            [{ conversion: { converter: 'inkscape' } }, 1, 0],
            [{ conversion: 'nope' }, 1, 0],
            [{ conversion: { dvisvgm: { svg: {} } } }, 0, 0],
            [{ conversion: { dvisvgm: null } }, 1, 0],
            [{ conversion: { poppler: { svgFile: true } } }, 0, 0],
            [{ conversion: { poppler: 42 } }, 1, 0],
            [{ conversion: { outputDirectory: 'src/sveltex' } }, 0, 0],
            [{ conversion: { outputDirectory: false } }, 1, 0],
            [{ conversion: { overrideConversion: null } }, 0, 0],
            [
                {
                    conversion: {
                        overrideConversion: { command: 'dvisvgm' },
                    },
                },
                0,
                0,
            ],
            [
                {
                    conversion: {
                        overrideConversion: {
                            command: 'dvisvgm',
                            args: ['--font-format=woff'],
                            env: { PATH: '/usr/bin' },
                            silent: false,
                        },
                    },
                },
                0,
                0,
            ],
            [{ conversion: { overrideConversion: 7 } }, 1, 0],
            // As above: an invalid nested field is reported alongside the
            // parent object failing `isCliInstruction` (2 errors).
            [
                {
                    conversion: {
                        overrideConversion: { command: 'dvisvgm', args: 'no' },
                    },
                },
                2,
                0,
            ],
            [
                {
                    conversion: {
                        overrideConversion: {
                            command: 'dvisvgm',
                            env: false,
                        },
                    },
                },
                2,
                0,
            ],
            [
                {
                    conversion: {
                        overrideConversion: {
                            command: 'dvisvgm',
                            silent: 1,
                        },
                    },
                },
                2,
                0,
            ],

            // --- Debug options ---
            [
                { debug: { ignoreLogMessages: ['a warning', /a regexp/u] } },
                0,
                0,
            ],
            [{ debug: { ignoreLogMessages: [] } }, 0, 0],
            [{ debug: { ignoreLogMessages: ['ok', 123] } }, 1, 0],
            [{ debug: { ignoreLogMessages: 'not an array' } }, 1, 0],
            [{ debug: { verbosity: 'all' } }, 0, 0],
            [{ debug: { verbosity: 'none' } }, 0, 0],
            [
                {
                    debug: {
                        verbosity: { onFailure: 'error', onSuccess: 'box' },
                    },
                },
                0,
                0,
            ],
            [{ debug: { verbosity: 'loud' } }, 1, 0],
            [{ debug: { verbosity: { onFailure: 'all' } } }, 0, 0],
            [{ debug: { verbosity: { onFailure: 'loud' } } }, 1, 0],
            [{ debug: { verbosity: { onSuccess: 'warn' } } }, 0, 0],
            [{ debug: { verbosity: { onSuccess: 'error' } } }, 1, 0],
            [{ debug: { verbosity: { onSuccess: 'loud' } } }, 1, 0],

            // --- Unexpected properties (warnings) ---
            [{ unexpectedProp: 1 }, 0, 1],
            [{ foo: 1, bar: 2 }, 0, 2],

            // --- Combinations ---
            [
                {
                    caching: { enabled: 'no' },
                    compilation: { engine: 'bad' },
                    unexpected: true,
                },
                2,
                1,
            ],
        ] as [object, number, number][])(
            '%o → { errors: %i, warnings: %i }',
            (config, errors, warnings) => {
                const res = diagnoseTexConfig(config);
                expect(res.stats.errors).toEqual(errors);
                expect(res.stats.warnings).toEqual(warnings);
                expect(res.stats.problems).toEqual(errors + warnings);
            },
        );

        it('reports a problem for every invalid option at once', () => {
            const res = diagnoseTexConfig({
                caching: { enabled: 'no', cacheDirectory: 1 },
                compilation: {
                    shellEscape: 'sometimes',
                    saferLua: 'no',
                    intermediateFiletype: 'ps',
                    engine: 'bad',
                },
            });
            expect(res.stats.errors).toBe(6);
            expect(res.passed).toBe(false);
        });

        it('exposes problem messages mentioning the offending property', () => {
            const res = diagnoseTexConfig({ compilation: { engine: 'bad' } });
            expect(isArray(res.problems)).toBe(true);
            expect(res.problems).toHaveLength(1);
            expect(res.problems[0]?.message).toContain('compilation.engine');
            expect(res.problems[0]?.severity).toBe('error');
        });
    });
});
