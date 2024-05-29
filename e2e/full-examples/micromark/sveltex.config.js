import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'micromark',
    codeBackend: 'escapeOnly',
    texBackend: 'mathjax',
});

await sveltexPreprocessor.configure({
    markdown: {},
    code: { escapeBraces: true, escapeHtml: true },
    tex: { outputFormat: 'chtml', css: { type: 'hybrid' } },
    verbatim: {
        Verb: {
            type: 'escapeOnly',
            escapeInstructions: { escapeBraces: true, escapeHtml: true },
            component: 'p',
        },
        tex: {
            type: 'advancedTex',
            aliases: ['TikZ'],
            preset: { name: 'tikz' },
            overrides: {
                compilation: { intermediateFiletype: 'dvi' },
                conversion: { svg: { bbox: '3pt' } },
            },
        },
    },
});
