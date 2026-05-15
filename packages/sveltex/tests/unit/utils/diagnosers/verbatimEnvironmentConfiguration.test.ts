import { getDefaultVerbEnvConfig } from '../../../../src/base/defaults.js';
import { spy } from '../../fixtures.js';
import { isArray } from '../../../../src/typeGuards/utils.js';
import type { VerbEnvConfigBase } from '../../../../src/types/handlers/Verbatim.js';
import { diagnoseVerbEnvConfig } from '../../../../src/utils/diagnosers/verbatimEnvironmentConfiguration.js';
import {
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    describe,
    beforeAll,
    afterAll,
} from 'vitest';

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.clearAllMocks();
});

describe('utils/diagnosers/verbatimEnvironmentConfiguration', () => {
    beforeAll(async () => {
        await spy('log');
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it.each([
        {},
        getDefaultVerbEnvConfig('code'),
        getDefaultVerbEnvConfig('escape'),
        getDefaultVerbEnvConfig('noop'),
        getDefaultVerbEnvConfig('tex'),
        {
            type: 'tex',
            overrides: {
                compilation: {
                    engine: 'pdflatexmk',
                    shellEscape: 'restricted',
                },
            },
        },
        { attributeForwardingAllowlist: 'all' },
        { attributeForwardingAllowlist: ['1', 'all', '2'] },
        { component: 'something' },
        { component: null },
        { component: undefined },

        [null, 1],
        [{ type: 'something' }, 1],
        [{ defaultAttributes: { a: { b: 'c' } } }, 1],
        [{ defaultAttributes: ['a', 'b'] }, 1],
        [{ attributeForwardingAllowlist: 'something' }, 1],
        [{ attributeForwardingAllowlist: 123 }, 1],
        [{ attributeForwardingBlocklist: 'something' }, 1],
        [{ aliases: 'something' }, 1],
        [{ type: 'tex', overrides: 'something' }, 1],
        [
            {
                type: 'tex',
                overrides: {
                    compilation: { engine: 'something' },
                    a: 1,
                },
            },
            1,
            1,
        ],
        [
            {
                type: 'noop',
                respectSelfClosing: null,
                selfCloseOutputWith: 'something',
                a: 1,
                b: 2,
            },
            2,
            2,
        ],
        [
            {
                type: 'noop',
                a: 1,
                b: 2,
            },
            0,
            2,
        ],
        // tex-only properties present on a non-tex environment yield two
        // warnings each: one for being defined despite `type` not being
        // "tex", and one for being an unexpected property for that type.
        [
            {
                type: 'noop',
                preamble: '\\usepackage{amsmath}',
            },
            0,
            2,
        ],
        [
            {
                type: 'code',
                preamble: '\\usepackage{amsmath}',
                documentClass: 'article',
                overrides: { caching: { enabled: true } },
                handleAttributes: () => ({}),
                postprocess: (s: string) => s,
            },
            0,
            10,
        ],
    ] as (VerbEnvConfigBase | [VerbEnvConfigBase, number?, number?])[])(
        `%o`,
        (test) => {
            let config: VerbEnvConfigBase;
            let errors: number | undefined;
            let warnings: number | undefined;
            if (isArray(test)) [config, errors, warnings] = test;
            else config = test;
            const res = diagnoseVerbEnvConfig(config);
            expect(res.errors).toEqual(errors ?? 0);
            expect(res.warnings).toEqual(warnings ?? 0);
        },
    );

    describe('environment name argument', () => {
        it('mentions the environment name when a non-object is passed', () => {
            const res = diagnoseVerbEnvConfig(null, 'myEnv');
            expect(res).toEqual({ errors: 1, warnings: 0, problems: 1 });
        });

        it('mentions the environment name when problems are found', () => {
            const res = diagnoseVerbEnvConfig(
                { type: 'something-invalid' },
                'myEnv',
            );
            expect(res.errors).toBe(1);
            expect(res.problems).toBe(1);
        });

        it('reports a warning-only environment with its name', () => {
            const res = diagnoseVerbEnvConfig(
                { type: 'noop', unexpectedProp: true },
                'codeBlock',
            );
            expect(res.errors).toBe(0);
            expect(res.warnings).toBe(1);
        });

        it('omits the environment name when it is not provided', () => {
            const res = diagnoseVerbEnvConfig({ type: 'something-invalid' });
            expect(res.errors).toBe(1);
        });
    });
});
