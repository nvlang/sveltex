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
});
