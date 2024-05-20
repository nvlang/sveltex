import type { Construct } from 'micromark-util-types';
import { codes } from 'micromark-util-symbol';
import { tokenizeSkipFlow } from './skip-flow.js';
// import { tokenizeSkipText } from '$utils/micromark/skip-text.js';

const skipFlow: Construct = {
    name: 'skipFlow',
    tokenize: tokenizeSkipFlow,
    // resolveTo: resolveToSkipFlow,
    concrete: true,
};

export let skipTags: string[];

// const skipText: Construct = {
//     name: 'skipText',
//     tokenize: tokenizeSkipText,
// };

export function micromarkSkip(
    tags: string[] | undefined = ['script', 'style'],
) {
    skipTags = tags;
    return {
        flow: { [codes.lessThan]: skipFlow },
        text: { [codes.lessThan]: skipFlow },
    };
}
