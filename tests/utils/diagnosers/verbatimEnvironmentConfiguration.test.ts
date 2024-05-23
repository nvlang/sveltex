import { getDefaultVerbEnvConfig } from '$config/defaults.js';
import { spy } from '$tests/fixtures.js';
import { isArray } from '$type-guards/utils.js';
import { VerbEnvConfigBase } from '$types/handlers/Verbatim.js';
import { diagnoseVerbEnvConfig } from '$utils/diagnosers/verbatimEnvironmentConfiguration.js';
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

describe('utils/diagnosers/verbatimEnvironmentConfiguration', () => {
    fixture();
    beforeAll(async () => {
        await spy(['writeFileEnsureDir', 'log', 'existsSync']);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it.each([
        {},
        getDefaultVerbEnvConfig('code'),
        getDefaultVerbEnvConfig('escapeOnly'),
        getDefaultVerbEnvConfig('noop'),
        getDefaultVerbEnvConfig('custom'),
        getDefaultVerbEnvConfig('advancedTex'),
        {
            type: 'advancedTex',
            overrides: { engine: 'tex', shellEscape: 'restricted' },
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
        [{ type: 'advancedTex', overrides: 'something' }, 1],
        [
            { type: 'advancedTex', overrides: { engine: 'something', a: 1 } },
            1,
            1,
        ],
        [
            {
                type: 'noop',
                wrap: null,
                respectSelfClosing: null,
                selfCloseOutputWith: 'something',
                a: 1,
                b: 2,
            },
            2,
            3,
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
