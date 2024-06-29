import { sveltex } from '$base/Sveltex.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spy } from '$tests/unit/fixtures.js';
import { cartesianProduct } from '$tests/unit/utils.js';
import { markdownBackends } from '$utils/diagnosers/backendChoices.js';

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
