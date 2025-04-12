import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sveltex } from '$base/Sveltex.js';
import { cartesianProduct } from '$tests/unit/utils.js';
import {
    codeBackends,
    markdownBackends,
} from '$utils/diagnosers/backendChoices.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import { nodeAssert } from '$deps.js';
import { commonMarkSpec } from '$tests/unit/base/Sveltex/commonmark.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

const mainMarkdownBackends = markdownBackends.filter(
    (b) => b !== 'none' && b !== 'custom',
);
const mainCodeBackends = codeBackends.filter((b) => b !== 'none');
const backendCombinations = cartesianProduct(
    mainMarkdownBackends,
    mainCodeBackends,
);

const processors = await Promise.all(
    backendCombinations.map(
        async ([markdownBackend, codeBackend]) =>
            await sveltex(
                {
                    codeBackend,
                    markdownBackend,
                },
                codeBackend === 'highlight.js' || codeBackend === 'starry-night'
                    ? {
                          code: { theme: { type: 'none' } },
                          markdown: { strict: true },
                      }
                    : { markdown: { strict: true } },
            ),
    ),
);

const processorsMarkdownOnly = await Promise.all(
    mainMarkdownBackends.map(
        async (markdownBackend) =>
            await sveltex(
                { markdownBackend, codeBackend: 'escape' },
                { markdown: { strict: true } },
            ),
    ),
);

describe('CommonMark compliance', () => {
    const sections: string[] = [];
    commonMarkSpec.forEach(({ section }) => {
        if (
            !sections.includes(section) &&
            section !== 'Indented code blocks' &&
            section !== 'Autolinks'
        )
            sections.push(section);
    });
    describe.concurrent.each(processorsMarkdownOnly)(
        '$markdownBackend',
        (s) => {
            describe.concurrent.each(sections)('%s', (section) => {
                fixture();
                it.concurrent.each(
                    commonMarkSpec.filter(
                        ({ section: sec, markdown, example }) =>
                            sec === section &&
                            !/(^|\n|-|>)\s*([ ]{4,}|\t)/.test(markdown) &&
                            !exceptions.all.includes(example) &&
                            !exceptions[s.markdownBackend].includes(example),
                    ),
                )(
                    '$example: $markdown',
                    async ({ markdown, html, example }) => {
                        // const log = (
                        //     await spy(['log', 'fancyWrite', 'writeFile'], false)
                        // ).log;
                        if (
                            exceptions.all.includes(example) ||
                            exceptions[s.markdownBackend].includes(example)
                        ) {
                            return;
                        }
                        const expected = normalizeHtml(html, s.markdownBackend);
                        let actual = (
                            await s.markup({
                                content: markdown,
                                filename: `${s.markdownBackend}-${String(example)}.sveltex`,
                            })
                        )?.code;
                        expect(actual).toBeDefined();
                        nodeAssert(actual !== undefined);
                        actual = actual.replace('<script>\n</script>\n', '');
                        actual = actual.replace(
                            '<script context="module">\n</script>\n',
                            '',
                        );
                        actual = normalizeHtml(actual, s.markdownBackend);
                        expect(actual).toEqual(expected);
                        vi.restoreAllMocks();
                    },
                );
            });
        },
    );
});

describe.concurrent('CommonMark compliance (with highlighters)', () => {
    const sections = ['Code spans', 'Fenced code blocks'];
    describe.each(sections)('%s', (section) => {
        describe.each(processors)('$markdownBackend + $codeBackend', (s) => {
            it.sequential.each(
                commonMarkSpec.filter(
                    ({ section: sec, markdown, example }) =>
                        sec === section &&
                        !/(^|\n|-|>)\s*([ ]{4,}|\t)/.test(markdown) &&
                        !exceptions.all.includes(example) &&
                        !exceptions[s.markdownBackend].includes(example),
                ),
            )('$example: $markdown', async ({ markdown, html, example }) => {
                const code = (
                    await s.markup({
                        content: markdown,
                        filename: `${String(example)}.sveltex`,
                    })
                )?.code;
                let expected: string = html;
                // code = code?.replaceAll(' class="language-plaintext"', '');
                // html = html.replace(/<p>(.*?)<\/p>/gsu, '$1');
                // code = code?.replace(/<p>(.*?)<\/p>/gsu, '$1');

                expect(code).toBeDefined();
                nodeAssert(code !== undefined);
                // The CommonMark tests don't take into account any actual
                // syntax highlighting (which is completely fair, of course —
                // that's not part of the spec). However, in our case, we still
                // want to test some of the behavior even when a syntax
                // highlighter is being used. So, we need to remove the syntax
                // highlighting parts from the output, so that we can compare
                // the rest of the output to the expected output. NB: it is not
                // always trivial (or true) that "(syntax highlighted code) -
                // (highlighting tags) = (original code, with special characters
                // escaped)".
                let actual = code
                    .replace(/<script[^>]*>.*?<\/script>\n/gs, '')
                    .replace(/<svelte:head>.*?<\/svelte:head>\n/s, '')
                    .replaceAll(/<\/?span[^>]*>/g, '')
                    .replaceAll(/class="(language-\S+)?.*?"/g, 'class="$1"')
                    .replaceAll(' class=""', '');
                if (s.codeBackend === 'shiki') {
                    actual = actual
                        .replaceAll(/ style=".*?"/g, '')
                        .replaceAll(/ tabindex=".*?"/g, '')
                        .replaceAll(/ startline=".*?"/g, '')
                        // shiki escapes double quotes. Since this shouldn't
                        // make any difference in practice, it seems acceptable
                        // to me to ignore that discrepancy in the test.
                        .replaceAll('"', '&quot;');
                    // shiki escapes < differently. Since this shouldn't make
                    // any difference in practice, it seems acceptable to me to
                    // ignore that discrepancy in the test.
                    expected = expected.replaceAll('&lt;', '&#x3C;');
                }
                if (s.markdownBackend === 'unified') {
                    actual = actual.replaceAll('"', '&quot;');
                    // unified doesn't escape > (as it's technically
                    // superfluous). Since this shouldn't make any difference in
                    // practice, it seems acceptable to me to ignore that
                    // discrepancy in the test.
                    expected = expected.replaceAll('&gt;', '>');
                }
                if (s.codeBackend === 'shiki') {
                    expected = expected.replaceAll('&gt;', '>');
                    actual = actual.replaceAll('&gt;', '>');
                }
                actual = normalizeHtml(actual, s.markdownBackend);
                expected = normalizeHtml(expected, s.markdownBackend);
                expect(actual).toEqual(expected);
            });
        });
    });
});

describe('CommonMark non-compliance', () => {
    describe.concurrent.each(processorsMarkdownOnly)(
        '$markdownBackend',
        (s) => {
            const sections: string[] = [];
            commonMarkSpec.forEach(({ example, section }) => {
                if (
                    !sections.includes(section) &&
                    (exceptions.all.includes(example) ||
                        exceptions[s.markdownBackend].includes(example) ||
                        section === 'Indented code blocks' ||
                        section === 'Autolinks')
                )
                    sections.push(section);
            });
            describe.concurrent.each(sections)('%s', (section) => {
                fixture();
                it.concurrent.each(
                    commonMarkSpec.filter(
                        ({ section: sec, example }) =>
                            sec === section &&
                            !nonexamples.includes(example) &&
                            (exceptions.all.includes(example) ||
                                exceptions[s.markdownBackend].includes(
                                    example,
                                ) ||
                                sec === 'Autolinks' ||
                                sec === 'Indented code blocks'),
                    ),
                )(
                    '$example: $markdown',
                    async ({ markdown, html, example }) => {
                        // const log = (
                        //     await spy(['log', 'fancyWrite', 'writeFile'], false)
                        // ).log;
                        if (
                            exceptions.all.includes(example) ||
                            exceptions[s.markdownBackend].includes(example)
                        ) {
                            return;
                        }
                        const expected = normalizeHtml(html, s.markdownBackend);
                        let actual = (
                            await s.markup({
                                content: markdown,
                                filename: `${s.markdownBackend}-${String(example)}.sveltex`,
                            })
                        )?.code;
                        expect(actual).toBeDefined();
                        nodeAssert(actual !== undefined);
                        actual = actual.replace('<script>\n</script>\n', '');
                        actual = actual.replace(
                            '<script context="module">\n</script>\n',
                            '',
                        );
                        actual = normalizeHtml(actual, s.markdownBackend);
                        expect(actual).not.toEqual(expected);
                    },
                );
            });
        },
    );
});

/**
 * These are examples from the "Autolinks" and "Indented code blocks" sections
 * which _do_ pass the tests, but only because they're "nonexamples" in the
 * spec; for instance, example 108 stipulates that the following markdown
 *
 * ```markdown
 *   - foo
 *
 *     bar
 * ```
 *
 * should become
 *
 * ```html
 * <ul>
 * <li>
 * <p>foo</p>
 * <p>bar</p>
 * </li>
 * </ul>
 * ```
 *
 * and, as such, is a non-example wrt. indented code blocks.
 */
const nonexamples = [108, 109, 113, 602, 606, 607, 608, 609, 610, 611, 612];

const exceptions: Record<
    'all' | Exclude<MarkdownBackend, 'none' | 'custom'>,
    number[]
> = {
    // Notes:
    // 321: I really don't like CommonMark's behavior here, so I'm kinda glad
    // that 3/4 processors below fail this test.

    all: [
        20, // autolink
        96, // frontmatter
        98, // frontmatter
        161,
        321, // - a\n  > b\n  ```\n  c\n  ```\n- d\n
        344, // <a href="`">`\n
        346, // autolink
        480, // autolink
        481, // autolink
        507, // weird link
        526, // autolink
        538, // autolink
    ],
    micromark: [
        500, // [link](foo\\)\\:)\n
    ],
    unified: [102],
    'markdown-it': [],
    marked: [
        // Differences in escaping
        ...[25, 26, 27, 28, 30, 32, 33, 37, 38, 39, 40],
        237, // > ```\nfoo\n```
        497, // [link](foo(and(bar))\n
        512, // [link [foo [bar]]](/uri)\n
        518,
        519,
        520,
        524,
        528,
        532,
        533,
        536,
        540,
        573,
        574,
        575,
        576,
        577,
        585,
        589,
    ],
};

function normalizeHtml(html: string, backend?: MarkdownBackend) {
    if (backend === 'unified') {
        html = html.replaceAll('&gt;', '>');
    }
    if (backend === 'marked') {
        html = html.replaceAll('&#39;', "'");
    }
    html = html
        .trim()

        //
        .replace(
            /<(div|p|blockquote|h\d|li)>\s*(\S.*?\S)\s*<\/\1>/gs,
            '<$1>$2</$1>',
        )
        // collapse spaces
        .replace(/(\s)\1*/g, '$1')
        .replace(/[ \t\r]*\n[ \t\r]*/g, '\n')
        .replace(/\n/g, '')
        .replaceAll('&#x3C;', '&lt;')
        .replaceAll('&#x3E;', '&gt;')
        .replaceAll('&#x26;', '&amp;')
        .replaceAll('&#x22;', '&quot;')
        .replaceAll('&quot;', '"')
        .replaceAll('%C2', '"')
        .replaceAll('%C3%A4', '&auml;')
        // normalize self-closing components
        .replaceAll(' />', '>');
    return html;
}
