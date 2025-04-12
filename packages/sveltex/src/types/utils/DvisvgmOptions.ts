// File description: Types describing the options that can be passed to
// `dvisvgm` via SvelTeX.

import type { StringLiteralUnion } from './utility-types.js';

/* eslint-disable tsdoc/syntax */
export type TexDimUnit =
    | 'pt'
    | 'mm'
    | 'cm'
    | 'in'
    | 'bp'
    | 'pc'
    | 'dd'
    | 'cc'
    | 'sp';

export type TexDimUnitless = number;
export type TexDimWithUnit = [TexDimUnitless, TexDimUnit];

/**
 * A dimension in TeX. If a number is provided, it is assumed to be in TeX `pt`.
 */
export type TexDim = TexDimUnitless | TexDimWithUnit;

export interface Coordinate {
    /**
     * x-coordinate. Positive values move right, negative values move left.
     */
    x: TexDim;

    /**
     * y-coordinate. Positive values move down, negative values move up.
     */
    y: TexDim;
}

export interface BoundingBox {
    topLeft: Coordinate;
    bottomRight: Coordinate;
}

type DinIsoPaperSizeInt =
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10';
type DinIsoPaperSizeLetter = 'A' | 'B' | 'C' | 'D';
export type DinIsoPaperSize = `${DinIsoPaperSizeLetter}${DinIsoPaperSizeInt}`;
export type NorthAmericanPaperSize =
    | 'invoice'
    | 'executive'
    | 'legal'
    | 'letter'
    | 'ledger';
export type PaperSize =
    | DinIsoPaperSize
    | NorthAmericanPaperSize
    | {
          paperSize: DinIsoPaperSize | NorthAmericanPaperSize;
          /**
           * @defaultValue `'portrait'`
           */
          orientation?: 'portrait' | 'landscape';
      };

export type BBox =
    | 'dvi'
    | 'min'
    | 'none'
    | 'papersize'
    | 'preview'
    | BoundingBox
    | TexDim
    | PaperSize;

export type Flag = `--${string}`;
export type FilepathWithExtension = `${string}.${string}`;

/**
 * Possible formats in which to embed bitmaps extracted from PostScript or PDF
 * data.
 *
 * @see https://dvisvgm.de/Manpage/#opt-bitmap-format
 */
export type BitmapFormat =
    | 'none'
    | 'jpeg'
    | 'jpeggray'
    | 'png'
    | 'pnggray'
    | 'pngmono'
    | 'pngmonod'
    | 'png16'
    | 'png256'
    | 'png16m'
    | ['jpeg' | 'jpeggray', number];

/**
 * Possible optimization modules for dvisvgm's SVG output.
 *
 * @see https://dvisvgm.de/Manpage/#opt-optimize
 */
type SvgOptimization =
    | 'all'
    | 'none'
    | 'collapse-groups'
    | 'group-attributes'
    | 'reassign-clippaths'
    | 'remove-clippaths'
    | 'simplify-text'
    | 'simplify-transform';

/**
 * Special commands embedded in the DVI file.
 *
 * - `'bgcolor'`: background color special
 * - `'color'`: complete support of color specials
 * - `'dvisvgm'`: special set for embedding raw SVG snippets
 * - `'em'`: line drawing statements of the emTeX special set
 * - `'html'`: hyperref specials
 * - `'papersize'`: special to set the page size
 * - `'pdf'`: PDF hyperlink, font map, and pagesize specials
 * - `'ps'`: dvips PostScript specials
 * - `'tpic'`: TPIC specials
 *
 * @see https://dvisvgm.de/Manpage/#opt-list-specials
 */
type DvisvgmSpecial =
    | 'bgcolor'
    | 'color'
    | 'dvisvgm'
    | 'em'
    | 'html'
    | 'papersize'
    | 'pdf'
    | 'ps'
    | 'tpic';

/**
 * Configuration options for SvelTeX's usage of the dvisvgm command.
 *
 * The documentation of the options herein are adapted from the official dvisvgm
 * [manpage](https://dvisvgm.de/Manpage/). Big thanks to Martin Gieseking are in
 * order for their extensive work on dvisvgm and its documentation.
 *
 * @see https://dvisvgm.de/Manpage/
 */
export interface DvisvgmOptions {
    /**
     * Configuration options for the console output.
     *
     * @see https://dvisvgm.de/Manpage/
     */
    console?: DvisvgmConsoleOptions | undefined;

    /**
     * Additional command-line arguments to pass to dvisvgm. These will be added
     * after all other flags/options, but just before the path to the input
     * file.
     *
     * ⚠ **Warning**: If you are using this option, make sure to pass the
     * correct flags and options. SvelTeX does not check if the flags/options
     * are valid. It also doesn't check for conflicts between the flags it sets
     * itself and the custom flags set by this option, so if you're using a flag
     * in `customArgs` which is already a part of SvelTeX's
     * {@link DvisvgmOptions | `DvisvgmOptions`}, even if only in a limited
     * capacity, make sure that you set them to `null`.
     *
     * @see https://dvisvgm.de/Manpage/
     */
    customArgs?: Flag[] | undefined;

    /**
     * Configuration options for the processing of the SVG output.
     *
     * - `cache` (`undefined`): Cache directory for some auxiliary files
     * - `exactBbox` (`undefined`): Compute precise bounding box of each
     *   character
     * - `keep` (`undefined`): Keep intermediate files created by
     *   Metafont/TrueType/WOFF
     *
     * **Note**: Passing `undefined` to an option will defer to the default
     * value set by SvelTeX. Passing `null` will defer to the default value set
     * by dvisvgm (more precisely, passing `null` will ensure that the CLI flag
     * corresponding to the option in question is never invoked to begin with).
     * In most cases these are the same, but there are some exceptions (e.g.,
     * SvelTeX sets {@link ProcessingOptions.exactBbox | `exactBbox`} to `true`
     * by default *when the input is a DVI file*, whereas dvisvgm defaults it to
     * `false` in any case).
     *
     * @see https://dvisvgm.de/Manpage/
     */
    processing?: ProcessingOptions | undefined;

    /**
     * Configuration options for the SVG output.
     *
     * **Note**: Passing `undefined` to an option will defer to the default
     * value set by SvelTeX. Passing `null` will defer to the default value set
     * by dvisvgm (more precisely, passing `null` will ensure that the CLI flag
     * corresponding to the option in question is never invoked to begin with).
     * In most cases these are the same, but there are some exceptions (e.g.,
     * SvelTeX sets {@link DvisvgmSvgOutputOptions.relative | `relative`} to
     * `true` by default, whereas dvisvgm does not).
     *
     * @see https://dvisvgm.de/Manpage/
     */
    svg?: DvisvgmSvgOutputOptions | undefined;

    /**
     * Configuration options for optional transformers applied to the SVG
     * output.
     *
     * @see https://dvisvgm.de/Manpage/
     */
    svgTransformations?: SvgTransformations | undefined;
}

/**
 * {@inheritDoc DvisvgmOptions.processing}
 */
interface DvisvgmConsoleOptions {
    /**
     * Controls the type of messages printed during a dvisvgm run. The value is
     * a number between 0 and 15, but using binary notation may help make sense
     * of it: setting `verbosity` to the 4-digit binary number
     * `0b<user><info><warn><error>`, will have the following effect:
     *
     * - `<user>`: If `1`, user messages (e.g., created by the dvisvgm special
     *   `dvisvgm:message`) are printed. If `0`, they are suppressed.
     * - `<info>`: If `1`, informational messages are printed. If `0`, they are
     *   suppressed.
     * - `<warn>`: If `1`, warning messages are printed. If `0`, they are
     *   suppressed.
     * - `<error>`: If `1`, error messages are printed. If `0`, they are
     *   suppressed.
     *
     * @defaultValue `1b0011` (overrides dvisvgm default, which is `1b1111`)
     * @see https://dvisvgm.de/Manpage/#opt-verbosity
     */
    verbosity?: number | undefined | null;
}

export interface DvisvgmSvgOutputOptions {
    /**
     * ⚠ **Warning**: This option only affects the processing of DVI files.
     *
     * Sets the bounding box of the generated SVG graphic to the specified
     * format. SVG documents generated from PDF and PostScript always inherit
     * the bounding boxes of the input files.
     *
     * - Object of type {@link BoundingBox | `BoundingBox`}: Specify the
     *   bounding box as a pair of coordinates.
     * - Object/number of type {@link TexDim | `TexDim`}: Use the
     *   minimal/tightest bounding box, as `'min'` would, but enlarged in every
     *   direction by the given length.
     * - Object/string of type {@link PaperSize | `PaperSize`}: Use the
     *   dimensions of the specified paper size. If providing an object (as
     *   opposed to a string), the orientation of the paper can also be
     *   specified, either as `'landscape'` or `'portrait'` (default).
     * - `'dvi'`: Page size stored in the DVI file.
     * - `'min'`: Computes the minimal/tightest bounding box.
     * - `'none'`: No bounding box is assigned.
     * - `'papersize'`: Box sizes specified by papersize specials present in the
     *   DVI file.
     * - `'preview'`: Bounding box data computed by the preview package (if
     *   present in the DVI file).
     *
     * @defaultValue `null` (defers to `dvisvgm` default, which is `'min'`)
     * @see https://dvisvgm.de/Manpage/#opt-bbox
     */
    bbox?: BBox | undefined | null;

    /**
     * Controls the image format used to embed bitmaps extracted from PostScript
     * or PDF data. SvelTeX overrides `dvisvgm`'s default value for this option
     * (JPEG, chosen due to its superior compression) with PNG, to support
     * transparency.
     *
     * The following formats may be available:
     *
     * - `'none'`: Disable processing of bitmap images.
     * - JPEG formats:
     *   - `'jpeg'` *(`dvisvgm` default)*: Color JPEG format.
     *   - `'jpeggray'`: Grayscale JPEG format.
     * - PNG formats:
     *   - `'png'` *(SvelTeX default)*: Grayscale or 24-bit color PNG format,
     *     depending on current color space.
     *   - `'pnggray'`: Grayscale PNG format.
     *   - `'pngmono'`: Black-and-white PNG format.
     *   - `'pngmonod'`: Dithered black-and-white PNG format.
     *   - `'png16'`: 4-bit color PNG format.
     *   - `'png256'`: 8-bit color PNG format.
     *   - `'png16m'`: 24-bit color PNG format.
     *
     * Which output devices are available depends on the local Ghostscript
     * installation; if the selected output format isn't available, `dvisvgm`
     * quits with a PostScript error message.
     *
     * Furthermore, the two JPEG format specifiers can each be passed as a
     * 2-tuple, where the first element is the format specifed and the second
     * is the IJG quality level. The quality value is an integer between `0` and
     * `100`. Higher values result in better image quality but lower compression
     * rates and therefore larger files. The default quality level is `75` which
     * is applied if no quality parameter is given or if it's set to `0`.
     *
     * @defaultValue `'png'` (overrides dvisvgm default, which is `'jpeg'`)
     * @see https://dvisvgm.de/Manpage/#opt-bitmap-format
     */
    bitmapFormat?: BitmapFormat | undefined | null;

    /**
     * If `true`, dvisvgm computes all intersections of clipping paths itself
     * rather than delegating this task to the SVG renderer.
     *
     * @defaultValue `null` (defer to `dvisvgm` default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-clipjoin
     */
    clipJoin?: boolean | undefined | null;

    /**
     * > Adds comments with further information about selected data to the SVG
     * > file. Currently, only font elements and font CSS rules related to
     * > native fonts are annotated.
     *
     * @defaultValue `false` (also dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-comments
     */
    comments?: boolean | undefined | null;

    /**
     * Controls whether `dvisvgm` should replace some specified color with the
     * CSS variable `currentColor`.
     *
     * - `true` *(SvelTeX default)*: Replace `'#000'` with `currentColor`.
     * - `false` *(`dvisvgm` default)*: Don't replace any color with
     *   `currentColor`.
     * - `'#RRGGBB'` or `'#RGB'`: Replace the specified color with
     *   `currentColor`.
     *
     * @defaultValue `true`
     * @see https://dvisvgm.de/Manpage/#opt-currentcolor
     */
    currentColor?: boolean | `#${string}` | undefined | null;

    /**
     * Controls the format used to embed font data in the generated SVG.
     *
     * - `'woff2'` ([Web Open Font Format 2](https://www.w3.org/TR/WOFF2/))
     *   *(SvelTeX default)*
     *   - [Browser support](https://caniuse.com/woff2): 97.33% (all) to 99.22%
     *     (tracked), excl. partial support. Supported by all major browsers,
     *     except IE. Data at the time of writing.
     *   - ~30% better compression than WOFF
     * - `'woff'` ([Web Open Font Format](https://www.w3.org/TR/WOFF/))
     *   - [Browser support](https://caniuse.com/woff): 97.98% (all) to 99.89%
     *     (tracked). Supported by all major browsers. Data at the time of
     *     writing.
     * - `'none'` (no font embedding — convert text to paths)
     *   - ⚠ **Warning**: may drastically increase output size in some cases.
     * - `'ttf'` ([TrueType](https://en.wikipedia.org/wiki/TrueType))
     *   - ⚠ **Warning**: does not support compression, unlike WOFF/WOFF2.
     *   - [Browser support](https://caniuse.com/ttf): 97.48% (all) to 99.39%
     *     (tracked), excl. partial support. Supported by all major browsers,
     *     except IE, which only has partial support. Data at the time of
     *     writing.
     * - `'svg'` (SVG fonts) *(dvisvgm default)*
     *   - ⚠ **Warning**: deprecated.
     *   - [Browser support](https://caniuse.com/svg-fonts): 18.08% (all) to
     *     18.39% (tracked). Supported by Safari.
     *
     * @defaultValue `'woff2'`
     * @see https://dvisvgm.de/Manpage/#opt-font-format
     */
    fontFormat?: 'svg' | 'ttf' | 'woff' | 'woff2' | 'none' | undefined | null;

    /**
     * If `true`, `dvisvgm` creates overlapping grid segments for color gradient
     * fills (see {@link gradSegments | gradSegments}).
     *
     * @defaultValue `false` (also `dvisvgm` default)
     * @see https://dvisvgm.de/Manpage/#opt-grad-overlap
     */
    gradOverlap?: boolean | undefined | null;

    /**
     * Sets the max. number of segments per column and row used to approximate
     * a gradient color fill.
     *
     * @defaultValue `null` (defer to `dvisvgm` default)
     * @see https://dvisvgm.de/Manpage/#opt-grad-segments
     */
    gradSegments?: number | undefined | null;

    /**
     * Threshold for simplifying gradient color fills.
     *
     * @defaultValue `null`
     * @see https://dvisvgm.de/Manpage/#opt-grad-simplify
     */
    gradSimplify?: number | undefined | null;

    /**
     * Controls how to highlight hyperlinked areas:
     *
     * - `'box'`: draws a rectangle around the linked region.
     * - `'line'`: draws the lower edge of the bounding rectangle.
     * - `'none'` tells `dvisvgm` not to add any visible objects to hyperlinks.
     *
     * @defaultValue `'none'`
     * @see https://dvisvgm.de/Manpage/#opt-linkmark
     */
    linkmark?: 'none' | 'line' | 'box' | 'color' | undefined | null;

    /**
     * By default, `dvisvgm` uses CSS `style`s and `class` attributes to
     * reference fonts. Setting this option to `true` disables this behavior and
     * embeds font information directly into each text element. Note that this
     * can lead to larger SVG files.
     *
     * @defaultValue `null` (defer to `dvisvgm` default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-no-styles
     */
    noStyles?: boolean | undefined | null;

    /**
     * Optimizations to apply to reduce the size of the SVG output.
     *
     * @defaultValue `'all'`
     * @see https://dvisvgm.de/Manpage/#opt-optimize
     */
    optimize?: SvgOptimization | SvgOptimization[] | undefined | null;

    /**
     * Specifies the maximal number of decimal places applied to floating-point
     * attribute values. All attribute values written to the generated SVG
     * file(s) are rounded accordingly. Accepted values are integers from 1 to
     * 6, or `'auto'`, which enables the automatic selection of significant
     * decimal places.
     *
     * @defaultValue `'auto'`
     * @see https://dvisvgm.de/Manpage/#opt-precision
     */
    precision?: number | 'auto' | undefined | null;

    /**
     * Controls whether `dvisvgm` should use relative coordinates in the SVG
     * output (this can reduce file size).
     *
     * @defaultValue `true` (overrides dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-relative
     */
    relative?: boolean | undefined | null;
}

interface ProcessingOptions {
    /**
     * Controls if and where `dvisvgm` stores font cache files.
     *
     * @defaultValue `null` (defer to `dvisvgm` default)
     * @see https://dvisvgm.de/Manpage/#opt-cache
     */
    cache?: StringLiteralUnion<'none'> | undefined | null;

    /**
     * ⚠ **Warning**: This option has no effect on the processing of PDF files.
     *
     * Controls whether `dvisvgm` should compute the precise bounding box of each
     * character.
     *
     * @defaultValue `true` (overrides dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-exact-bbox
     */
    exactBbox?: boolean | undefined | null;

    /**
     * Keep temporary files created by Metafont/TrueType/WOFF.
     *
     * @defaultValue `null` (defer to `dvisvgm` default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-keep
     */
    keep?: boolean | undefined | null;

    /**
     * Controls the magnification factor used for glyph tracing.
     *
     * @defaultValue `null` (defer to `dvisvgm` default)
     * @see https://dvisvgm.de/Manpage/#opt-mag
     */
    mag?: number | undefined | null;

    /**
     * If `true`, `dvisvgm` won't call `mktextfm` or `mktexmf` if a font lookup
     * with `kpathsea` fails.
     *
     * @defaultValue `null` (defer to `dvisvgm` default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-no-mktexmf
     */
    noMktexmf?: boolean | undefined | null;

    /**
     * This option can be used to disable soem or all specials embedded in DVI
     * files.
     *
     * - `true`: All specials are disabled / no specials are enabled.
     * - `false`: No specials are disabled / all specials are enabled.
     * - `special: DvisvgmSpecial`: Disables the specified special.
     * - `specials: DvisvgmSpecial[]`: Disables the specified specials.l
     *
     * @defaultValue `null` (defer to `dvisvgm` default, which is `fase`)
     * @see https://dvisvgm.de/Manpage/#opt-no-specials
     */
    noSpecials?: boolean | DvisvgmSpecial | DvisvgmSpecial[] | undefined | null;

    /**
     * - `true`: vectorize and cache all glyphs of all fonts referenced in the
     *   DVI file. Glyphs already stored in the cache are skipped.
     * - `false` *(dvisvgm default)*: only vectorize and cache the glyphs
     *   actually required to render the SVG file correctly. Glyphs already
     *   stored in the cache are skipped.
     * - `'retrace'`: vectorize and cache all glyphs of all fonts referenced in
     *   the DVI file, even if they are already stored in the cache.
     *
     * @remarks This option cannot be set to `true` if the
     * {@link cache | `cache`} option is set to `'none'`.
     * @defaultValue `null` (defer to `dvisvgm` default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-trace-all
     */
    traceAll?: boolean | 'retrace' | undefined | null;
}

interface SvgTransformations {
    /**
     * Rotates the page content clockwise by the given number of degrees, around
     * the page center.
     *
     * @defaultValue `null` (no rotation)
     * @see https://dvisvgm.de/Manpage/#opt-rotate
     */
    rotate?: number | undefined | null;

    /**
     * Scales the page content.
     *
     * - `s: number`: Uniform scaling factor.
     * - `[sx, sy]: [number, number]`: Scaling factors for x- and y-directions,
     *   respectively.
     *
     * @defaultValue `null` (no scaling)
     * @see https://dvisvgm.de/Manpage/#opt-scale
     */
    scale?: number | [number, number] | undefined | null;

    /**
     * This option can be used to apply a sequence of transformations to the SVG
     * output. See the `dvisvgm` manpage for more information on the syntax of
     * the transformation string — this string is appended verbatim to the
     * `--transform=` CLI flag, and is not quoted or escaped in any way.
     *
     * @defaultValue `null` (no transformation)
     * @see https://dvisvgm.de/Manpage/#opt-transform
     */
    transform?: string | undefined | null;

    /**
     * Translates (i.e., moves) the SVG content.
     *
     * - `dx: number`: Move the content `dx` TeX points to the right.
     * - `[dx, dy]: [number, number]`: Move the content `dx` TeX points to the
     *   right and `dy` TeX points downward.
     *
     * @defaultValue `null` (no translation)
     * @see https://dvisvgm.de/Manpage/#opt-translate
     */
    translate?: number | [number, number] | undefined | null;

    /**
     * Multiplies the `width` and `height` of the SVG root element by the given
     * number, retaining the coordinate system. This effectively zooms the
     * content in most SVG viewers. If a negative number is provideed, the
     * `width` and `height` attributes are omitted.
     *
     * @defaultValue `null` (no zooming)
     * @see https://dvisvgm.de/Manpage/#opt-zoom
     */
    zoom?: number | undefined | null;
}
