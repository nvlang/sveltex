import { sveltex } from '@nvl/sveltex';
import rehypeSlug from 'rehype-slug';

export const sveltexPreprocessor = await sveltex(
    {
        markdownBackend: 'unified',
        codeBackend: 'starry-night',
        texBackend: 'katex',
    },
    {
        markdown: {
            remarkPlugins: [],
            rehypePlugins: [rehypeSlug],
        },
        code: {
            wrap: undefined,
            wrapClassPrefix: 'language-',
            languages: 'common',
        },
        tex: {
            css: { type: 'cdn' },
        },
        verbatim: {
            Verb: {
                type: 'escapeOnly',
                escapeInstructions: {
                    escapeBraces: true,
                    escapeHtml: true,
                },
                component: 'p',
            },
            tex: {
                type: 'advancedTex',
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
