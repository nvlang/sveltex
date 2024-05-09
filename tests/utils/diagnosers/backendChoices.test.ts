import { spy } from '$tests/fixtures.js';
import {
    AdvancedTexBackend,
    BackendChoices,
    CodeBackend,
    MarkdownBackend,
    TexBackend,
} from '$types';
import { diagnoseBackendChoices } from '$utils/diagnosers/backendChoices.js';
import { suite, it, expect, vi, afterAll, beforeEach, afterEach } from 'vitest';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

suite('utils/diagnosers/backendChoices', async () => {
    fixture();
    afterAll(() => {
        vi.restoreAllMocks();
    });
    const { log } = await spy(
        ['writeFileEnsureDir', 'log', 'existsSync'],
        true,
    );

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
                texBackend: 'katex',
                advancedTexBackend: 'local',
            },
            0,
            0,
        ],
        [
            {
                markdownBackend: 'unknown',
                codeBackend: 'unknown',
                texBackend: 'unknown',
                advancedTexBackend: 'unknown',
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
                bc as BackendChoices<
                    MarkdownBackend,
                    CodeBackend,
                    TexBackend,
                    AdvancedTexBackend
                >,
            );
            expect(res.errors).toEqual(errors);
            expect(res.warnings).toEqual(warnings);
            expect(log).toHaveBeenCalledTimes(errors + warnings);
        },
    );
});
