import type { BackendChoices } from '../../../../src/types/SveltexConfiguration.js';
import type { CodeBackend } from '../../../../src/types/handlers/Code.js';
import type { MarkdownBackend } from '../../../../src/types/handlers/Markdown.js';
import type { MathBackend } from '../../../../src/types/handlers/Math.js';

import { spy } from '../../fixtures.js';
import { diagnoseBackendChoices } from '../../../../src/utils/diagnosers/backendChoices.js';
import {
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    type MockInstance,
    beforeAll,
    describe,
} from 'vitest';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('utils/diagnosers/backendChoices', () => {
    fixture();
    afterAll(() => {
        vi.restoreAllMocks();
    });
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(
            ['writeFileEnsureDir', 'log', 'existsSync'],
            true,
        );
        log = mocks.log;
    });

    it.each([
        ['something', 1, 0],
        [undefined, 1, 0],
        [null, 1, 0],
        [{}, 0, 0],
        [{ codeBackend: 'highlight.js' }, 0, 0],
        [{ something: null }, 0, 1],
        [
            {
                markdownBackend: 'markdown-it',
                codeBackend: 'none',
                mathBackend: 'katex',
                texBackend: 'local',
            },
            0,
            0,
        ],
        [
            {
                markdownBackend: 'unknown',
                codeBackend: 'unknown',
                mathBackend: 'unknown',
                texBackend: 'unknown',
                a: null,
                b: 1,
                c: undefined,
            },
            4,
            1,
        ],
    ] as const)(
        'diagnoseBackendChoices(%o) === { errors: %i, warnings: %i }',
        (bc, errors, warnings) => {
            const res = diagnoseBackendChoices(
                bc as BackendChoices<MarkdownBackend, CodeBackend, MathBackend>,
            );
            expect(res.errors).toEqual(errors);
            expect(res.warnings).toEqual(warnings);
            expect(log).toHaveBeenCalledTimes(errors + warnings);
        },
    );
});
