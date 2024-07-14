/**
 * Realistic tests for the Sveltex processor.
 */
import type { CodeBackend } from '$types/handlers/Code.js';
import type {
    MarkdownBackend,
    MarkdownConfiguration,
} from '$types/handlers/Markdown.js';
import type { MathBackend } from '$types/handlers/Math.js';

import { type Sveltex, sveltex } from '$base/Sveltex.js';
import { spy } from '$tests/unit/fixtures.js';
import { isArray, isString } from '$typeGuards/utils.js';
import { re } from '$utils/misc.js';

import { typeAssert, is, uuid } from '$deps.js';
import {
    type MockInstance,
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { cartesianProduct } from '$tests/unit/utils.js';
import { mergeConfigs } from '$utils/merge.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

const preprocessors = [
    await sveltex({}, { code: {} }),
    await sveltex({ markdownBackend: 'marked' }),
    await sveltex({ markdownBackend: 'unified', codeBackend: 'starry-night' }),
    await sveltex({
        markdownBackend: 'markdown-it',
        codeBackend: 'highlight.js',
        mathBackend: 'katex',
    }),
    await sveltex(
        {
            markdownBackend: 'micromark',
            codeBackend: 'escape',
            mathBackend: 'mathjax',
        },
        {
            math: { css: { type: 'none' } },
            verbatim: { tex: { type: 'tex', aliases: ['TeX'] } },
        },
    ),
    await sveltex(
        {
            markdownBackend: 'micromark',
            codeBackend: 'starry-night',
            mathBackend: 'mathjax',
        },
        {
            math: { outputFormat: 'chtml', css: { type: 'none' } },
            code: { theme: { type: 'cdn', mode: 'dark', name: 'dimmed' } },
        },
    ),
    await sveltex(
        {
            codeBackend: 'highlight.js',
            mathBackend: 'katex',
        },
        {
            code: {
                theme: {
                    type: 'self-hosted',
                    cdn: 'jsdelivr',
                    min: false,
                    name: 'tokyo-night-dark',
                },
            },
            math: { css: { type: 'cdn', cdn: 'jsdelivr' } },
        },
    ),
    await sveltex(
        { codeBackend: 'highlight.js', mathBackend: 'katex' },
        { code: { theme: { type: 'cdn' } }, math: { css: { type: 'cdn' } } },
    ),
    await sveltex(
        { codeBackend: 'highlight.js' },
        { code: { theme: { type: 'none' } } },
    ),
    await sveltex(
        {
            markdownBackend: 'unified',
            mathBackend: 'katex',
            codeBackend: 'shiki',
        },
        {},
    ),
    await sveltex(
        {
            markdownBackend: 'markdown-it',
            mathBackend: 'mathjax',
            codeBackend: 'shiki',
        },
        { code: { shiki: { theme: 'nord' } } },
    ),
    await sveltex(
        {
            markdownBackend: 'micromark',
            mathBackend: 'katex',
            codeBackend: 'shiki',
        },
        { code: { shiki: { theme: 'nord' } } },
    ),
] as Sveltex<MarkdownBackend, CodeBackend, MathBackend>[];

function splitContent(content: string): string[] {
    return content.match(splitContentRegExp) ?? [];
}

const splitContentRegExp = re`
    (?:
        <script [^>]* > .*? <\/script>  # script block
        | <style [^>]* > .*? <\/style>  # style block
        | .+? (?=<script|<style|$))
    ${'gsu'}
`;

async function preprocess<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
>(
    preprocessor: Sveltex<M, C, T>,
    content: string,
    filename: string = `${uuid()}.sveltex`,
) {
    let markup = (await preprocessor.markup({ content, filename }))?.code ?? '';
    const scriptContent =
        splitContent(content)
            .find((c) => c.startsWith('<script'))
            ?.match(/<script[^>]*>([\w\W]*)<\/script>/i)?.[1] ?? '';
    const resultScript = await preprocessor.script({
        content: scriptContent,
        filename,
        attributes: {},
        markup,
    });
    const script = resultScript?.code;
    if (script) {
        markup = markup.replace(
            /(<script[^>]*?>)[\w\W]*?(<\/script>)/i,
            `$1${script}$2`,
        );
    }
    return markup;
}

describe('Sveltex', () => {
    let log: MockInstance;
    fixture();
    beforeAll(async () => {
        const mocks = await spy(
            [
                'ensureDir',
                'existsSync',
                'fancyWrite',
                'log',
                'mkdir',
                'readFile',
                'readFileSync',
                'rename',
                'spawnCliInstruction',
                'writeFile',
                'writeFileSync',
                'writeFileEnsureDir',
                'writeFileEnsureDirSync',
            ],
            true,
        );
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe.each(preprocessors.filter((p) => p.markdownBackend !== 'none'))(
        'Markdown: $markdownBackend + $codeBackend + $mathBackend',
        (p) => {
            it.each([
                ['*italic*', '<em>italic</em>'],
                ['**bold**', '<strong>bold</strong>'],
                ['<span>foo</span> bar', '<p><span>foo</span> bar</p>'],
                ['foo <span>bar</span>', '<p>foo <span>bar</span></p>'],
                ['foo <span>bar\n</span>', '<p>foo <span>bar</span></p>'],
                ['foo <span>\nbar</span>', '<p>foo <span>bar</span></p>'],
                // ['foo <span>\n\nbar\n\n</span>', '<p>foo <span>bar</span></p>'], // I'm not sure how this should be handled yet
                [
                    '[link](https://example.com)',
                    '<a href="https://example.com">link</a>',
                ],
                [
                    '![image](https://example.com)',
                    '<img src="https://example.com" alt="image"',
                ],
                [
                    '> blockquote',
                    '<blockquote>\n<p>blockquote</p>\n</blockquote>',
                ],
                [
                    '<script>console.log("*script*")</script>',
                    '<script>console.log("*script*")</script>',
                ],
                [
                    '<style>/*comment*/ body { color: red; }</style>',
                    '<style>/*comment*/ body { color: red; }</style>',
                ],
                // [wikipediaHtmlExcerpt, wikipediaHtmlExcerpt],
                ...cartesianProduct(
                    ['foo', 'div', 'p', 'span'],
                    [0, 1, 2],
                    [0, 1, 2],
                    [() => true, () => false],
                ).map(([tag, x, y, prefersInline]) => [
                    `<${tag}>${'\n'.repeat(x)}*italic*${'\n'.repeat(y)}</${tag}>`,
                    (x === 2 || (x === 1 && !prefersInline())) &&
                    tag !== 'span' &&
                    tag !== 'p'
                        ? `<${tag}>\n<p><em>italic</em></p>\n</${tag}>`
                        : `<${tag}><em>italic</em></${tag}>`,
                    { prefersInline },
                ]),
            ] as [string, string, MarkdownConfiguration<MarkdownBackend>?][])(
                '%o → %o (%s)',
                async (input, expected, configuration) => {
                    let output;
                    if (configuration) {
                        const originalConfiguration = p.configuration;
                        const { codeBackend, mathBackend, markdownBackend } = p;
                        const configuredPreprocessor = await sveltex(
                            { codeBackend, mathBackend, markdownBackend },
                            mergeConfigs(originalConfiguration, {
                                markdown: configuration,
                            }),
                        );
                        output = await preprocess(
                            configuredPreprocessor,
                            input,
                        );
                    } else {
                        output = await preprocess(p, input);
                    }
                    if (p.markdownBackend === 'marked') {
                        // Marked doesn't currently collapse consecutive '\n's,
                        // contrary to CommonMark specification.
                        output = output.replaceAll(/\n{2,}/g, '\n');
                    }
                    expect(output).toMatch(expected);
                    expect(log).not.toHaveBeenCalled();
                },
            );
        },
    );

    describe.each(preprocessors.filter((p) => p.mathBackend !== 'none'))(
        'TeX: $markdownBackend + $codeBackend + $mathBackend',
        (p) => {
            fixture();
            it.each([
                ['$x$', expectedTex(p)],
                [
                    "<script>\nconsole.log(' $ something $ ')\n</script>\n$x$",
                    [...expectedTex(p), "console.log(' $ something $ ')"],
                ],
                [
                    '<svelte:head>\n<link rel="stylesheet" href="/example.css" />\n</svelte:head>\n$x$',
                    [
                        ...expectedTex(p),
                        '<link rel="stylesheet" href="/example.css" />',
                    ],
                ],
                [
                    '<script>\nconsole.log(\' $ something $ \')\n</script>\n<svelte:head>\n<link rel="stylesheet" href="/example.css" />\n</svelte:head>\n$x$',
                    [
                        ...expectedTex(p),
                        '<link rel="stylesheet" href="/example.css" />',
                        "console.log(' $ something $ ')",
                    ],
                ],
            ])('%s → %s', async (input, expected) => {
                const result = await preprocess(p, input);
                if (isArray(expected)) {
                    expected.forEach((e) => {
                        expect(result).toMatch(e);
                    });
                } else {
                    expect(result).toMatch(expected);
                }
                expect(log).not.toHaveBeenCalled();
            });
        },
    );

    describe.each(preprocessors.filter((p) => p.codeBackend !== 'none'))(
        'Code: $markdownBackend + $codeBackend + $mathBackend',
        (p) => {
            fixture();
            it.each([
                ['`x`', expectedCode(p)],
                [
                    "<script>\nconsole.log(' $ something $ ')\n</script>\n`x`",
                    [...expectedCode(p), "console.log(' $ something $ ')"],
                ],
                [
                    '<svelte:head>\n<link rel="stylesheet" href="/example.css" />\n</svelte:head>\n`x`',
                    [
                        ...expectedCode(p),
                        '<link rel="stylesheet" href="/example.css" />',
                    ],
                ],
                [
                    '<script>\nconsole.log(\' $ something $ \')\n</script>\n<svelte:head>\n<link rel="stylesheet" href="/example.css" />\n</svelte:head>\n`x`',
                    [
                        ...expectedCode(p),
                        '<link rel="stylesheet" href="/example.css" />',
                        "console.log(' $ something $ ')",
                    ],
                ],
                [
                    '```unknown-language\nx\n```',
                    expectedCode(p),
                    p.codeBackend === 'escape'
                        ? undefined
                        : [[1, 'unknown-language']],
                ],
                [
                    '`js let a = 2;`',
                    [
                        ...expectedCode(p),
                        ...(p.codeBackend === 'escape' ? [] : ['<span']),
                    ],
                ],
                [
                    '```js\nlet a = 2;\n```',
                    [
                        ...expectedCode(p),
                        ...(p.codeBackend === 'escape' ? [] : ['<span']),
                    ],
                ],
            ] as [
                string,
                string | RegExp | (string | RegExp)[],
                [number, string | RegExp][]?,
            ][])('%s → %s', async (input, expected, logCalls) => {
                const result = await preprocess(p, input);
                if (isArray(expected)) {
                    expected.forEach((e) => {
                        expect(result).toMatch(e);
                    });
                } else {
                    expect(result).toMatch(expected);
                }
                if (logCalls) {
                    expect(log).toHaveBeenCalledTimes(logCalls.length);
                    logCalls.forEach(([index, call]) => {
                        expect(log).toHaveBeenNthCalledWith(
                            index,
                            expect.stringMatching(/warn|error/),
                            expect.stringMatching(call),
                        );
                    });
                } else {
                    expect(log).not.toHaveBeenCalled();
                }
            });
        },
    );
});

function expectedCode<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(p: Sveltex<M, C, T>, _content?: string): (string | RegExp)[] {
    const expected: (string | RegExp)[] = [];

    if (p.codeBackend === 'starry-night') {
        typeAssert(is<Sveltex<M, 'starry-night', T>>(p));
        const theme = p.configuration.code.theme;
        // script
        // head
        if (theme.type === 'cdn' && isString(theme.cdn)) {
            expected.push(
                /<link rel=["']stylesheet["'] href=["']https:.*starry-night.*css.*["']/,
            );
        }
        // script
        if (theme.type === 'self-hosted') {
            expected.push(/<link .*starry-night.*css.*/);
        }
    } else if (p.codeBackend === 'highlight.js') {
        typeAssert(is<Sveltex<M, 'highlight.js', T>>(p));
        const theme = p.configuration.code.theme;
        // head
        if (theme.type === 'cdn' && isString(theme.cdn)) {
            expected.push(
                /<link rel=["']stylesheet["'] href=["']https:.*highlight.js.*css.*["']/,
            );
        }
        // script
        if (theme.type === 'self-hosted') {
            expected.push(/<link .*highlight.js.*css.*/);
        }
    }
    if (p.codeBackend !== 'none') {
        // content
        expected.push('<code');
    }
    return expected;
}

function expectedTex<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends MathBackend,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(p: Sveltex<M, C, T>, _content?: string): (string | RegExp)[] {
    const expected: (string | RegExp)[] = [];
    if (p.mathBackend === 'mathjax') {
        typeAssert(is<Sveltex<M, C, 'mathjax'>>(p));
        // script
        if (p.configuration.math.css.type === 'hybrid') {
            // expected.push(/import '.*mathjax.*css.*'/);
        }
        // content
        if (p.configuration.math.outputFormat === 'svg') {
            expected.push('<svg');
        } else {
            expected.push('<mjx-container class="MathJax"');
        }
    } else if (p.mathBackend === 'katex') {
        typeAssert(is<Sveltex<M, C, 'katex'>>(p));
        // head
        if (
            p.configuration.math.css.type === 'cdn' &&
            isString(p.configuration.math.css.cdn)
        ) {
            expected.push(/<link rel="stylesheet" href="https:.*katex.*css.*"/);
        }
        // script
        if (p.configuration.math.css.type === 'hybrid') {
            expected.push(/<link rel="stylesheet" href=".*katex.*css.*"/);
        }
        // content
        expected.push('<span class="katex');
    }
    return expected;
}
