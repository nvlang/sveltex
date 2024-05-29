import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'markdown-it',
    codeBackend: 'highlight.js',
    texBackend: 'mathjax',
});

await sveltexPreprocessor.configure({
    markdown: {},
    code: {
        escapeBraces: true,
        escapeHtml: true,
        languages: ['ts'],
    },
    tex: { outputFormat: 'svg' },
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
                '\\usepackage{microtype}',
                '\\usepackage{tikz}',
            ].join('\n'),
        },
    },
});
