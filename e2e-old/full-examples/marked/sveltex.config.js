import { sveltex } from '@nvl/sveltex';
import { gfmHeadingId } from 'marked-gfm-heading-id';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'marked',
    codeBackend: 'highlight.js',
    mathBackend: 'mathjax',
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
    code: {},
    math: { outputFormat: 'chtml', css: { type: 'cdn' } },
    verbatim: {
        Verb: { type: 'escape', component: 'p' },
        tex: {
            type: 'tex',
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
