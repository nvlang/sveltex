import { sveltex } from 'sveltex-preprocess';

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
    tex: {
        outputFormat: 'svg',
    },
    verbatim: {
        verbatimEnvironments: {
            Verb: {
                processInner: {
                    escapeBraces: true,
                    escapeHtml: true,
                },
                component: 'p',
            },
        },
    },
    advancedTex: {
        components: {
            tex: {
                aliases: ['TikZ'],
                preamble: [
                    '\\usepackage{mathtools}',
                    '\\usepackage{microtype}',
                    '\\usepackage{tikz}',
                ].join('\n'),
                overrides: {
                    engine: 'latex',
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
    },
});
