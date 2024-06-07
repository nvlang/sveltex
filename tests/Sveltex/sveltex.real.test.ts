/**
 * Realistic tests for the Sveltex processor.
 */
import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { MathBackend } from '$types/handlers/Math.js';

import { Sveltex, sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { isArray, isString } from '$type-guards/utils.js';
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
            codeBackend: 'escapeOnly',
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
        {
            codeBackend: 'highlight.js',
            mathBackend: 'katex',
        },
        {
            code: { theme: { type: 'cdn' } },
            math: { css: { type: 'cdn' } },
        },
    ),
    await sveltex(
        {
            codeBackend: 'highlight.js',
        },
        {
            code: { theme: { type: 'none' } },
        },
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
            ?.match(/<script[^>]*>([\w\W]*)<\/script>/)?.[1] ?? '';
    const resultScript = await preprocessor.script({
        content: scriptContent,
        filename,
        attributes: {},
        markup,
    });
    const script = resultScript?.code;
    if (script) {
        markup = markup.replace(
            /(<script[^>]*?>)[\w\W]*?(<\/script>)/,
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
                'writeFileEnsureDir',
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
            ])('%s → %s', async (input, expected) => {
                expect(await preprocess(p, input)).toMatch(expected);
                expect(log).not.toHaveBeenCalled();
            });
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
            expected.push(/import '.*starry-night.*css.*'/);
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
            expected.push(/import '.*highlight.js.*css.*'/);
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
