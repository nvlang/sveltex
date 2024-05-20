import { spy } from '$tests/fixtures.js';
import { codeBackends, isThemableCodeBackend } from '$type-guards/code.js';
import { diagnoseCodeConfiguration } from '$utils/diagnosers/codeConfiguration.js';
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
            [{ wrap: 1 }, 1, 0],
            [{ wrap: {} }, 1, 0],
            [{ wrapClassPrefix: null }, 1, 0],
            [
                { theme: null },
                isThemableCodeBackend(b) ? 1 : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [
                { theme: 123 },
                isThemableCodeBackend(b) ? 1 : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [
                { theme: 'test' },
                isThemableCodeBackend(b) ? 1 : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [{ theme: {} }, 0, isThemableCodeBackend(b) ? 0 : 1],
            [
                { theme: { read: 1, write: {} } },
                isThemableCodeBackend(b) ? 2 : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [
                { theme: { min: null, cdn: 'unknown' } },
                isThemableCodeBackend(b) ? (b === 'highlight.js' ? 2 : 1) : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [
                { theme: { name: 'default', mode: 'unknown' } },
                isThemableCodeBackend(b) ? (b === 'starry-night' ? 1 : 0) : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
            [
                {
                    wrap: () => ['', ''],
                    wrapClassPrefix: 'prefix',
                    theme: {
                        name: 'e24db2f5-72cd-47c5-92f2-b10fd5ffc09e',
                        mode: 'both',
                        min: false,
                        cdn: 'jsdelivr',
                        read: false,
                        write: true,
                    },
                },
                isThemableCodeBackend(b) ? 1 : 0,
                isThemableCodeBackend(b) ? 0 : 1,
            ],
        ])(
            `diagnoseCodeConfiguration('${b}', %o) === { errors: %i, warnings: %i }`,
            (config, errors, warnings) => {
                const res = diagnoseCodeConfiguration(b, config);
                expect(res.errors).toEqual(errors);
                expect(res.warnings).toEqual(warnings);
            },
        );
    });
});
