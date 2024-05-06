import { sveltex } from 'sveltex-preprocess';
import { gfmHeadingId } from 'marked-gfm-heading-id';

export const sveltexPreprocessor = sveltex({
    markdownBackend: 'marked',
    codeBackend: 'none',
    texBackend: 'none',
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
    advancedTex: {
        // caching: false,
        components: {
            tex: {
                documentClass: '\\documentclass[tikz]{standalone}',
            },
        },
    },
});
