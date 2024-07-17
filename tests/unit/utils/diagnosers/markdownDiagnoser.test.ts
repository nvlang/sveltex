import { getDefaultMarkdownConfig } from '$base/defaults.js';
import { spy } from '$tests/unit/fixtures.js';
import { markdownBackends } from '$utils/diagnosers/backendChoices.js';
import { diagnoseMarkdownConfiguration } from '$utils/diagnosers/markdownConfiguration.js';
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

describe('diagnoseMarkdownConfiguration', () => {
    fixture();
    beforeAll(async () => {
        await spy(['writeFileEnsureDir', 'log', 'existsSync'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.each(markdownBackends)('code backend: %o', (b) => {
        it.each([
            [getDefaultMarkdownConfig(b), 0, 0],
            ...(b === 'custom'
                ? [
                      [{ process: () => '' }, 0, 0],
                      [{ process: () => '', test: '' }, 0, 1],
                  ]
                : [
                      [{}, 0, 0],
                      [{ test: '' }, 0, 1],
                      [{ components: [{}] }, 1, 0],
                  ]),
            [null, 1, 0],
        ] as [object | null, number, number][])(
            `('${b}', %o) → { errors: %i, warnings: %i }`,
            (config, errors, warnings) => {
                const res = diagnoseMarkdownConfiguration(b, config);
                expect(res.errors).toEqual(errors);
                expect(res.warnings).toEqual(warnings);
            },
        );
    });
});
