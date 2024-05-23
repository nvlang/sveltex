import { isArray, isString } from '$type-guards/utils.js';
import { Transformation } from '$types/handlers/misc.js';

export function applyTransformations<
    Options extends object = { inline: boolean },
>(
    str: string,
    opts: Options,
    transformationsRaw: Transformation<Options> | Transformation<Options>[],
): string {
    let transformed = str;
    const transformations =
        isArray(transformationsRaw) && !isString(transformationsRaw[1])
            ? (transformationsRaw as Transformation<Options>[])
            : [transformationsRaw as Transformation<Options>];
    transformations.forEach((transformation) => {
        if (isArray(transformation)) {
            if (!isString(transformation[0])) {
                const { flags } = transformation[0];
                if (!flags.includes('g')) {
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
