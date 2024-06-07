// Types
import type { CliInstruction } from '$types/utils/CliInstruction.js';
import type {
    BBox,
    BitmapFormat,
    BoundingBox,
    DvisvgmOptions,
    FilepathWithExtension,
    Flag,
    TexDim,
} from '$types/utils/DvisvgmOptions.js';

// Internal dependencies
import { getDefaultTexConfig } from '$config/defaults.js';
import {
    isBoundingBox,
    isPaperSize,
    isTexDim,
    isTexDimUnitless,
} from '$type-guards/dvisvgm.js';
import { isString } from '$type-guards/utils.js';
import { mergeConfigs } from '$utils/merge.js';
import { ensureWithinRange } from '$utils/misc.js';

/**
 * Convert a {@link BitmapFormat | `BitmapFormat`} to a string that can be
 * passed to the `--bitmap-format` flag of the `dvisvgm` command.
 *
 * @internal
 */
export function bitmapFormatToFlagValue(bitmapFormat: BitmapFormat): string {
    if (isString(bitmapFormat)) {
        return bitmapFormat;
    }
    return `${bitmapFormat[0]}:${String(ensureWithinRange(bitmapFormat[1], [0, 100]).toFixed(0))}`;
}

/**
 * Convert a {@link BBox | `BBox`} to a string that can be passed to the
 * `--bbox` flag of the `dvisvgm` command.
 *
 * @internal
 */
export function bboxToFlagValue(bbox: BBox): string {
    if (isTexDim(bbox)) {
        if (isTexDimUnitless(bbox)) {
            return String(bbox);
        }
        return `${String(bbox[0])}${bbox[1]}`;
    }
    if (isBoundingBox(bbox)) {
        return boundingBoxToString(bbox);
    }
    if (!isString(bbox) && isPaperSize(bbox)) {
        return (
            bbox.paperSize + (bbox.orientation ? '-' + bbox.orientation : '')
        );
    }
    return bbox;
}

/**
 * Convert a {@link BoundingBox | `BoundingBox`} to a string that can be used in
 * the `--bbox` flag of the `dvisvgm` command.
 *
 * @internal
 */
export function boundingBoxToString(bbox: BoundingBox): string {
    return [
        bbox.topLeft.x,
        bbox.topLeft.y,
        bbox.bottomRight.x,
        bbox.bottomRight.y,
    ]
        .map(texDimToString)
        .join(',');
}

/**
 * Convert a {@link TexDim | `TexDim`} to a string that can be used in the
 * `--bbox` flag of the `dvisvgm` command.
 *
 * @internal
 */
export function texDimToString(texDim: TexDim): string {
    if (isTexDimUnitless(texDim)) {
        return String(texDim);
    }
    return `${String(texDim[0])}${texDim[1]}`;
}

/**
 * Build a {@link CliInstruction | `CliInstruction`} to convert a DVI or PDF file
 * to SVG using `dvisvgm`.
 *
 * @param dvisvgm - Options for the conversion.
 * @param outputPath - The path to the output SVG file.
 * @param texPath - The path to the input TeX file.
 * @param inputType - The type of the input file (DVI or PDF).
 * @returns A `CliInstruction` to convert the DVI or PDF file to SVG.
 *
 * @remarks
 * Options which are `undefined` will be set to their default value as specified
 * by Sveltex; options which are `null` will be omitted from the instruction,
 * meaning that their default value as specified by `dvisvgm` will be used
 *
 * @internal
 */
export function buildDvisvgmInstruction({
    dvisvgm,
    outputPath,
    texPath,
    inputType,
}: {
    dvisvgm?: DvisvgmOptions | undefined;
    outputPath: FilepathWithExtension;
    texPath: FilepathWithExtension;
    inputType: 'dvi' | 'pdf';
}): CliInstruction {
    const fullDvisvgmOptions = mergeConfigs(
        getDefaultTexConfig().conversion.dvisvgm,
        dvisvgm ?? {},
    );

    // The args array to pass to the `spawn` function. We initialize it with an
    // empty array.
    const args: (FilepathWithExtension | Flag)[] = [];

    // If the intermediary filetype is PDF, we need to pass the `--pdf` flag
    if (inputType === 'pdf') args.push('--pdf');

    // Set the --output flag
    args.push(`--output=${outputPath}`);

    // Processing options
    const { cache, exactBbox, keep, mag, noMktexmf, noSpecials, traceAll } =
        fullDvisvgmOptions.processing;

    // Set --cache flag, if applicable
    if (cache !== null) {
        args.push(`--cache=${cache}`);
    }

    // Set --exact-bbox flag, if applicable
    if (exactBbox !== null && exactBbox && inputType === 'dvi') {
        args.push('--exact-bbox');
    }

    // Set --keep flag, if applicable
    if (keep !== null && keep) {
        args.push('--keep');
    }

    // Set --mag flag, if applicable
    if (mag !== null) {
        args.push(`--mag=${String(mag)}`);
    }

    // Set --no-mktexmf flag, if applicable
    if (noMktexmf !== null && noMktexmf) {
        args.push('--no-mktexmf');
    }

    // Set --no-specials flag, if applicable
    if (noSpecials !== null && noSpecials !== false) {
        if (noSpecials === true) {
            args.push('--no-specials');
        } else if (typeof noSpecials === 'string') {
            args.push(`--no-specials=${noSpecials}`);
        } else {
            args.push(`--no-specials=${noSpecials.join(',')}`);
        }
    }

    // Set --trace-all flag, if applicable
    if (traceAll !== null) {
        if (traceAll === true) {
            args.push('--trace-all');
        } else if (traceAll === 'retrace') {
            args.push('--trace-all=true');
        }
    }

    // SVG options
    const {
        bbox,
        bitmapFormat,
        clipJoin,
        comments,
        currentColor,
        fontFormat,
        gradOverlap,
        gradSegments,
        gradSimplify,
        linkmark,
        noStyles,
        optimize,
        precision,
        relative,
        zip,
    } = fullDvisvgmOptions.svg;

    // Set --bbox flag, if applicable
    if (bbox !== null && inputType === 'dvi') {
        args.push(`--bbox=${bboxToFlagValue(bbox)}`);
    }

    // Set --bitmap-format flag, if applicable
    if (bitmapFormat !== null) {
        args.push(`--bitmap-format=${bitmapFormatToFlagValue(bitmapFormat)}`);
    }

    // Set --clip-join flag, if applicable
    if (clipJoin !== null && clipJoin) {
        args.push(`--clip-join`);
    }

    // Set --comments flag, if applicable
    if (comments !== null && comments) {
        args.push(`--comments`);
    }

    // Set --current-color flag, if applicable
    if (currentColor !== null) {
        if (currentColor === true) {
            args.push(`--currentcolor`);
        } else if (typeof currentColor === 'string') {
            args.push(`--currentcolor=${currentColor}`);
        }
    }

    // Set --embed-bitmaps flag, if applicable
    if (inputType === 'dvi') {
        // We always add this flag when the input is a DVI file because:
        // 1. Embedding bitmaps makes the output SVG file self-contained, which
        //    increases portability.
        // 2. Bitmaps are always embedded when the input is a PDF file, so in
        //    order to minimize the difference in behavior between DVI and PDF
        //    input files, we always embed bitmaps for DVI files as well.
        // 3. SvelTeX does not check or ensure that the bitmap files are present
        //    in the expected location (while certainly doable from a technical
        //    standpoint, relative paths would be difficult to deal with (seeing
        //    as the output SVG is not meant to be in the directory as the input
        //    DVI/TeX file) and paths pointing outside the Svelte project would
        //    essentially reference files that won't be shipped with the project
        //    anyway).
        args.push('--embed-bitmaps');
    }

    // Set --font-format flag, if applicable
    if (fontFormat !== null) {
        args.push(`--font-format=${fontFormat}`);
    }

    // Set --grad-overlap flag, if applicable
    if (gradOverlap !== null && gradOverlap) {
        args.push(`--grad-overlap`);
    }

    // Set --grad-segments flag, if applicable
    if (gradSegments !== null) {
        args.push(`--grad-segments=${String(gradSegments)}`);
    }

    // Set --grad-simplify flag, if applicable
    if (gradSimplify !== null) {
        args.push(`--grad-simplify=${String(gradSimplify)}`);
    }

    // Set --linkmark flag, if applicable
    if (linkmark !== null) {
        args.push(`--linkmark=${linkmark}`);
    }

    // Set --no-styles flag, if applicable
    if (noStyles !== null && noStyles) {
        args.push(`--no-styles`);
    }

    // Set --optimize flag, if applicable
    if (optimize !== null) {
        if (typeof optimize === 'string') {
            args.push(`--optimize=${optimize}`);
        } else {
            args.push(`--optimize=${optimize.join(',')}`);
        }
    }

    // Set --precision flag, if applicable
    if (precision !== null) {
        if (precision === 'auto') {
            args.push('--precision=0');
        } else {
            args.push(
                `--precision=${ensureWithinRange(precision, [1, 6]).toFixed(0)}`,
            );
        }
    }

    // Set --relative flag, if applicable
    if (relative !== null && relative) args.push('--relative');

    // Set --zip flag, if applicable
    if (zip !== null && zip !== false) {
        if (zip === true) {
            args.push('--zip');
        } else {
            args.push(`--zip=${String(ensureWithinRange(zip, [1, 9]))}`);
        }
    }

    const { color, message, progress, verbosity } = fullDvisvgmOptions.console;

    // Set --color flag, if applicable
    if (color !== null && color) {
        args.push('--color');
    }

    // Set --message flag, if applicable
    if (message !== null) {
        args.push(`--message=${message}`);
    }

    // Set --progress flag, if applicable
    if (progress !== null && progress !== false) {
        if (progress === true) {
            args.push('--progress');
        } else {
            args.push(`--progress=${String(progress)}`);
        }
    }

    // Set --verbosity flag, if applicable
    if (verbosity !== null) {
        args.push(`--verbosity=${String(verbosity)}`);
    }

    const { rotate, scale, transform, translate, zoom } =
        fullDvisvgmOptions.svgTransformations;

    // Set --rotate flag, if applicable
    if (rotate !== null) {
        args.push(`--rotate=${String(rotate)}`);
    }

    // Set --scale flag, if applicable
    if (scale !== null) {
        if (typeof scale === 'number') {
            args.push(`--scale=${String(scale)}`);
        } else {
            args.push(`--scale=${scale.join(',')}`);
        }
    }

    // Set --transform flag, if applicable
    if (transform !== null) {
        args.push(`--transform=${transform}`);
    }

    // Set --translate flag, if applicable
    if (translate !== null) {
        if (typeof translate === 'number') {
            args.push(`--translate=${String(translate)}`);
        } else {
            args.push(`--translate=${translate.join(',')}`);
        }
    }

    // Set --zoom flag, if applicable
    if (zoom !== null) {
        args.push(`--zoom=${String(zoom)}`);
    }

    const { customArgs } = fullDvisvgmOptions;

    // Add custom arguments
    if (customArgs.length > 0) {
        args.push(...customArgs);
    }

    // Add the path to the TeX file
    args.push(texPath);

    return {
        command: 'dvisvgm',
        args,
    };
}
