import { spy } from '../../fixtures.js';
import { isCodeBackendWithCss } from '../../../../src/typeGuards/code.js';
import { codeBackends } from '../../../../src/utils/diagnosers/backendChoices.js';
import { diagnoseCodeConfiguration } from '../../../../src/utils/diagnosers/codeConfiguration.js';
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

describe('utils/diagnosers/codeConfiguration', () => {
    fixture();
    beforeAll(async () => {
        await spy(['writeFileEnsureDir', 'log', 'existsSync'], true);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.each(codeBackends)('code backend: %o', (b) => {
        it.each([
            [{}, 0, 0],
            [null, 1, 0],
            [123, 1, 0],
            ['test', 1, 0],
            [{ transformers: '' }, 1, 0],
            [{ transformers: { pre: '', post: ['a', 4] } }, 2, 0],
            [
                {
                    transformers: {
                        pre: [
                            ['a', 'b'],
                            [/a/u, 'b'],
                        ],
                        post: '',
                    },
                },
                1,
                0,
            ],
            [{ addLanguageClass: null }, 1, 0],
            [
                { theme: null },
                isCodeBackendWithCss(b) ? 1 : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [
                { theme: 123 },
                isCodeBackendWithCss(b) ? 1 : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [
                { theme: 'test' },
                isCodeBackendWithCss(b) ? 1 : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [{ theme: {} }, 0, isCodeBackendWithCss(b) ? 0 : 1],
            [
                { theme: { read: 1, write: {} } },
                isCodeBackendWithCss(b) ? 2 : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [
                { theme: { min: null, cdn: 'unknown' } },
                isCodeBackendWithCss(b) ? (b === 'highlight.js' ? 2 : 1) : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [
                { theme: { name: 'default', mode: 'unknown' } },
                isCodeBackendWithCss(b) ? (b === 'starry-night' ? 1 : 0) : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
            [
                {
                    addLanguageClass: 'prefix',
                    theme: {
                        name: 'e24db2f5-72cd-47c5-92f2-b10fd5ffc09e',
                        mode: 'both',
                        min: false,
                        cdn: 'jsdelivr',
                        read: false,
                        write: true,
                    },
                },
                isCodeBackendWithCss(b) ? 1 : 0,
                isCodeBackendWithCss(b) ? 0 : 1,
            ],
        ])(
            `('${b}', %o) → { errors: %i, warnings: %i }`,
            (config, errors, warnings) => {
                const res = diagnoseCodeConfiguration(b, config);
                expect(res.errors).toEqual(errors);
                expect(res.warnings).toEqual(warnings);
            },
        );
    });
});
