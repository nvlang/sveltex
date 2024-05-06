import { sveltex } from 'sveltex-preprocess';
import rehypeSlug from 'rehype-slug';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'unified',
    codeBackend: 'starry-night',
    texBackend: 'katex',
    advancedTexBackend: 'local',
});

await sveltexPreprocessor.configure({
    markdown: { rehypePlugins: [rehypeSlug] },
    code: {
        escapeBraces: true,
        escapeHtml: true,
        wrap: undefined,
        wrapClassPrefix: 'language-',
        languages: 'common',
    },
    tex: {},
    advancedTex: {
        // caching: false,
        components: {
            tex: {
                documentClass: '\\documentclass[tikz]{standalone}',
            },
        },
    },
});
