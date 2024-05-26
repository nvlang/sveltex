import { sveltex } from '@nvl/sveltex';
import rehypeSlug from 'rehype-slug';
import remarkMdx from 'remark-mdx';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'unified',
    codeBackend: 'starry-night',
    texBackend: 'katex',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    markdown: {
        remarkPlugins: [remarkMdx],
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
            overrides: {
                // engine: 'pdflatex',
                // overrideSvgPostprocess: null,
                // svgoOptions: {
                //     plugins: [],
                // },
                conversionCommand: 'dvisvgm',
                intermediateFiletype: 'pdf',
                conversionOptions: {
                    currentColor: '#000',
                    svg: { bbox: '3pt' },
                    processing: {},
                    svgTransformations: {},
                },
            },
            documentClass: '\\documentclass{standalone}',
        },
    },
});
