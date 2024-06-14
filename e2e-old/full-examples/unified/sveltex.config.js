import { sveltex } from '@nvl/sveltex';
import rehypeSlug from 'rehype-slug';

import remarkMdx from 'remark-mdx';

export const sveltexPreprocessor = await sveltex(
    {
        markdownBackend: 'unified',
        codeBackend: 'starry-night',
        mathBackend: 'katex',
    },
    {
        markdown: {
            remarkPlugins: [],
            rehypePlugins: [rehypeSlug],
            transformers: {
                pre: [
                    // [/^(<\/?[a-zA-Z][\w:@#-="'{}()\[\] ]*>)$/gm, '\n$1\n'],
                    // [/^Regexes in mustache tags:$/gm, '$0\n'],
                    // (content) => {
                    //     console.log(content);
                    //     return content;
                    // },
                ],
                post: [],
            },
        },
        code: { languages: 'common' },
        math: { css: { type: 'cdn' } },
        verbatim: {
            Verb: {
                type: 'escape',
                component: 'p',
            },
            tex: {
                type: 'tex',
                aliases: ['TikZ'],
                preamble: [
                    '\\usepackage{mathtools}',
                    '\\usepackage{amsmath}',
                    '\\usepackage{microtype}',
                    '\\usepackage{tikz}',
                ].join('\n'),
            },
        },
    },
);
