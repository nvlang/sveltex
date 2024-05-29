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

export type DinIsoPaperSizeInt =
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
export type DinIsoPaperSizeLetter = 'A' | 'B' | 'C' | 'D';
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
export interface DvisvgmConsoleOptions {
    /**
     * Enables colorization of messages printed during the conversion process.
     *
     * @defaultValue `true` (overrides dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-color
     */
    color?: boolean | undefined | null;

    /**
     * Prints a given message to the console after an SVG file has been written.
     *
     * @defaultValue `undefined` (defer to dvisvgm default, which to not print a
     * message)
     * @see https://dvisvgm.de/Manpage/#opt-message
     */
    message?: string | undefined | null;

    /**
     * Controls if simple progress indicator shown when time-consuming
     * operations like PostScript specials are processed.
     *
     * - `true` *(SvelTeX default)*: An indicator appears after 0.5 seconds.
     * - `false` *(dvisvgm default)*: No indicator.
     * - `x: number`: An indicator appears after `x` seconds.
     *
     * @defaultValue `true`
     * @see https://dvisvgm.de/Manpage/#opt-progress
     */
    progress?: boolean | number | undefined | null;

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
     * @defaultValue `undefined` (defers to dvisvgm default, which is `'min'`)
     * @see https://dvisvgm.de/Manpage/#opt-bbox
     */
    bbox?: BBox | undefined | null;

    /**
     * This option sets the image format used to embed bitmaps extracted from
     * PostScript or PDF data. By default, dvisvgm embeds all bitmaps as JPEG
     * images because it's the most compact of the two formats supported by SVG.
     * However, in order to support transparency, SvelTeX changes this default
     * to PNG. There are some more format variants dvisvgm currently supports
     * even though JPEG and PNG should be sufficient in most cases. The
     * following list gives an overview of the known format names which
     * correspond to names of Ghostscript output devices.
     *
     * - `'none'`: Disable processing of bitmap images.
     * - JPEG formats:
     *   - `'jpeg'` *(dvisvgm default)*: Color JPEG format.
     *   - `'jpeggray'`: Grayscale JPEG format.
     * - PNG formats:
     *   - `'png'` *(SvelTeX default)*: Grayscale or 24-bit color PNG format
     *     depending on current color space.
     *   - `'pnggray'`: Grayscale PNG format.
     *   - `'pngmono'`: Black-and-white PNG format.
     *   - `'pngmonod'`: Dithered black-and-white PNG format.
     *   - `'png16'`: 4-bit color PNG format.
     *   - `'png256'`: 8-bit color PNG format.
     *   - `'png16m'`: 24-bit color PNG format.
     *
     * Since the collection of supported output devices can vary among local
     * Ghostscript installations, not all formats may be available in some
     * environments. dvisvgm quits with a PostScript error message if the
     * selected output format requires a locally unsupported output device.
     *
     * Furthermore, the two JPEG format specifiers can each be passed as a
     * 2-tuple, where the first element is the format speciifed and the second
     * is the IJG quality level. The quality value is an integer between 0 and
     * 100. Higher values result in better image quality but lower compression
     *      rates and therefore larger files. The default quality level is 75
     *      which is applied if no quality parameter is given or if it's set to
     *      0.
     *
     * @defaultValue `'png'` (overrides dvisvgm default, which is `'jpeg'`)
     * @see https://dvisvgm.de/Manpage/#opt-bitmap-format
     */
    bitmapFormat?: BitmapFormat | undefined | null;

    /**
     * If `true`, dvisvgm computes all intersections of clipping paths itself
     * rather than delegating this task to the SVG renderer.
     *
     * @defaultValue `undefined` (defer to dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-clipjoin
     */
    clipJoin?: boolean | undefined | null;

    /**
     * Adds comments with further information about selected data to the SVG
     * file. Currently, only font elements and font CSS rules related to native
     * fonts are annotated.
     *
     * @defaultValue `false` (also dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-comments
     */
    comments?: boolean | undefined | null;

    /**
     * This option tells dvisvgm to replace the specified color with CSS
     * variable `currentColor` which holds the current foreground color set by
     * CSS property color. This way an application or website can change the
     * color via CSS without the need to modify the SVG code.
     *
     * - `true` *(SvelTeX default)*: Replace `'#000'` with `currentColor`.
     * - `false` *(dvisvgm default)*: Don't replace any color with
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
     * Tells dvisvgm to create overlapping grid segments when approximating
     * color gradient fills (cf. option {@link gradSegments | `gradSegments`}).
     * By default, adjacent segments don't overlap but only touch each other
     * like separate tiles. However, this alignment can lead to visible gaps
     * between the segments because the background color usually influences the
     * color at the boundary of the segments if the SVG renderer uses
     * anti-aliasing to create smooth contours. One way to avoid this and to
     * create seamlessly touching color regions is to enlarge the segments so
     * that they extend into the area of their right and bottom neighbors. Since
     * the latter are drawn on top of the overlapping parts, the visible size of
     * all segments keeps unchanged. Just the former gaps disappear as the
     * background is now completely covered by the correct colors. Currently,
     * dvisvgm computes the overlapping segments separately for each patch of
     * the mesh (a patch mesh may consist of multiple patches of the same type).
     * Therefore, there still might be visible gaps at the seam of two adjacent
     * patches.
     *
     * @defaultValue `false` (also dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-grad-overlap
     */
    gradOverlap?: boolean | undefined | null;

    /**
     * Determines the maximal number of segments per column and row used to
     * approximate gradient color fills. Since SVG 1.1 only supports a small
     * subset of the shading algorithms available in PostScript, dvisvgm
     * approximates some of them by subdividing the area to be filled into
     * smaller, monochromatic segments. Each of these segments gets the average
     * color of the region it covers. Thus, increasing the number of segments
     * leads to smaller monochromatic areas and therefore a better approximation
     * of the actual color gradient. As a drawback, more segments imply bigger
     * SVG files because every segment is represented by a separate path
     * element.
     *
     * Currently, dvisvgm supports free- and lattice-form triangular patch
     * meshes as well as Coons and tensor-product patch meshes. They are
     * approximated by subdividing the area of each patch into a *n* by *n* grid
     * of smaller segments. The maximal number of segments per column and row
     * can be changed with this option.
     *
     * @defaultValue `undefined` (defer to dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-grad-segments
     */
    gradSegments?: number | undefined | null;

    /**
     * If the size of the segments created to approximate gradient color fills
     * falls below this number, dvisvgm reduces their level of detail. For
     * example, Bézier curves are replaced by straight lines, and triangular
     * segments are combined to tetragons. For a small `gradSimplify`, these
     * simplifications are usually not noticeable but reduce the size of the
     * generated SVG files significantly.
     *
     * @defaultValue `undefined`
     * @see https://dvisvgm.de/Manpage/#opt-grad-simplify
     */
    gradSimplify?: number | undefined | null;

    /**
     * Selects the method how to mark hyperlinked areas. The style argument can
     * take one of the values none, box, and line.
     *
     * - `'box'`: draws a rectangle around the linked region.
     * - `'line'`: draws the lower edge of the bounding rectangle.
     * - `'none'` tells dvisvgm not to add any visible objects to hyperlinks.
     *
     * The lines and boxes get the current text color selected. In order to
     * apply a different, constant color, a colon followed by a color specifier
     * can be appended to the style string. A color specifier is either a
     * hexadecimal RGB value of the form #RRGGBB, or a dvips color name.
     *
     * Moreover, argument style can take a single color specifier to highlight
     * the linked region by a frameless box filled with that color. An optional
     * second color specifier separated by a colon selects the frame color.
     *
     * Examples: box:red or box:#ff0000 draws red boxes around the linked areas.
     * yellow:blue creates yellow filled rectangles with blue frames.
     *
     * @defaultValue `'none'`
     * @see https://dvisvgm.de/Manpage/#opt-linkmark
     */
    linkmark?: 'none' | 'line' | 'box' | 'color' | undefined | null;

    /**
     * By default, dvisvgm creates CSS styles and class attributes to reference
     * fonts. This variant is more compact than adding the complete font
     * information to each text element over and over again. If set to `true`,
     * this option disables this behavior.
     *
     * @defaultValue `undefined` (defer to dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-no-styles
     */
    noStyles?: boolean | undefined | null;

    /**
     * Applies several optimizations on the generated SVG tree to reduce the
     * file size. The optimizations are performed by running separate optimizer
     * modules for each of the specified optimization. The corresponding modules
     * are executed one by one in the given order and thus transform the XML
     * tree gradually.
     *
     * The following are the currently available optimizer modules:
     *
     * - `'list'`: Lists all available optimizer modules and exits.
     * - `'none'`: If this argument is given, dvisvgm doesn't apply any
     *   optimization. none can't be combined with other module names.
     * - `'all'`: Performs all optimizations listed below. The modules are
     *   executed in a predefined order that usually leads to the best results.
     *   If an array of optimizations is provided, `'all'` must be the only or
     *   the first entry.
     * - `'collapse-groups'`: Combines nested group elements (`<g>...</g>`) that
     *   contain only a single group each. If possible, the group attributes are
     *   moved to the outermost element of the processed subtree. This module
     *   also unwraps group elements that have no attributes at all.
     * - `'group-attributes'`: Creates groups (`<g>...</g>`) for common
     *   attributes around adjacent elements. Each attribute is moved to a
     *   separate group so that multiple common attributes lead to nested
     *   groups. They can be combined by applying optimizer module
     *   collapse-groups afterwards. The algorithm only takes inheritable
     *   properties, such as `fill` or `stroke-width`, into account and only
     *   removes them from an element if none of the other attributes, like
     *   `id`, prevents this.
     * - `'reassign-clippaths'`: Collects all `clipPath` elements that differ
     *   only by their IDs. Afterwards, the duplicates are removed so that only
     *   one remains. All `clip-path` attributes referencing one of the
     *   duplicates are updated accordingly.
     * - `'remove-clippaths'`: Removes all redundant `clipPath` elements.
     * - `'simplify-text'`: If a `text` element only contains whitespace nodes
     *   and `tspan` elements, all common inheritable attributes of the latter
     *   are moved to the enclosing `text` element. All `tspan` elements without
     *   further attributes are unwrapped.
     * - `'simplify-transform'`: Tries to shorten all `transform` attributes.
     *   This module combines the transformation commands of each attribute and
     *   decomposes the resulting transformation matrix into a sequence of basic
     *   transformers, i.e. translation, scaling, rotation, and skewing. If
     *   this sequence is shorter than the equivalent matrix expression, it's
     *   assigned to the attribute. Otherwise, the matrix expression is used.
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
     * SVG allows you to define graphics paths by a sequence of absolute and/or
     * relative path commands, i.e., each command expects either absolute
     * coordinates or coordinates relative to the current drawing position. If
     * this option is set to `true`, relative commands are used; otherwise,
     * absolute commands are used. Using relative commands slightly reduces the
     * size of the SVG files in most cases.
     *
     * @defaultValue `true` (overrides dvisvgm default, which is `false`)
     * @see https://dvisvgm.de/Manpage/#opt-relative
     */
    relative?: boolean | undefined | null;

    /**
     * If `true`, a compressed SVG file with suffix `.svgz` is created. If a
     * number is provided, it specifies the compression level. Valid values are
     * in the range of 1 to 9 (default value is 9). Larger values cause better
     * compression results but may take slightly more computation time.
     *
     * @defaultValue `false`
     * @see https://dvisvgm.de/Manpage/#opt-zip
     */
    zip?: number | boolean | undefined | null;
}

export interface ProcessingOptions {
    /**
     * To speed up the conversion process of bitmap fonts, dvisvgm saves
     * intermediate conversion information in cache files. By default, these
     * files are stored in `$XDG_CACHE_HOME/dvisvgm/` or `$HOME/.cache/dvisvgm`
     * if `XDG_CACHE_HOME` is not set. If you prefer a different location, use
     * this option to overwrite the default. Furthermore, it is also possible to
     * disable the font caching mechanism completely by assigning `'none'` to
     * this option.
     *
     * @defaultValue `undefined` (defer to dvisvgm default; see above)
     * @see https://dvisvgm.de/Manpage/#opt-cache
     */
    cache?: string | undefined | null;

    /**
     * ⚠ **Warning**: This option only affects the processing of DVI files.
     * *(When processing PDF files, the bounding box information stored in these
     * files are used to derive the SVG bounding box.)*
     *
     * This option tells dvisvgm to compute the precise bounding box of each
     * character.
     *
     * - `false` *(dvisvgm default)*: The values stored in a font’s TFM file are
     *   used to determine a glyph’s extent. As these values are intended to
     *   implement optimal character placements and are not designed to
     *   represent the exact dimensions, they don’t necessarily correspond with
     *   the bounds of the visual glyphs. Thus, the width and/or height of some
     *   glyphs may be larger (or smaller) than the respective TFM values. As a
     *   result, this can lead to clipped characters at the bounds of the SVG
     *   graphics.
     * - `true` *(SvelTeX default)*: dvisvgm analyzes the actual shape of each
     *   character and derives a usually tight bounding box.
     *
     * @defaultValue `true`
     * @see https://dvisvgm.de/Manpage/#opt-exact-bbox
     */
    exactBbox?: boolean | undefined | null;

    /**
     * Keep temporary files created by Metafont/TrueType/WOFF.
     *
     * Temporary files created by Metafont (usually `.gf`, `.tfm`, and `.log`
     * files) or the TrueType/WOFF module are automatically removed by default.
     * Setting this option to `true` prevents this automatic removal.
     *
     * @defaultValue `undefined` (defer to dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-keep
     */
    keep?: boolean | undefined | null;

    /**
     * Sets the magnification factor applied in conjunction with Metafont calls
     * prior tracing the glyphs. The larger this value, the better the tracing
     * results. Nevertheless, large magnification values can cause Metafont
     * arithmetic errors due to number overflows. So, use this option with care.
     * The dvisvgm default setting usually produces nice results.
     *
     * @defaultValue `undefined` (defer to dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-mag
     */
    mag?: number | undefined | null;

    /**
     * Suppresses the generation of missing font files.
     *
     * If dvisvgm can't find a font file through the `kpathsea` lookup
     * mechanism, it calls the external tools `mktextfm` or `mktexmf`. If set to
     * `true`, this option disables these calls.
     *
     * @defaultValue `undefined` (defer to dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-no-mktexmf
     */
    noMktexmf?: boolean | undefined | null;

    /**
     * Disable processing of special commands embedded in the DVI file.
     *
     * - `true`: All specials are disabled / no specials are enabled.
     * - `false` *(dvisvgm default)*:: No specials are disabled / all specials
     *   are enabled.
     * - `special: DvisvgmSpecial`: Disables the specified special.
     * - `specials: DvisvgmSpecial[]`: Disables the specified specials.
     *
     * @defaultValue `undefined` (defer to dvisvgm default)
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
     * @defaultValue `undefined` (defer to dvisvgm default)
     * @see https://dvisvgm.de/Manpage/#opt-trace
     */
    traceAll?: boolean | 'retrace' | undefined | null;
}

export interface SvgTransformations {
    /**
     * Rotates the page content clockwise by the given number of degrees, around
     * the page center.
     *
     * @defaultValue `undefined` (no rotation)
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
     * @defaultValue `undefined` (no scaling)
     * @see https://dvisvgm.de/Manpage/#opt-scale
     */
    scale?: number | [number, number] | undefined | null;

    /**
     * Applies a sequence of transformers to the SVG content. See the dvisvgm
     * manpage for more information on the syntax of the transformation string —
     * this string is appended verbatim to the `--transform=` CLI flag, and is
     * not quoted or escaped in any way.
     *
     * @defaultValue `undefined` (no transformation)
     * @see https://dvisvgm.de/Manpage/#opt-transform
     */
    transform?: string | undefined | null;

    /**
     * Translates (moves) the page content.
     *
     * - `dx: number`: Move the content `dx` TeX points to the right.
     * - `[dx, dy]: [number, number]`: Move the content `dx` TeX points to the
     *   right and `dy` TeX points downward.
     *
     * @defaultValue `undefined` (no translation)
     * @see https://dvisvgm.de/Manpage/#opt-translate
     */
    translate?: number | [number, number] | undefined | null;

    /**
     * Multiplies the values of the `width` and `height` attributes of the SVG
     * root element by the given number, while the coordinate system of the
     * graphic content is retained. As a result, most SVG viewers zoom the
     * graphics accordingly. If a negative zoom factor is given, the `width` and
     * `height` attributes are omitted.
     *
     * @defaultValue `undefined` (no zooming)
     * @see https://dvisvgm.de/Manpage/#opt-zoom
     */
    zoom?: number | undefined | null;
}
