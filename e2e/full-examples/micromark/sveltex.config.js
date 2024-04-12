import { sveltex } from 'sveltex-preprocess';

export const sveltexPreprocessor = await sveltex(
    'micromark',
    'none',
    'none',
    'none',
);

await sveltexPreprocessor.configure({
    markdown: {},
});
