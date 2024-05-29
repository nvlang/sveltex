import { sveltex } from '@nvl/sveltex';
import { gfmHeadingId } from 'marked-gfm-heading-id';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'marked',
    codeBackend: 'highlight.js',
    texBackend: 'mathjax',
});

await sveltexPreprocessor.configure({
    markdown: {
        options: {
            // async: false,
            // breaks: true,
            gfm: true,
            // pedantic: false,
            // silent: false,
        },
        extensions: [gfmHeadingId()],
    },
    code: { languages: ['ts'] },
    tex: { outputFormat: 'chtml', css: { type: 'cdn' } },
    verbatim: {
        Verb: {
            type: 'escapeOnly',
            escapeInstructions: { escapeBraces: true, escapeHtml: true },
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
                conversion: {
                    svg: { bbox: '3pt' },
                    processing: {},
                    svgTransformations: {},
                },
            },
        },
    },
});
