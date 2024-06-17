import { describe, expect, test } from 'vitest';

import { sveltex } from '$Sveltex.js';
import type { MarkdownBackend, MarkdownConfiguration } from '$mod.js';
import { uuid, type MdastRoot } from '$deps.js';
import { markdownBackends } from '$utils/diagnosers/backendChoices.js';
import {
    hastscriptH,
    markdownItMultimdTablePlugin,
    micromarkGfm,
    micromarkGfmHtml,
    rehypeSlug,
    remarkDirective,
    unistVisit,
} from '$dev_deps.js';
import { countNewlines } from '$handlers/MarkdownHandler.js';
import { isArray } from '$typeGuards/utils.js';

describe('MarkdownHandler<MarkdownBackend>', () => {
    describe.each([
        [
            '{ prefersInline: () => true }',
            { prefersInline: () => true },
            [['<div>\n*a*\n</div>', '<div><em>a</em></div>']],
        ],
        [
            '{ prefersInline: () => false }',
            { prefersInline: () => false },
            [['<div>\n*a*\n</div>', '<div>\n<p><em>a</em></p>\n</div>']],
        ],
        [
            '{ transformers: { pre: (str) => `*${str}*` } }',
            { transformers: { pre: (str) => `*${str}*` } },
            [['abc', '<em>abc</em>']],
        ],
        [
            '{ transformers: { post: (str) => `*${str}*` } }',
            { transformers: { post: (str) => `*${str}*` } },
            [['abc', /\*\n?<p>abc<\/p>\n?\*/]],
        ],
    ] as [
        string,
        MarkdownConfiguration<MarkdownBackend>,
        [string, string][],
    ][])('%s', (_label, configuration, samples) => {
        describe.each(
            markdownBackends.filter((b) => !['none', 'custom'].includes(b)),
        )('%s', (markdownBackend) => {
            test.each(samples)('%o → %o', async (input, expected) => {
                const processor = await sveltex(
                    { markdownBackend },
                    { markdown: configuration },
                );
                let output =
                    (
                        await processor.markup({
                            filename: uuid() + '.sveltex',
                            content: input,
                        })
                    )?.code ?? input;
                if (markdownBackend === 'marked') {
                    // Marked doesn't currently collapse consecutive '\n's,
                    // contrary to CommonMark specification. Since this doesn't
                    // affect how the output is eventually rendered, we make the
                    // test insensitive to this.
                    output = output.replaceAll(/\n{2,}/g, '\n');
                }
                expect(output).toMatch(expected);
            });
        });
    });
});

describe.each([
    [
        'marked',
        [
            [
                { options: { gfm: true, breaks: true } },
                [['a\nb', '<p>a<br>b</p>\n']],
            ],
            [
                { options: { gfm: false, breaks: false } },
                [['a\nb', '<p>a\nb</p>\n']],
            ],
        ],
    ],
    [
        'micromark',
        [
            [
                { options: { allowDangerousProtocol: false } },
                [
                    [
                        '[example](unsafe://example.com)',
                        '<p><a href="">example</a></p>',
                    ],
                ],
            ],
            [{ options: { extensions: null } }, [['*a*', '<p><em>a</em></p>']]],
            [
                {
                    options: {
                        extensions: [micromarkGfm()],
                        htmlExtensions: [micromarkGfmHtml()],
                    },
                },
                [
                    ['~strikethrough~', '<del>strikethrough</del>'],
                    [
                        '...[^1]\n\n[^1]: Footnote text.',
                        ['class="footnotes"', 'Footnote text.'],
                    ],
                    ['| a | b |\n|---|---|\n| c | d |', '<table>'],
                    ['https://example.com', '<a href="https://example.com">'],
                    [
                        '- [ ] 1\n- [x] 2',
                        [
                            '<input type="checkbox" disabled="" />',
                            '<input type="checkbox" disabled="" checked="" />',
                        ],
                    ],
                ],
            ],
        ],
    ],
    [
        'markdown-it',
        [
            [
                { options: { breaks: true, xhtmlOut: true } },
                [['a\nb', '<p>a<br />\nb</p>\n']],
            ],
            [
                { options: { breaks: true, xhtmlOut: false } },
                [['a\nb', '<p>a<br>\nb</p>\n']],
            ],
            [{ options: { breaks: false } }, [['a\nb', '<p>a\nb</p>\n']]],
            [
                {
                    extensions: [
                        [
                            markdownItMultimdTablePlugin,
                            { multibody: true, autolabel: true },
                        ],
                    ],
                },
                [
                    [
                        '' +
                            '|             |          Grouping           || \n' +
                            'First Header  | Second Header | Third Header | \n' +
                            ' ------------ | :-----------: | -----------: | \n' +
                            'Content       |          *Long Cell*        || \n' +
                            'Content       |   **Cell**    |         Cell | \n' +
                            '                                               \n' +
                            'New section   |     More      |         Data | \n' +
                            "And more      | With an escaped '\\|'       || \n" +
                            '[Prototype table]                              \n',
                        '<table>\n<caption id="prototypetable" style="caption-side: bottom">Prototype table</caption>\n<thead>\n<tr>\n<th></th>\n<th style="text-align:center" colspan="2">Grouping</th>\n</tr>\n<tr>\n<th>First Header</th>\n<th style="text-align:center">Second Header</th>\n<th style="text-align:right">Third Header</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>Content</td>\n<td style="text-align:center" colspan="2"><em>Long Cell</em></td>\n</tr>\n<tr>\n<td>Content</td>\n<td style="text-align:center"><strong>Cell</strong></td>\n<td style="text-align:right">Cell</td>\n</tr>\n</tbody>\n<tbody>\n<tr>\n<td>New section</td>\n<td style="text-align:center">More</td>\n<td style="text-align:right">Data</td>\n</tr>\n<tr>\n<td>And more</td>\n<td style="text-align:center" colspan="2">With an escaped \'|\'</td>\n</tr>\n</tbody>\n</table>\n',
                    ],
                ],
            ],
            [
                {
                    extensions: [markdownItMultimdTablePlugin],
                },
                [['| a | b |\n|---|---|\n| c | d |', '<table>']],
            ],
        ],
    ],
    [
        'unified',
        [
            [{}, [['abc', 'abc']]],
            [
                { rehypePlugins: [rehypeSlug] },
                [
                    [
                        '# Example header 1',
                        '<h1 id="example-header-1">Example header 1</h1>',
                    ],
                ],
            ],
            [
                {
                    remarkPlugins: [
                        remarkDirective,
                        remarkDirectiveExamplePlugin,
                    ],
                },
                [
                    [
                        ':::note{.example}\ntext {mustacheTag} :hr text\n:::',
                        '<div class="example"><p>text {mustacheTag} <div></div> text</p></div>',
                    ],
                ],
            ],
            [
                { remarkPlugins: [remarkDirective] },
                [
                    [
                        ':::note{.example}\ntext {mustacheTag} :hr text\n:::',
                        '<div><p>text {mustacheTag} <div></div> text</p></div>',
                    ],
                ],
            ],
            [
                {},
                [
                    [
                        ':::note{.example}\ntext {mustacheTag} :hr text\n:::',
                        '<p>:::note{.example}\ntext {mustacheTag} :hr text\n:::</p>',
                    ],
                ],
            ],
            [
                {
                    directives: {
                        enabled: true,
                        bracesArePartOfDirective: () => true,
                    },
                },
                [
                    [
                        '::: example { 1*2*3 }\ntext\n:::',
                        '<p>::: example { 1<em>2</em>3 }\ntext\n:::</p>',
                    ],
                ],
            ],
        ],
    ],
    ['custom', [[{ process: (str) => str + str }, [['abc', 'abcabc']]]]],
    ['custom', [[undefined, [['abc', 'abc']]]]],
    ['none', [[{}, [['abc', 'abc']]]]],
    [
        'none',
        [[{ transformers: { pre: null, post: ['a', '1'] } }, [['abc', '1bc']]]],
    ],
] as [
    MarkdownBackend,
    [
        MarkdownConfiguration<MarkdownBackend> | undefined,
        [string, (string | RegExp) | (string | RegExp)[]][],
    ][],
][])('MarkdownHandler<%o>', (markdownBackend, tests) => {
    test.each(tests)('%o', async (configuration, samples) => {
        const processor = await sveltex(
            { markdownBackend },
            { markdown: configuration },
        );
        for (const [input, expected] of samples) {
            const output = (
                await processor.markup({
                    filename: uuid() + '.sveltex',
                    content: input,
                })
            )?.code;
            if (isArray(expected)) {
                for (const e of expected) {
                    expect(output).toMatch(e);
                }
            } else {
                expect(output).toMatch(expected);
            }
        }
    });
});

/* -------------------------------------------------------------------------- */
/*     Example remark directive plugin, taken from remark-directive readme    */
/* -------------------------------------------------------------------------- */

// This plugin is an example to turn `::note` into divs, passing arbitrary
// attributes.
function remarkDirectiveExamplePlugin(): (tree: MdastRoot) => void {
    return (tree) => {
        unistVisit(tree, (node) => {
            if (
                node.type === 'containerDirective' ||
                node.type === 'leafDirective' ||
                node.type === 'textDirective'
            ) {
                if (node.name !== 'note') return;

                const data = node.data ?? (node.data = {});
                const tagName = node.type === 'textDirective' ? 'span' : 'div';

                data.hName = tagName;
                data.hProperties = hastscriptH(
                    tagName,
                    node.attributes ?? {},
                ).properties;
            }
        });
    };
}

/* -------------------------------------------------------------------------- */
/*                                Miscellaneous                               */
/* -------------------------------------------------------------------------- */

describe('countNewlines()', () => {
    test.each([
        ['', 0],
        ['\n', 1],
        ['\n\n', 2],
        ['1\n2', 1],
        ['\n1\n', 2],
        ['1\n', 1],
        ['\n1', 1],
        ['', 0],
        ['\r', 1],
        ['\r\r', 2],
        ['1\r2', 1],
        ['\r1\r', 2],
        ['1\r', 1],
        ['\r1', 1],
        ['', 0],
        ['\r\n', 1],
        ['\r\n\r\n', 2],
        ['1\r\n2', 1],
        ['\r\n1\r\n', 2],
        ['1\r\n', 1],
        ['\r\n1', 1],
    ])('%o → %o', (input, expected) => {
        expect(countNewlines(input)).toEqual(expected);
    });
});
