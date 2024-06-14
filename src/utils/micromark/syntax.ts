import type { MicromarkConstruct as Construct } from '$deps.js';
import { asciiCodes as codes } from '$deps.js';
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
) {
    return {
        flow: { [codes.lessThan]: skipFlowFactory(tags) },
        text: { [codes.lessThan]: skipFlowFactory(tags) },
    };
}
