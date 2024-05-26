import { describe, expect, it } from 'vitest';

import type {
    BBox,
    BitmapFormat,
    BoundingBox,
    PaperSize,
    TexDim,
} from '$types/utils/DvisvgmOptions.js';

import {
    bboxToFlagValue,
    bitmapFormatToFlagValue,
    buildDvisvgmInstruction,
} from '$utils/dvisvgm.js';
import { getDefaultConversionOptions } from '$config/defaults.js';

describe.concurrent('bboxToFlagValue', () => {
    it('should return the string representation of a TexDim', () => {
        const bbox: TexDim = [10, 'pt'];
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('10pt');
    });

    it('should return the string representation of a TexDim 2', () => {
        const bbox = getDefaultConversionOptions('dvisvgm').svg.bbox ?? 'A1';
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('2pt');
    });

    it('should return the string representation of a TexDim with unitless value', () => {
        const bbox: TexDim = 20;
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('20');
    });

    it('should return the string representation of a BoundingBox', () => {
        const bbox: BoundingBox = {
            topLeft: { x: 0, y: 0 },
            bottomRight: { x: 100, y: 100 },
        };
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('0,0,100,100');
    });

    it('should return the string representation of a PaperSize (A4, landscape)', () => {
        const bbox: PaperSize = {
            paperSize: 'A4',
            orientation: 'landscape',
        };
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('A4-landscape');
    });

    it('should return the string representation of a PaperSize (letter, portrait)', () => {
        const bbox: PaperSize = {
            paperSize: 'letter',
            orientation: 'portrait',
        };
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('letter-portrait');
    });

    it('should return the string representation of a PaperSize (C5)', () => {
        const bbox: PaperSize = {
            paperSize: 'C5',
        };
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('C5');
    });

    it('should return the input value if it is not a recognized type', () => {
        const bbox = 'custom-bbox' as BBox;
        const result = bboxToFlagValue(bbox);
        expect(result).toEqual('custom-bbox');
    });
});

describe.concurrent('bitmapFormatToFlagValue', () => {
    it('should return the bitmap format as string if it is already a string', () => {
        const bitmapFormat = 'png';
        const result = bitmapFormatToFlagValue(bitmapFormat);
        expect(result).toEqual(bitmapFormat);
    });

    it('should return the bitmap format as string with percentage if it is an array', () => {
        const bitmapFormat: BitmapFormat = ['jpeggray', 80];
        const result = bitmapFormatToFlagValue(bitmapFormat);
        expect(result).toEqual('jpeggray:80');
    });

    it('should return the bitmap format as string with 0 percentage if it is less than 0', () => {
        const bitmapFormat: BitmapFormat = ['jpeg', -10];
        const result = bitmapFormatToFlagValue(bitmapFormat);
        expect(result).toEqual('jpeg:0');
    });

    it('should return the bitmap format as string with 100 percentage if it is greater than 100', () => {
        const bitmapFormat: BitmapFormat = ['jpeg', 120];
        const result = bitmapFormatToFlagValue(bitmapFormat);
        expect(result).toEqual('jpeg:100');
    });
});

describe.concurrent('buildDvisvgmInstruction', () => {
    it('should build the correct CLI instruction for DVI input', () => {
        const instruction = buildDvisvgmInstruction({
            outputPath: '/path/to/output.svg',
            texPath: '/path/to/input.tex',
            inputType: 'dvi',
            dvisvgmOptions: {
                processing: {
                    cache: '/path/to/cache',
                    exactBbox: true,
                    keep: true,
                    mag: 1.2,
                    noMktexmf: true,
                    noSpecials: ['bgcolor', 'html'],
                    traceAll: 'retrace',
                },
                svg: {
                    bbox: {
                        topLeft: { x: 0, y: 0 },
                        bottomRight: { x: 100, y: 100 },
                    },
                    bitmapFormat: 'png',
                    clipJoin: true,
                    comments: true,
                    currentColor: '#000000',
                    fontFormat: 'woff2',
                    gradOverlap: true,
                    gradSegments: 10,
                    gradSimplify: 0.5,
                    linkmark: 'box',
                    noStyles: true,
                    optimize: [
                        'collapse-groups',
                        'reassign-clippaths',
                        'remove-clippaths',
                    ],
                    precision: 4,
                    relative: true,
                    zip: 5,
                },
                console: {
                    color: true,
                    message: 'Hello, world!',
                    progress: 50,
                },
                svgTransformations: {
                    rotate: 90,
                    scale: [2, 2],
                    transform: 'matrix(1, 0, 0, 1, 0, 0)',
                    translate: [10, 10],
                    zoom: 2,
                },
                customArgs: ['--custom-flag'],
            },
        });

        expect(instruction).toEqual({
            command: 'dvisvgm',
            args: [
                '--output=/path/to/output.svg',
                '--cache=/path/to/cache',
                '--exact-bbox',
                '--keep',
                '--mag=1.2',
                '--no-mktexmf',
                '--no-specials=bgcolor,html',
                '--trace-all=true',
                '--bbox=0,0,100,100',
                '--bitmap-format=png',
                '--clip-join',
                '--comments',
                '--currentcolor=#000000',
                '--embed-bitmaps',
                '--font-format=woff2',
                '--grad-overlap',
                '--grad-segments=10',
                '--grad-simplify=0.5',
                '--linkmark=box',
                '--no-styles',
                '--optimize=collapse-groups,reassign-clippaths,remove-clippaths',
                '--precision=4',
                '--relative',
                '--zip=5',
                '--color',
                '--message=Hello, world!',
                '--progress=50',
                '--verbosity=3',
                '--rotate=90',
                '--scale=2,2',
                '--transform=matrix(1, 0, 0, 1, 0, 0)',
                '--translate=10,10',
                '--zoom=2',
                '--custom-flag',
                '/path/to/input.tex',
            ],
        });
    });

    it('should build the correct CLI instruction for PDF input', () => {
        const instruction = buildDvisvgmInstruction({
            outputPath: '/path/to/output.svg',
            texPath: '/path/to/input.tex',
            inputType: 'pdf',
            dvisvgmOptions: {
                processing: {
                    cache: '/path/to/cache',
                    exactBbox: true,
                    keep: true,
                    mag: 1.2,
                    noMktexmf: true,
                    noSpecials: true,
                    traceAll: 'retrace',
                },
                svg: {
                    bbox: 'A4',
                    bitmapFormat: 'png',
                    clipJoin: true,
                    comments: true,
                    currentColor: '#000000',
                    fontFormat: 'woff2',
                    gradOverlap: true,
                    gradSegments: 10,
                    gradSimplify: 0.5,
                    linkmark: 'box',
                    noStyles: true,
                    optimize: [
                        'collapse-groups',
                        'reassign-clippaths',
                        'remove-clippaths',
                    ],
                    precision: 4,
                    relative: true,
                    zip: 5,
                },
                console: {
                    color: true,
                    message: 'Hello, world!',
                    progress: 50,
                },
                svgTransformations: {
                    rotate: 90,
                    scale: [2, 2],
                    transform: 'matrix(1, 0, 0, 1, 0, 0)',
                    translate: [10, 10],
                    zoom: 2,
                },
                customArgs: ['--custom-flag'],
            },
        });

        expect(instruction).toEqual({
            command: 'dvisvgm',
            args: [
                '--pdf',
                '--output=/path/to/output.svg',
                '--cache=/path/to/cache',
                '--keep',
                '--mag=1.2',
                '--no-mktexmf',
                '--no-specials',
                '--trace-all=true',
                '--bitmap-format=png',
                '--clip-join',
                '--comments',
                '--currentcolor=#000000',
                '--font-format=woff2',
                '--grad-overlap',
                '--grad-segments=10',
                '--grad-simplify=0.5',
                '--linkmark=box',
                '--no-styles',
                '--optimize=collapse-groups,reassign-clippaths,remove-clippaths',
                '--precision=4',
                '--relative',
                '--zip=5',
                '--color',
                '--message=Hello, world!',
                '--progress=50',
                '--verbosity=3',
                '--rotate=90',
                '--scale=2,2',
                '--transform=matrix(1, 0, 0, 1, 0, 0)',
                '--translate=10,10',
                '--zoom=2',
                '--custom-flag',
                '/path/to/input.tex',
            ],
        });
    });

    it('should build the correct CLI instruction for DVI input 2', () => {
        const instruction = buildDvisvgmInstruction({
            outputPath: '/path/to/output.svg',
            texPath: '/path/to/input.tex',
            inputType: 'dvi',
            dvisvgmOptions: {
                processing: {
                    noSpecials: 'html',
                    traceAll: true,
                },
                svg: {
                    bbox: {
                        topLeft: { x: [0, 'cc'], y: 0 },
                        bottomRight: { x: [100, 'cm'], y: [100, 'bp'] },
                    },
                    currentColor: true,
                    zip: true,
                },
                customArgs: ['--custom-flag=1', '--custom-flag-two'],
                svgTransformations: {
                    scale: 2,
                    translate: 3,
                },
            },
        });

        expect(instruction).toEqual({
            command: 'dvisvgm',
            args: [
                '--output=/path/to/output.svg',
                '--exact-bbox',
                '--no-specials=html',
                '--trace-all',
                '--bbox=0cc,0,100cm,100bp',
                '--bitmap-format=png',
                '--currentcolor',
                '--embed-bitmaps',
                '--font-format=woff2',
                '--linkmark=none',
                '--optimize=all',
                '--precision=0',
                '--relative',
                '--zip',
                '--color',
                '--progress',
                '--verbosity=3',
                '--scale=2',
                '--translate=3',
                '--custom-flag=1',
                '--custom-flag-two',
                '/path/to/input.tex',
            ],
        });
    });

    it('should build the correct default CLI instruction', () => {
        const instruction = buildDvisvgmInstruction({
            outputPath: "'/path/to/output.svg'",
            texPath: '/path/to/input.tex',
            inputType: 'dvi',
        });

        expect(instruction).toEqual({
            command: 'dvisvgm',
            args: [
                "--output='/path/to/output.svg'",
                '--exact-bbox',
                '--bbox=2pt',
                '--bitmap-format=png',
                '--currentcolor=#000',
                '--embed-bitmaps',
                '--font-format=woff2',
                '--linkmark=none',
                '--optimize=all',
                '--precision=0',
                '--relative',
                '--color',
                '--progress',
                '--verbosity=3',
                '/path/to/input.tex',
            ],
        });
    });
});
