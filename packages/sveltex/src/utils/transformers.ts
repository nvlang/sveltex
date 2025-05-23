// File description: Apply transformers to content.

// Types
import type { Transformer } from '../types/handlers/Handler.js';

// External dependencies
import { isRegExp } from '../deps.js';

// Internal dependencies
import { isArray, isString } from '../typeGuards/utils.js';

export function applyTransformations<
    Options extends object = { inline: boolean },
>(
    str: string,
    opts: Options,
    transformationsRaw:
        | Transformer<Options>
        | Transformer<Options>[]
        | null
        | undefined,
): string {
    if (!transformationsRaw) return str;
    let transformed = str;
    const transformers =
        isArray(transformationsRaw) && !isString(transformationsRaw[1])
            ? (transformationsRaw as Transformer<Options>[])
            : [transformationsRaw as Transformer<Options>];
    transformers.forEach((transformation) => {
        if (isArray(transformation)) {
            if (isRegExp(transformation[0])) {
                const { flags } = transformation[0];
                if (flags === '' || !flags.includes('g')) {
                    transformation[0] = new RegExp(
                        transformation[0],
                        flags + 'g',
                    );
                }
            }
            transformed = transformed.replaceAll(...transformation);
        } else {
            transformed = transformation(transformed, opts);
        }
    });
    return transformed;
}
