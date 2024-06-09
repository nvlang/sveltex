import type { TexBackend } from '$types/handlers/Tex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { MathBackend } from '$types/handlers/Math.js';

import { sveltex } from '$Sveltex.js';
import { isArray } from '$type-guards/utils.js';
import { escapeWhitespace } from '$utils/debug.js';

import { expect, it } from 'vitest';

export interface Test {
    input: string;
    expected?: string;
    label: string;
}

export function labeledNoopTest(
    input: string,
    label: string = escapeWhitespace(input),
): Test {
    return { input, expected: input, label };
}

export const noopTest = (input: string) => labeledNoopTest(input);

export type TestRunner = (test: Test) => Promise<void> | void;

export function testWith(
    fn: (input: string) => string | undefined | Promise<string | undefined>,
): TestRunner {
    return (test: Test) => {
        it(test.label, async () => {
            expect(await fn(test.input)).toEqual(test.expected ?? test.input);
        });
    };
}

export function expectWith(
    fn: (input: string) => string | undefined | Promise<string | undefined>,
): TestRunner {
    return async (test: Test) => {
        expect(await fn(test.input)).toEqual(test.expected ?? test.input);
    };
}

export function range(start: number, end: number, step: number = 1): number[] {
    const arr = [];
    for (let i = start; i <= end; i += step) {
        arr.push(i);
    }
    return arr;
}

export const uuidV4Regexp =
    /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/;

interface Variables {
    markdown?: boolean | MarkdownBackend[];
    code?: boolean | CodeBackend[];
    math?: boolean | MathBackend[];
    tex?: boolean | TexBackend[];
}

export function cartesianProduct<X1>(x1: X1[]): [X1][];
export function cartesianProduct<X1, X2>(x1: X1[], x2: X2[]): [X1, X2][];
export function cartesianProduct<X1, X2, X3>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
): [X1, X2, X3][];
export function cartesianProduct<X1, X2, X3, X4>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
): [X1, X2, X3, X4][];
export function cartesianProduct<X1, X2, X3, X4, X5>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
): [X1, X2, X3, X4, X5][];
export function cartesianProduct<X1, X2, X3, X4, X5, X6>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
    x6: X6[],
): [X1, X2, X3, X4, X5, X6][];
export function cartesianProduct(...a: unknown[][]) {
    return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
}

type BackendCombination =
    `${MarkdownBackend}-${CodeBackend}-${MathBackend}-${TexBackend}`;

export async function generateTests(
    vary: Variables,
    tests: (
        | string
        | {
              label: string;
              input: string;
          }
    )[],
): Promise<
    {
        label: string;
        input: string;
        expected: Record<string, unknown>;
    }[]
> {
    const markdownBackends =
        vary.markdown === true
            ? ['marked', 'markdown-it', 'micromark', 'unified']
            : isArray(vary.markdown)
              ? vary.markdown
              : ['none'];
    const codeBackends =
        vary.code === true
            ? ['escape', 'highlight.js', 'starry-night']
            : isArray(vary.code)
              ? vary.code
              : ['none'];
    const mathBackends =
        vary.tex === true
            ? ['katex', 'mathjax']
            : isArray(vary.tex)
              ? vary.tex
              : ['none'];
    const texBackends = ['local'];

    const testsNew: {
        label: string;
        input: string;
        expected: Partial<Record<BackendCombination, unknown>>;
    }[] = tests.map((test) => {
        if (typeof test === 'string') {
            return { label: `input: "${test}"`, input: test, expected: {} };
        }
        const { label, input } = test;
        return { label, input, expected: {} };
    });

    for (const [markdown, code, math, tex] of cartesianProduct(
        markdownBackends,
        codeBackends,
        mathBackends,
        texBackends,
    ) as [MarkdownBackend, CodeBackend, MathBackend, TexBackend][]) {
        const backendCombination: BackendCombination = `${markdown}-${code}-${math}-${tex}`;
        const preprocessor = await sveltex({
            markdownBackend: markdown,
            codeBackend: code,
            mathBackend: math,
        });
        const preprocess = async (
            input: string,
            filename: string = 'test.sveltex',
        ) => {
            return (await preprocessor.markup({ content: input, filename }))
                ?.code;
        };
        for (const test of testsNew) {
            console.log('Generating test for', backendCombination, test.label);
            let input = '';
            if (typeof test === 'string') {
                input = test;
            } else {
                input = test.input;
            }
            test.expected[backendCombination] = await preprocess(input);
        }
        console.log('Generated tests for', backendCombination);
    }

    return testsNew;
}
