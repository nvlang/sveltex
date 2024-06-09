import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'markdown-it',
    codeBackend: 'highlight.js',
    mathBackend: 'mathjax',
});

await sveltexPreprocessor.configure({
    markdown: {},
    code: {},
    math: { outputFormat: 'svg' },
    verbatim: {
        Verb: { type: 'escape', component: 'p' },
        tex: {
            type: 'tex',
            aliases: ['TikZ'],
            preamble: [
                '\\usepackage{mathtools}',
                '\\usepackage{microtype}',
                '\\usepackage{tikz}',
            ].join('\n'),
        },
    },
});
