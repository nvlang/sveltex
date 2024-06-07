import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'micromark',
    codeBackend: 'escapeOnly',
    mathBackend: 'mathjax',
});

await sveltexPreprocessor.configure({
    markdown: {},
    code: { escapeBraces: true, escapeHtml: true },
    math: { outputFormat: 'chtml', css: { type: 'hybrid' } },
    verbatim: {
        Verb: { type: 'escapeOnly', component: 'p' },
        tex: {
            type: 'tex',
            aliases: ['TikZ'],
            preset: { name: 'tikz' },
            overrides: { conversion: { svg: { bbox: '3pt' } } },
        },
    },
});
