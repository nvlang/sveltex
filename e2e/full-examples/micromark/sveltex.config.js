import { sveltex } from '@nvl/sveltex';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'micromark',
    codeBackend: 'escapeOnly',
    texBackend: 'mathjax',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    general: {
        tex: {},
    },
    markdown: {},
    code: {
        escapeBraces: true,
        escapeHtml: true,
        wrap: undefined,
        wrapClassPrefix: 'language-',
    },
    tex: {
        // inputConfiguration: {
        //     svgNode: true,
        // },
        outputFormat: 'chtml',
        mathjaxConfiguration: {
            svg: {
                // displayIndent: '2em',
                // displayAlign: 'center',
            },
            chtml: {
                adaptiveCSS: false,
                fontURL:
                    'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
            },
            options: {},
        },

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
                // overrideSvgPostprocess: null,
                // svgoOptions: {
                //     plugins: [],
                // },
                intermediateFiletype: 'dvi',
                dvisvgmOptions: {
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
