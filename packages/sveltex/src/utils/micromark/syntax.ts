// File description: Exports the `micromarkSkip` function, which receives an
// array of HTML tags to skip and returns a `micromark` extension that skips
// those tags.

import type { MicromarkConstruct as Construct } from '../../deps.js';
import { asciiCodes as codes } from '../../deps.js';
import { tokenizeSkipFlowFactory } from './skipFlow.js';

function skipFlowFactory(skipTags: string[]): Construct {
    return {
        name: 'skipFlow',
        tokenize: tokenizeSkipFlowFactory(skipTags),
        concrete: true,
    };
}

/**
 * Create a micromark extension that makes micromark skip HTML elements whose
 * tag is among those in the provided array.
 *
 * @param skipTags - Tags to skip.
 * @returns Micromark extension.
 */
export function micromarkSkip(
    tags: string[] | undefined = ['script', 'style'],
): { flow: { 60: Construct }; text: { 60: Construct } } {
    return {
        flow: { [codes.lessThan]: skipFlowFactory(tags) },
        text: { [codes.lessThan]: skipFlowFactory(tags) },
    };
}
