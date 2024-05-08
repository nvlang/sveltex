import {
    AdvancedTexBackend,
    CodeBackend,
    MarkdownBackend,
    TexBackend,
    sveltex,
} from '$sveltex-preprocess';
import { isArray } from '$type-guards';
import { escapeWhitespace } from '$utils';
import { it, expect } from 'vitest';

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
    for (let i = start; i < end; i += step) {
        arr.push(i);
    }
    return arr;
}

export const uuidV4Regexp =
    /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/;

interface Variables {
    markdown?: boolean | MarkdownBackend[];
    code?: boolean | CodeBackend[];
    tex?: boolean | TexBackend[];
    advancedTex?: boolean | AdvancedTexBackend[];
}

const cartesianProduct = (...a: unknown[][]) =>
    a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));

type BackendCombination =
    `${MarkdownBackend}-${CodeBackend}-${TexBackend}-${AdvancedTexBackend}`;

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
            ? ['escapeOnly', 'highlight.js', 'starry-night']
            : isArray(vary.code)
              ? vary.code
              : ['none'];
    const texBackends =
        vary.tex === true
            ? ['katex', 'mathjax']
            : isArray(vary.tex)
              ? vary.tex
              : ['none'];
    const advancedTexBackends =
        vary.advancedTex === true
            ? ['local', 'none']
            : isArray(vary.advancedTex)
              ? vary.advancedTex
              : ['none'];

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

    for (const [markdown, code, tex, advancedTex] of cartesianProduct(
        markdownBackends,
        codeBackends,
        texBackends,
        advancedTexBackends,
    ) as [MarkdownBackend, CodeBackend, TexBackend, AdvancedTexBackend][]) {
        const backendCombination: BackendCombination = `${markdown}-${code}-${tex}-${advancedTex}`;
        const preprocessor = await sveltex({
            markdownBackend: markdown,
            codeBackend: code,
            texBackend: tex,
            advancedTexBackend: advancedTex,
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
