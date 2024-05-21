import { sveltex } from 'sveltex-preprocess';
import { gfmHeadingId } from 'marked-gfm-heading-id';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'marked',
    codeBackend: 'highlight.js',
    texBackend: 'mathjax',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    markdown: {
        options: {
            async: false,
            breaks: true,
            gfm: true,
            pedantic: false,
            silent: false,
        },
        extensions: [gfmHeadingId()],
    },
    code: {
        escapeBraces: true,
        escapeHtml: true,
        wrap: undefined,
        wrapClassPrefix: 'language-',
        languages: ['ts'],
    },
    tex: {},
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
