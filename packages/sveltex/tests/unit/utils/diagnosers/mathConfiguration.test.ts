import { getDefaultMathConfig } from '../../../../src/base/defaults.js';
import { spy } from '../../fixtures.js';
import { mathBackends } from '../../../../src/utils/diagnosers/backendChoices.js';
import { diagnoseMathConfiguration } from '../../../../src/utils/diagnosers/mathConfiguration.js';
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

describe('diagnoseMathConfiguration', () => {
    fixture();
    beforeAll(async () => {
        await spy(['writeFileEnsureDir', 'log', 'existsSync'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.each(mathBackends)('code backend: %o', (b) => {
        it.each([
            [getDefaultMathConfig(b), 0, 0],
            ...(b === 'custom'
                ? [
                      [{ process: () => '' }, 0, 0],
                      [{ process: () => '', test: '' }, 0, 1],
                  ]
                : [
                      [{}, 0, 0],
                      [{ test: '' }, 0, 1],
                  ]),
            [null, 1, 0],
        ] as [object | null, number, number][])(
            `('${b}', %o) → { errors: %i, warnings: %i }`,
            (config, errors, warnings) => {
                const res = diagnoseMathConfiguration(b, config);
                expect(res.errors).toEqual(errors);
                expect(res.warnings).toEqual(warnings);
            },
        );
    });

    it("reports the actual value of an invalid nested option ('cdn'), not 'undefined'", async () => {
        const log = await spy('log', true);
        const res = diagnoseMathConfiguration('mathjax', {
            css: { type: 'cdn' },
        });
        expect(res.errors).toBe(1);
        const messages = log.mock.calls.map((c) => c.map(String).join(' '));
        expect(messages.some((m) => m.includes('css.type'))).toBe(true);
        expect(messages.some((m) => m.includes('cdn'))).toBe(true);
        expect(messages.some((m) => m.includes('got undefined'))).toBe(false);
    });
});
