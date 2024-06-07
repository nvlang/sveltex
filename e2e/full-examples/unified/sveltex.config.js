import { sveltex } from '@nvl/sveltex';
import rehypeSlug from 'rehype-slug';

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
        },
        code: { languages: 'common' },
        math: { css: { type: 'cdn' } },
        verbatim: {
            Verb: {
                type: 'escapeOnly',
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
