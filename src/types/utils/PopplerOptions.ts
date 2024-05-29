import { MakePropertiesNotNullOrUndefined } from '$types/utils/utility-types.js';

export type CleanPopplerSvgOptions =
    MakePropertiesNotNullOrUndefined<ExtendedPopplerSvgOptions>;

export interface ExtendedPopplerSvgOptions extends PopplerSvgOptions {
    svgFile: true;
}

export interface PopplerSvgOptions {
    /**
     * Set the Cairo antialias option used for text and drawing in rasterized
     * regions of the SVG output.
     *
     * @defaultValue `'default'`
     */
    antialias?:
        | 'best'
        | 'default'
        | 'fast'
        | 'good'
        | 'gray'
        | 'none'
        | 'subpixel'
        | undefined
        | null;

    /**
     * Specifies the height of crop area in points.
     */
    cropHeight?: number | undefined | null;

    /**
     * Specifies the size of crop square in points.
     */
    cropSize?: number | undefined | null;

    /**
     * Specifies the width of crop area in points.
     */
    cropWidth?: number | undefined | null;

    /**
     * Specifies the x-coordinate of the crop area top left corner points.
     */
    cropXAxis?: number | undefined | null;

    /**
     * Specifies the y-coordinate of the crop area top left corner in points.
     *
     * @defaultValue `null`
     */
    cropYAxis?: number | undefined | null;

    /**
     * Expand PDF pages smaller than the paper to fill the paper.
     *
     * @defaultValue `false`
     */
    fillPage?: boolean | undefined | null;

    /**
     * By default, PDF pages smaller than the paper (after any scaling) are
     * centered on the paper. This option causes them to be aligned to the
     * lower-left corner of the paper instead.
     *
     * @defaultValue `false`
     */
    noCenter?: boolean | undefined | null;

    /**
     * By default, printing output is cropped to the CropBox specified in the
     * PDF file. This option disables cropping.
     *
     * @defaultValue `false`
     */
    noCrop?: boolean | undefined | null;

    /**
     * Do not scale PDF pages which are larger than the paper. By default, pages
     * larger than the paper are shrunk to fit.
     *
     * @defaultValue `false`
     */
    noShrink?: boolean | undefined | null;

    /**
     * Set the paper size of each page to match the size specified in the PDF
     * file.
     */
    originalPageSizes?: boolean | undefined | null;

    /**
     * Set the paper height, in points.
     */
    paperHeight?: number | undefined | null;

    /**
     * Set the paper size to one of `'A3'`, `'A4'`, `'legal'`, or `'letter'`.
     * This can also be set to `'match'`, which will set the paper size of each
     * page to match the size specified in the PDF file. If none of the
     * `paperSize`, `paperWidth`, or `paperHeight` options are specified the
     * default is to match the paper size.
     */
    paperSize?: 'A3' | 'A4' | 'legal' | 'letter' | 'match' | undefined | null;

    /**
     * Set the paper width.
     */
    paperWidth?: number | undefined | null;

    /**
     * Print copyright and version information.
     */
    printVersionInfo?: boolean | undefined | null;

    /**
     * Do not print any messages or errors.
     */
    quiet?: boolean | undefined | null;

    /**
     * Specifies the X resolution, in pixels per inch (PPI), of rasterized
     * regions in vector output.
     *
     * @defaultValue `150`
     */
    resolutionXAxis?: number | undefined | null;

    /**
     * Specifies the X and Y resolution, in pixels per inch (PPI), of rasterized
     * regions in vector output.
     *
     * @defaultValue `150`
     */
    resolutionXYAxis?: number | undefined | null;

    /**
     * Specifies the Y resolution, in pixels per inch (PPI), of rasterized
     * regions in vector output.
     *
     * @defaultValue `150`
     */
    resolutionYAxis?: number | undefined | null;
}

// export interface PopplerOptions {
//     /**
//      * Set the Cairo antialias option used for text and drawing in image files
//      * (or rasterized regions in vector output).
//      */
//     antialias:
//         | 'best'
//         | 'default'
//         | 'fast'
//         | 'good'
//         | 'gray'
//         | 'none'
//         | 'subpixel';

//     /**
//      * Uses the crop box rather than media box when generating the files
//      * (PNG/JPEG/TIFF only).
//      */
//     cropBox: boolean;

//     /**
//      * Specifies the height of crop area in pixels (image output) or points
//      * (vector output).
//      */
//     cropHeight: number;

//     /**
//      * Specifies the size of crop square in pixels (image output) or points
//      * (vector output).
//      */
//     cropSize: number;

//     /**
//      * Specifies the width of crop area in pixels (image output) or points
//      * (vector output).
//      */
//     cropWidth: number;

//     /**
//      * Specifies the x-coordinate of the crop area top left corner in pixels
//      * (image output) or points (vector output).
//      */
//     cropXAxis: number;

//     /**
//      * Specifies the y-coordinate of the crop area top left corner in pixels
//      * (image output) or points (vector output).
//      */
//     cropYAxis: number;

//     /**
//      * Adds the %%IncludeFeature: *Duplex DuplexNoTumble DSC comment to the
//      * PostScript file (PS only). This tells the print manager to enable
//      * duplexing.
//      */
//     duplex: boolean;

//     /**
//      * Generate an EPS file. An EPS file contains a single image, so if you use
//      * this option with a multi-page PDF file, you must use `firstPageToConvert`
//      * and `lastPageToConvert` to specify a single page. The page size options
//      * (originalPageSizes, paperSize, paperWidth, paperHeight) can not be used
//      * with this option.
//      */
//     epsFile: boolean;

//     /**
//      * Generates only the even numbered pages.
//      */
//     evenPagesOnly: boolean;

//     /**
//      * Expand PDF pages smaller than the paper to fill the paper (PS,PDF,SVG
//      * only). By default, these pages are not scaled.
//      */
//     fillPage: boolean;

//     /**
//      * Specifies the first page to convert.
//      */
//     firstPageToConvert: number;

//     /**
//      * Generate grayscale file (PNG, JPEG, and TIFF only).
//      */
//     grayscaleFile: boolean;

//     /**
//      * Use the specified ICC file as the output profile (PNG only). The profile
//      * will be embedded in the PNG file.
//      */
//     iccFile: string;

//     /**
//      * Generate JPEG file(s).
//      */
//     jpegFile: boolean;

//     /**
//      * When used with `jpegFile`, this option can be used to control the JPEG
//      * compression parameters. It takes a string of the form
//      * `"<opt>=<val>[,<opt>=<val>]"`. Currently available options are:
//      * - `quality` Selects the JPEG quality value. The value must be an integer
//      *   between 0 and 100.
//      * - `progressive` Select progressive JPEG output. The possible values are
//      *   "y", "n", indicating progressive (yes) or non-progressive (no),
//      *   respectively.
//      * - `optimize` Sets whether to compute optimal Huffman coding tables for
//      *   the JPEG output, which will create smaller files but make an extra pass
//      *   over the data. The value must be "y" or "n", with "y" performing
//      *   optimization, otherwise the default Huffman tables are used.
//      *
//      * Example: `"quality=95,optimize=y"`.
//      */
//     jpegOptions: string;

//     /**
//      * Specifies the last page to convert.
//      */
//     lastPageToConvert: number;

//     /**
//      * Generate monochrome file (PNG and TIFF only).
//      */
//     monochromeFile: boolean;

//     /**
//      * By default, PDF pages smaller than the paper (after any scaling) are
//      * centered on the paper. This option causes them to be aligned to the
//      * lower-left corner of the paper instead (PS,PDF,SVG only).
//      */
//     noCenter: boolean;

//     /**
//      * By default, printing output is cropped to the CropBox specified in the
//      * PDF file. This option disables cropping (PS, PDF, SVG only).
//      */
//     noCrop: boolean;

//     /**
//      * Do not scale PDF pages which are larger than the paper (PS,PDF,SVG only).
//      * By default, pages larger than the paper are shrunk to fit.
//      */
//     noShrink: boolean;

//     /**
//      * Generates only the odd numbered pages.
//      */
//     oddPagesOnly: boolean;

//     /**
//      * Set the paper size of each page to match the size specified in the PDF
//      * file.
//      */
//     originalPageSizes: boolean;

//     /**
//      * Specify the owner password for the PDF file. Providing this will bypass
//      * all security restrictions.
//      */
//     ownerPassword: string;

//     /**
//      * Set the paper height, in points (PS, PDF, SVG only).
//      */
//     paperHeight: number;

//     /**
//      * Set the paper size to one of `A3`, `A4`, `legal`, or `letter` (PS,PDF,SVG
//      * only). This can also be set to `match`, which will set the paper size of
//      * each page to match the size specified in the PDF file. If none of the
//      * paperSize, paperWidth, or paperHeight options are specified the default
//      * is to match the paper size.
//      */
//     paperSize: 'A3' | 'A4' | 'legal' | 'letter' | 'match';

//     /**
//      * Set the paper width, in points (PS,PDF,SVG only).
//      */
//     paperWidth: number;

//     /**
//      * Generate PDF file.
//      */
//     pdfFile: boolean;

//     /**
//      * Generate PNG file(s).
//      */
//     pngFile: boolean;

//     /**
//      * Print copyright and version information.
//      */
//     printVersionInfo: boolean;

//     /**
//      * If the input file contains structural information about the document's
//      * content, write this information to the output file (PDF only).
//      */
//     printDocStruct: boolean;

//     /**
//      * Generate PS file.
//      */
//     psFile: boolean;

//     /**
//      * Generate Level 2 PostScript (PS only).
//      */
//     psLevel2: boolean;

//     /**
//      * Generate Level 3 PostScript (PS only). This enables all Level 2 features
//      * plus shading patterns and masked images. This is the default setting.
//      */
//     psLevel3: boolean;

//     /**
//      * Do not print any messages or errors.
//      */
//     quiet: boolean;

//     /**
//      * Specifies the X resolution, in pixels per inch of image files (or
//      * rasterized regions in vector output). The default is 150 PPI.
//      */
//     resolutionXAxis: number;

//     /**
//      * Specifies the X and Y resolution, in pixels per inch of image files (or
//      * rasterized regions in vector output). The default is 150 PPI.
//      */
//     resolutionXYAxis: number;

//     /**
//      * Specifies the Y resolution, in pixels per inch of image files (or
//      * rasterized regions in vector output). The default is 150 PPI.
//      */
//     resolutionYAxis: number;

//     /**
//      * Scales the long side of each page (width for landscape pages, height for
//      * portrait pages) to fit in scale-to pixels. The size of the short side
//      * will be determined by the aspect ratio of the page (PNG/JPEG/TIFF only).
//      */
//     scalePageTo: number;

//     /**
//      * Scales each page horizontally to fit in scale-to-x pixels. If scale-to-y
//      * is set to -1, the vertical size will determined by the aspect ratio of
//      * the page (PNG/JPEG/TIFF only).
//      */
//     scalePageToXAxis: number;

//     /**
//      * Scales each page vertically to fit in scale-to-y pixels. If scale-to-x is
//      * set to -1, the horizontal size will determined by the aspect ratio of the
//      * page (PNG/JPEG/TIFF only).
//      */
//     scalePageToYAxis: number;

//     /**
//      * Writes only the first page and does not add digits. Can only be used with
//      * `jpegFile`, `pngFile`, and `tiffFile`.
//      */
//     singleFile: boolean;

//     /**
//      * Generate SVG (Scalable Vector Graphics) file.
//      */
//     svgFile: boolean;

//     /**
//      * Set TIFF compression.
//      */
//     tiffCompression: 'deflate' | 'jpeg' | 'lzw' | 'none' | 'packbits';

//     /**
//      * Generate TIFF file(s).
//      */
//     tiffFile: boolean;

//     /**
//      * Use a transparent page color instead of white (PNG and TIFF only).
//      */
//     transparentPageColor: boolean;

//     /**
//      * Specify the user password for the PDF file.
//      */
//     userPassword: string;
// }
