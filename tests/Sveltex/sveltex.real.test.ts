/**
 * Realistic tests for the Sveltex processor.
 */
import type { AdvancedTexBackend } from '$types/handlers/AdvancedTex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { TexBackend } from '$types/handlers/Tex.js';

import { Sveltex, sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { isArray, isString } from '$type-guards/utils.js';
import { splitContent } from '$utils/misc.js';

import { assert, is, uuid } from '$deps.js';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    suite,
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
        texBackend: 'katex',
    }),
    await sveltex(
        {
            markdownBackend: 'micromark',
            codeBackend: 'escapeOnly',
            texBackend: 'mathjax',
            advancedTexBackend: 'local',
        },
        {
            advancedTex: {
                components: {
                    tex: { aliases: ['TeX'] },
                },
            },
        },
    ),
    await sveltex(
        {
            markdownBackend: 'micromark',
            codeBackend: 'starry-night',
            texBackend: 'mathjax',
        },
        {
            tex: {
                outputFormat: 'chtml',
            },
            code: {
                theme: { type: 'cdn', mode: 'dark', name: 'dimmed' },
            },
        },
    ),
    await sveltex(
        {
            codeBackend: 'highlight.js',
            texBackend: 'katex',
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
            tex: { css: { type: 'cdn', cdn: 'jsdelivr' } },
        },
    ),
    await sveltex(
        {
            codeBackend: 'highlight.js',
            texBackend: 'katex',
        },
        {
            code: { theme: { type: 'cdn', cdn: [] } },
            tex: { css: { type: 'cdn', cdn: [] } },
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
] as Sveltex<MarkdownBackend, CodeBackend, TexBackend, AdvancedTexBackend>[];

async function preprocess<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(
    preprocessor: Sveltex<M, C, T, A>,
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

suite('Sveltex', async () => {
    fixture();
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const {
        // ensureDir,
        // existsSync,
        // fancyWrite,
        log,
        // mkdir,
        // readFile,
        // readFileSync,
        // rename,
        // spawnCliInstruction,
        // writeFile,
        // writeFileEnsureDir,
    } = await spy(
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

    describe.each(preprocessors.filter((p) => p.markdownBackend !== 'none'))(
        'Markdown: $markdownBackend + $codeBackend + $texBackend + $advancedTexBackend',
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

    describe.each(preprocessors.filter((p) => p.texBackend !== 'none'))(
        'TeX: $markdownBackend + $codeBackend + $texBackend + $advancedTexBackend',
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
        'Code: $markdownBackend + $codeBackend + $texBackend + $advancedTexBackend',
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
    T extends TexBackend,
    A extends AdvancedTexBackend,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(p: Sveltex<M, C, T, A>, _content?: string): (string | RegExp)[] {
    const expected: (string | RegExp)[] = [];

    if (p.codeBackend === 'starry-night') {
        assert(is<Sveltex<M, 'starry-night', T, A>>(p));
        const theme = p.configuration.code.theme;
        // script
        // head
        if (
            theme.type === 'cdn' &&
            (isString(theme.cdn) || theme.cdn.length > 0)
        ) {
            expected.push(
                /<link rel=["']stylesheet["'] href=["']https:.*starry-night.*css.*["']/,
            );
        }
        // script
        if (theme.type === 'self-hosted') {
            expected.push(/import '.*starry-night.*css.*'/);
        }
        // content
        expected.push('<code');
    } else if (p.codeBackend === 'highlight.js') {
        assert(is<Sveltex<M, 'highlight.js', T, A>>(p));
        const theme = p.configuration.code.theme;
        // head
        if (
            theme.type === 'cdn' &&
            (isString(theme.cdn) || theme.cdn.length > 0)
        ) {
            expected.push(
                /<link rel=["']stylesheet["'] href=["']https:.*highlight.js.*css.*["']/,
            );
        }
        // script
        if (theme.type === 'self-hosted') {
            expected.push(/import '.*highlight.js.*css.*'/);
        }
        // content
        expected.push('<code');
    }
    return expected;
}

function expectedTex<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(p: Sveltex<M, C, T, A>, _content?: string): (string | RegExp)[] {
    const expected: (string | RegExp)[] = [];
    if (p.texBackend === 'mathjax') {
        assert(is<Sveltex<M, C, 'mathjax', A>>(p));
        // script
        if (p.configuration.tex.css.type === 'self-hosted') {
            // expected.push(/import '.*mathjax.*css.*'/);
        }
        // content
        if (p.configuration.tex.outputFormat === 'svg') {
            expected.push('<svg');
        } else {
            expected.push('<mjx-container class="MathJax"');
        }
    } else if (p.texBackend === 'katex') {
        assert(is<Sveltex<M, C, 'katex', A>>(p));
        // head
        if (
            p.configuration.tex.css.type === 'cdn' &&
            (isString(p.configuration.tex.css.cdn) ||
                p.configuration.tex.css.cdn.length > 0)
        ) {
            expected.push(/<link rel="stylesheet" href="https:.*katex.*css.*"/);
        }
        // script
        if (p.configuration.tex.css.type === 'self-hosted') {
            expected.push(/import '.*katex.*css.*'/);
        }
        // content
        expected.push('<span class="katex');
    }
    return expected;
}
