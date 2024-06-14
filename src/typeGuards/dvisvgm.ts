// Types
import type {
    BoundingBox,
    Coordinate,
    DinIsoPaperSize,
    NorthAmericanPaperSize,
    PaperSize,
    TexDim,
    TexDimUnit,
    TexDimUnitless,
    TexDimWithUnit,
} from '$types/utils/DvisvgmOptions.js';

// Internal dependencies
import {
    isArray,
    isNonNullObject,
    isNumber,
    isString,
} from '$typeGuards/utils.js';

export function isTexDimUnitless(value: unknown): value is TexDimUnitless {
    return isNumber(value);
}

export function isTexDimWithUnit(value: unknown): value is TexDimWithUnit {
    return (
        isArray(value) &&
        value.length === 2 &&
        isNumber(value[0]) &&
        isTexDimUnit(value[1])
    );
}

export function isTexDimUnit(value: unknown): value is TexDimUnit {
    return (
        isString(value) &&
        ['pt', 'mm', 'cm', 'in', 'bp', 'pc', 'dd', 'cc', 'sp'].includes(value)
    );
}

export function isTexDim(value: unknown): value is TexDim {
    return isTexDimUnitless(value) || isTexDimWithUnit(value);
}

export function isCoordinate(value: unknown): value is Coordinate {
    return (
        isNonNullObject(value) &&
        'x' in value &&
        'y' in value &&
        isTexDim(value.x) &&
        isTexDim(value.y)
    );
}

export function isBoundingBox(value: unknown): value is BoundingBox {
    return (
        isNonNullObject(value) &&
        'topLeft' in value &&
        'bottomRight' in value &&
        isCoordinate(value.topLeft) &&
        isCoordinate(value.bottomRight)
    );
}

export function isDinIsoPaperSize(value: unknown): value is DinIsoPaperSize {
    return isString(value) && /^[A-D](\d|10)$/.test(value);
}

export function isNorthAmericanPaperSize(
    value: unknown,
): value is NorthAmericanPaperSize {
    return (
        isString(value) &&
        ['invoice', 'executive', 'legal', 'letter', 'ledger'].includes(value)
    );
}

export function isPaperSize(value: unknown): value is PaperSize {
    if (typeof value === 'string') {
        return isDinIsoPaperSize(value) || isNorthAmericanPaperSize(value);
    }
    if (isNonNullObject(value) && 'paperSize' in value) {
        return (
            (isDinIsoPaperSize(value.paperSize) ||
                isNorthAmericanPaperSize(value.paperSize)) &&
            ('orientation' in value
                ? value.orientation === undefined ||
                  value.orientation === 'portrait' ||
                  value.orientation === 'landscape'
                : true)
        );
    }
    return false;
}
