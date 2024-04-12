import { sveltex } from 'sveltex-preprocess';

export const sveltexPreprocessor = await sveltex(
    'markdown-it',
    'none',
    'none',
    'none',
);

await sveltexPreprocessor.configure({
    markdown: {},
});
