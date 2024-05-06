import { sveltex } from 'sveltex-preprocess';

export const sveltexPreprocessor = await sveltex({
    markdownBackend: 'micromark',
    codeBackend: 'none',
    texBackend: 'none',
    advancedTexBackend: 'none',
});

await sveltexPreprocessor.configure({
    markdown: {},
});
