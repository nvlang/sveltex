import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'markdown-it',
    codeBackend: 'highlight.js',
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
        languages: ['ts'],
    },
    tex: { outputFormat: 'svg' },
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
                // overrideSvgPostprocess: null,
                // svgoOptions: {
                //     plugins: [],
                // },
                intermediateFiletype: 'dvi',
                conversionOptions: {
                    svg: {
                        // fontFormat: 'svg',
                        bbox: '3pt',
                        gradSimplify: null,
                        gradOverlap: null,
                        gradSegments: null,
                        bitmapFormat: null,
                        clipJoin: null,
                        comments: null,
                        currentColor: null,
                        optimize: null,
                        precision: null,
                        linkmark: null,
                        noStyles: null,
                        relative: null,
                        zip: null,
                    },
                    processing: {},
                    svgTransformations: {},
                },
            },
            documentClass: '\\documentclass{standalone}',
        },
    },
});
