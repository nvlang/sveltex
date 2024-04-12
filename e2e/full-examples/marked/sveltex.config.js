import { sveltex } from 'sveltex-preprocess';
import { gfmHeadingId } from 'marked-gfm-heading-id';

export const sveltexPreprocessor = await sveltex(
    'marked',
    'none',
    'none',
    'none',
);

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
});
