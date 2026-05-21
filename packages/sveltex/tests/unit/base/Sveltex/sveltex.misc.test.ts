import { sveltex } from '../../../../src/base/Sveltex.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spy } from '../../fixtures.js';
import { cartesianProduct } from '../../utils.js';
import { markdownBackends } from '../../../../src/utils/diagnosers/backendChoices.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('CSS for code + math backends', () => {
    fixture();
    describe.each(
        cartesianProduct(
            [...markdownBackends],
            ['starry-night', 'highlight.js'] as const,
            ['katex', 'mathjax'] as const,
        ),
    )('%s + %s + %s', (markdownBackend, codeBackend, mathBackend) => {
        test.each(
            cartesianProduct(
                ['cdn', 'self-hosted'] as const,
                mathBackend === 'katex'
                    ? (['cdn', 'hybrid'] as const)
                    : (['hybrid'] as const),
            ),
        )('code css: %s, math css: %s', async (codeApproach, mathApproach) => {
            const { writeFileEnsureDirSync, writeFileEnsureDir } = await spy([
                'writeFileEnsureDirSync',
                'writeFileEnsureDir',
            ]);
            const preprocessor = await sveltex(
                {
                    markdownBackend,
                    codeBackend,
                    mathBackend,
                },
                {
                    code: { theme: { type: codeApproach } },
                    math: { css: { type: mathApproach } },
                },
            );
            const code = (
                await preprocessor.markup({
                    content: '```js\nconsole.log("hello")\n```\n\n$\\LaTeX$',
                    filename: 'test.sveltex',
                })
            )?.code;
            if (mathApproach === 'hybrid') {
                if (mathBackend === 'katex') {
                    expect(writeFileEnsureDir).toHaveBeenCalledWith(
                        expect.stringContaining(mathBackend),
                        expect.any(String),
                    );
                } else {
                    expect(writeFileEnsureDirSync).toHaveBeenCalledWith(
                        expect.stringContaining(mathBackend),
                        expect.any(String),
                    );
                }
            } else {
                expect(code).toContain(mathBackend);
            }
            if (codeApproach === 'self-hosted') {
                expect(writeFileEnsureDir).toHaveBeenCalledWith(
                    expect.stringContaining(codeBackend),
                    expect.any(String),
                );
            } else {
                expect(code).toContain(codeBackend);
            }
        });
    });
});

describe('multiple math snippets in a single document', () => {
    fixture();
    test('processes every math snippet (mathPresent only flips once)', async () => {
        const preprocessor = await sveltex({
            markdownBackend: 'micromark',
            codeBackend: 'escape',
            mathBackend: 'katex',
        });
        // Two separate inline-math snippets: the first sets `mathPresent` to
        // `true`, the second must take the branch where it is already `true`.
        const code = (
            await preprocessor.markup({
                content: 'First $a + b$ and then $c \\cdot d$ done.',
                filename: 'test.sveltex',
            })
        )?.code;
        expect(code).toBeDefined();
        // Both expressions were handed to KaTeX and rendered.
        expect(code).toContain('katex');
        const renderedMathCount = (code?.match(/class="katex"/gu) ?? []).length;
        expect(renderedMathCount).toBe(2);
        // The textual context around the two snippets survived.
        expect(code).toContain('First ');
        expect(code).toContain(' and then ');
        expect(code).toContain(' done.');
    });
});

describe('Sveltex.trace', () => {
    fixture();

    test('captures the intermediate pipeline stages and final code', async () => {
        const preprocessor = await sveltex(
            {
                markdownBackend: 'marked',
                codeBackend: 'escape',
                mathBackend: 'none',
            },
            {},
        );
        const { code, stages } = await preprocessor.trace(
            '# Title\n\nText with `inline code`.',
        );
        // The two labelled intermediate stages, in pipeline order.
        expect(stages.map((s) => s.name)).toEqual([
            'Escaped document',
            'Rendered Markdown',
        ]);
        for (const stage of stages) {
            expect(typeof stage.output).toBe('string');
        }
        // The final stage is the emitted Svelte code; the Markdown rendered.
        expect(code).toContain('<h1');
        expect(code.length).toBeGreaterThan(0);
    });

    test('yields empty code when preprocessing throws', async () => {
        const debugModule = await import('../../../../src/utils/debug.js');
        const logSpy = vi.spyOn(debugModule, 'log').mockReturnValue(undefined);
        const escapeModule = await import('../../../../src/utils/escape.js');
        const escapeSpy = vi
            .spyOn(escapeModule, 'escape')
            .mockImplementation(() => {
                throw new Error('boom');
            });
        const preprocessor = await sveltex(
            {
                markdownBackend: 'marked',
                codeBackend: 'escape',
                mathBackend: 'none',
            },
            {},
        );
        const { code, stages } = await preprocessor.trace('# Title');
        expect(code).toBe('');
        expect(stages).toEqual([]);
        escapeSpy.mockRestore();
        logSpy.mockRestore();
    });
});
