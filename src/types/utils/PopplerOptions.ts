import { PropertiesDefinedNotNull } from '$types/utils/utility-types.js';

export type CleanPopplerSvgOptions =
    PropertiesDefinedNotNull<ExtendedPopplerSvgOptions>;

export interface ExtendedPopplerSvgOptions extends PopplerSvgOptions {
    svgFile: true;
}

/**
 * Adapted from https://github.com/Fdawgs/node-poppler.
 */
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
     * Specifies (in points) the height of the crop area.
     */
    cropHeight?: number | undefined | null;

    /**
     * Specifies (in points) the size of the crop square.
     */
    cropSize?: number | undefined | null;

    /**
     * Specifies (in points) the width of the crop area.
     */
    cropWidth?: number | undefined | null;

    /**
     * Specifies (in points) the x-coordinate of the crop area's top left
     * corner.
     */
    cropXAxis?: number | undefined | null;

    /**
     * Specifies (in points) the y-coordinate of the crop area's top left
     * corner.
     *
     * @defaultValue `null`
     */
    cropYAxis?: number | undefined | null;

    /**
     * Scale small PDF pages to fill the paper.
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
