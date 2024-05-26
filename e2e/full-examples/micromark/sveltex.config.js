import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'micromark',
    codeBackend: 'escapeOnly',
    texBackend: 'mathjax',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    markdown: {},
    code: {
        escapeBraces: true,
        escapeHtml: true,
        wrap: undefined,
        wrapClassPrefix: 'language-',
    },
    tex: {
        outputFormat: 'chtml',
        css: { type: 'self-hosted' },
        mathjax: {
            chtml: {
                fontURL: '/fonts/sveltex/',
            },
        },
        // mathjax: {
        //     chtml: {
        //         adaptiveCSS: false,
        //         fontURL:
        //             'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
        //     },
        //     options: {},
        // },

        // inputConfiguration: {
        //     html: true,
        //     css: true,
        // },
        // mathjaxNodeConfiguration: {
        //     fontURL:
        //         'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/',
        // },
        // mathjaxConfiguration: {
        //     chtml: {
        //         fontURL:
        //             'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/',
        //     },
        // },
        // outputFormat: 'chtml',
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
                '\\usepackage{microtype}',
                '\\usepackage{tikz}',
            ].join('\n'),
            overrides: {
                engine: 'lualatex',
                intermediateFiletype: 'dvi',
                conversionOptions: { svg: { bbox: '3pt' } },
            },
            documentClass: '\\documentclass{standalone}',
        },
    },
});
