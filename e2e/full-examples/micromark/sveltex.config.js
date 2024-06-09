import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex(
    {
        markdownBackend: 'micromark',
        codeBackend: 'escape',
        mathBackend: 'mathjax',
    },
    {
        markdown: {},
        code: { escapeBraces: true, escapeHtml: true },
        math: { outputFormat: 'chtml', css: { type: 'hybrid' } },
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
                preset: { name: 'tikz' },
                overrides: { conversion: { svg: { bbox: '3pt' } } },
            },
        },
        tex: {
            debug: {
                verbosity: {
                    onSuccess: 'all',
                },
            },
        },
    },
);
