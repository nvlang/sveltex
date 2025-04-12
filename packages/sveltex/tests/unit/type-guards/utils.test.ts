import {
    ifPresent,
    ifPresentAndDefined,
    isArray,
    isBoolean,
    isBooleanArray,
    isDefined,
    isFunction,
    isFunctionArray,
    isNonNullObject,
    isNonNullable,
    isNotUndefined,
    isNumber,
    isNumberArray,
    isObject,
    isObjectArray,
    isOneOf,
    isPresent,
    isPresentAndDefined,
    isRecord,
    isString,
} from '../../../src/typeGuards/utils.js';
import { describe, expect, it } from 'vitest';

describe('isNonNullObject', () => {
    it('returns true when input is a non-null object', () => {
        expect(isNonNullObject({ prop: 'value' })).toBe(true);
    });

    it('returns false when input is null', () => {
        expect(isNonNullObject(null)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isNonNullObject(undefined)).toBe(false);
    });

    it('returns false when input is a string', () => {
        expect(isNonNullObject('string')).toBe(false);
    });

    it('returns false when input is a number', () => {
        expect(isNonNullObject(123)).toBe(false);
    });

    it('returns false when input is a boolean', () => {
        expect(isNonNullObject(true)).toBe(false);
    });

    it('returns true when input is an array', () => {
        expect(isNonNullObject([1, 2, 3])).toBe(true);
    });
});

describe('isObject', () => {
    it('returns true when input is an object', () => {
        expect(isObject({})).toBe(true);
    });

    it('returns true when input is null', () => {
        expect(isObject(null)).toBe(true);
    });

    it('returns false when input is a string', () => {
        expect(isObject('test')).toBe(false);
    });

    it('returns false when input is a number', () => {
        expect(isObject(123)).toBe(false);
    });

    it('returns false when input is a boolean', () => {
        expect(isObject(true)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isObject(undefined)).toBe(false);
    });
});

describe('isBoolean', () => {
    it('returns true when input is a boolean', () => {
        expect(isBoolean(true)).toBe(true);
    });

    it('returns false when input is a string', () => {
        expect(isBoolean('test')).toBe(false);
    });

    it('returns false when input is a number', () => {
        expect(isBoolean(123)).toBe(false);
    });

    it('returns false when input is an object', () => {
        expect(isBoolean({})).toBe(false);
    });

    it('returns false when input is null', () => {
        expect(isBoolean(null)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isBoolean(undefined)).toBe(false);
    });
});

describe('isDefined', () => {
    it('returns true when input is defined', () => {
        expect(isDefined('test')).toBe(true);
    });

    it('returns false when input is undefined', () => {
        expect(isDefined(undefined)).toBe(false);
    });
});

describe('isNumber', () => {
    it('returns true when input is a number', () => {
        expect(isNumber(123)).toBe(true);
    });

    it('returns false when input is a string', () => {
        expect(isNumber('test')).toBe(false);
    });

    it('returns false when input is a boolean', () => {
        expect(isNumber(true)).toBe(false);
    });

    it('returns false when input is an object', () => {
        expect(isNumber({})).toBe(false);
    });

    it('returns false when input is null', () => {
        expect(isNumber(null)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isNumber(undefined)).toBe(false);
    });
});

describe('isArray', () => {
    it('returns true when input is an array', () => {
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray([{}, undefined, '2'])).toBe(true);
        expect(isArray([undefined])).toBe(true);
        expect(isArray([])).toBe(true);
    });

    it('returns false when input is a string', () => {
        expect(isArray('test')).toBe(false);
    });

    it('returns false when input is a number', () => {
        expect(isArray(123)).toBe(false);
    });

    it('returns false when input is a boolean', () => {
        expect(isArray(true)).toBe(false);
    });

    it('returns false when input is an object', () => {
        expect(isArray({})).toBe(false);
    });

    it('returns false when input is null', () => {
        expect(isArray(null)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isArray(undefined)).toBe(false);
    });
});

describe('isPresent', () => {
    it.each([{ prop: 'test' }, { prop: null }, { prop: undefined }])(
        'returns true when property is present',
        (obj) => {
            expect(isPresent(obj, 'prop')).toBe(true);
        },
    );

    it.each([{}, { somethingElse: 'something' }])(
        "returns false when property isn't present",
        (obj) => {
            expect(isPresent(obj, 'prop')).toBe(false);
        },
    );
});

describe('isPresentAndDefined', () => {
    it.each([{ prop: 'test' }, { prop: null }])(
        'returns true when property is present and defined',
        (obj) => {
            expect(isPresentAndDefined(obj, 'prop')).toBe(true);
        },
    );

    it.each([{}, { somethingElse: 'something' }, { prop: undefined }])(
        "returns false when property isn't present or is undefined",
        (obj) => {
            expect(isPresentAndDefined(obj, 'prop')).toBe(false);
        },
    );
});

describe('ifPresent', () => {
    it("should return true if the property isn't present", () => {
        expect(ifPresent({}, 'prop', () => false)).toBe(true);
    });

    it('should return true if the property is present and passes the check', () => {
        expect(ifPresent({ prop: undefined }, 'prop', () => true)).toBe(true);
        expect(ifPresent({ prop: null }, 'prop', isDefined)).toBe(true);
        expect(ifPresent({ prop: 'something' }, 'prop', isString)).toBe(true);
    });

    it('should return false if the property is present but fails the check', () => {
        expect(ifPresent({ prop: undefined }, 'prop', () => false)).toBe(false);
        expect(ifPresent({ prop: undefined }, 'prop', isDefined)).toBe(false);
        expect(ifPresent({ prop: 123 }, 'prop', isString)).toBe(false);
    });
});

describe('ifPresentAndDefined', () => {
    it("should return true if the property isn't present", () => {
        expect(ifPresentAndDefined({}, 'prop', () => false)).toBe(true);
    });

    it('should return true if the property is present, but undefined', () => {
        expect(
            ifPresentAndDefined({ prop: undefined }, 'prop', () => false),
        ).toBe(true);
    });

    it('should return true if the property is present, is not undefined, and passes the check', () => {
        expect(ifPresentAndDefined({ prop: null }, 'prop', isDefined)).toBe(
            true,
        );
        expect(
            ifPresentAndDefined({ prop: 'something' }, 'prop', isString),
        ).toBe(true);
    });

    it('should return false if the property is present, is not undefined, but fails the check', () => {
        expect(ifPresentAndDefined({ prop: 123 }, 'prop', isString)).toBe(
            false,
        );
    });
});

describe('isNonNullable', () => {
    it('returns true when input is neither null nor undefined', () => {
        expect(isNonNullable('value')).toBe(true);
        expect(isNonNullable(123)).toBe(true);
        expect(isNonNullable(true)).toBe(true);
        expect(isNonNullable({ prop: 'value' })).toBe(true);
        expect(isNonNullable([1, 2, 3])).toBe(true);
    });

    it('returns false when input is null', () => {
        expect(isNonNullable(null)).toBe(false);
    });

    it('returns false when input is undefined', () => {
        expect(isNonNullable(undefined)).toBe(false);
    });
});

describe('isNotUndefined', () => {
    it('returns true when input is not undefined', () => {
        expect(isNotUndefined('value')).toBe(true);
        expect(isNotUndefined(123)).toBe(true);
        expect(isNotUndefined(true)).toBe(true);
        expect(isNotUndefined({ prop: 'value' })).toBe(true);
        expect(isNotUndefined([1, 2, 3])).toBe(true);
    });

    it('returns false when input is undefined', () => {
        expect(isNotUndefined(undefined)).toBe(false);
    });
});

describe('isFunction', () => {
    it('returns true when input is a function', () => {
        expect(
            isFunction(() => {
                return;
            }),
        ).toBe(true);
    });

    it('returns false when input is not a function', () => {
        expect(isFunction({})).toBe(false);
        expect(isFunction(null)).toBe(false);
        expect(isFunction(undefined)).toBe(false);
        expect(isFunction('string')).toBe(false);
        expect(isFunction(123)).toBe(false);
        expect(isFunction(true)).toBe(false);
        expect(isFunction([])).toBe(false);
    });
});

describe('isNumberArray', () => {
    it('returns true when input is a number array', () => {
        expect(isNumberArray([1, 2, 3])).toBe(true);
    });

    it('returns true when input is an empty array', () => {
        expect(isNumberArray([])).toBe(true);
    });

    it('returns false when input is an array of mixed types', () => {
        expect(isNumberArray([{}, undefined, '2', 3])).toBe(false);
    });

    it('returns false when input is an array of non-numbers', () => {
        expect(isNumberArray([undefined])).toBe(false);
    });

    it('returns false when input is not an array', () => {
        expect(isNumberArray({})).toBe(false);
    });
});

describe('isBooleanArray', () => {
    it('returns true when input is a boolean array', () => {
        expect(isBooleanArray([true, false, true])).toBe(true);
    });

    it('returns true when input is an empty array', () => {
        expect(isBooleanArray([])).toBe(true);
    });

    it('returns false when input is an array of mixed types', () => {
        expect(isBooleanArray([{}, undefined, '2', true])).toBe(false);
    });

    it('returns false when input is an array of undefined', () => {
        expect(isBooleanArray([undefined])).toBe(false);
    });

    it('returns false when input is not an array', () => {
        expect(isBooleanArray({})).toBe(false);
    });
});

describe('isFunctionArray', () => {
    it('returns true when input is an array of objects', () => {
        expect(
            isFunctionArray([
                () => true,
                (sth = '') => sth,
                () => {
                    return;
                },
            ]),
        ).toBe(true);
    });

    it('returns true when input is an empty array', () => {
        expect(isFunctionArray([])).toBe(true);
    });

    it('returns false when input is an array of mixed types', () => {
        expect(isFunctionArray([{}, undefined, '2', () => true])).toBe(false);
    });

    it('returns false when input is an array of undefined', () => {
        expect(isFunctionArray([undefined])).toBe(false);
    });

    it('returns false when input is not an array', () => {
        expect(isFunctionArray({})).toBe(false);
    });
});

describe('isObjectArray', () => {
    it('returns true when input is an array of objects', () => {
        expect(isObjectArray([{}, { prop: 'something' }, {}])).toBe(true);
    });

    it('returns true when input is an empty array', () => {
        expect(isObjectArray([])).toBe(true);
    });

    it('returns false when input is an array of mixed types', () => {
        expect(isObjectArray([{}, undefined, '2', true])).toBe(false);
    });

    it('returns false when input is an array of undefined', () => {
        expect(isObjectArray([undefined])).toBe(false);
    });

    it('returns false when input is not an array', () => {
        expect(isObjectArray({})).toBe(false);
    });
});

describe('isOneOf', () => {
    it('returns true when input is included in the options', () => {
        expect(isOneOf('test', ['test', 'other'])).toBe(true);
        expect(isOneOf(123, [123, 456])).toBe(true);
        expect(isOneOf(true, [true, false])).toBe(true);
        expect(isOneOf(undefined, [undefined])).toBe(true);
    });

    it('returns false when input is not included in the options', () => {
        expect(isOneOf('test', ['other', 'another'])).toBe(false);
        expect(isOneOf(123, [456, 789])).toBe(false);
        expect(isOneOf(undefined, [])).toBe(false);
    });
});

describe('isRecord', () => {
    it.each([
        ['{}', {}],
        ['[]', []],
        ['{ a: 1, b: 2 }', { a: 1, b: 2 }],
        [
            '{ a: 1, b: 2 }, ([k, v]) => isString(k) && isNumber(v)',
            { a: 1, b: 2 },
            ([k, v]) => isString(k) && isNumber(v),
        ],
        ['[1, 2]', [1, 2]],
        [
            '[1, 2], ([k, v]) => isNumber(k) && isNumber(v)',
            [1, 2],
            ([k, v]) => isNumber(k) && isNumber(v),
        ],
    ] as [string, unknown, ((entry: [PropertyKey, unknown]) => boolean)?][])(
        '%s → true',
        (_label, input, check) => {
            expect(isRecord(input, check)).toBe(true);
        },
    );

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['123', 123],
        ["'a'", 'a'],
        [
            '{ a: 1, b: 2 }, ([k, v]) => isString(k) && isString(v)',
            { a: 1, b: 2 },
            ([k, v]) => isString(k) && isString(v),
        ],
        [
            '[1, 2], ([k, v]) => isString(k) && isNumber(v)',
            [1, 2],
            ([k, v]) => isString(k) && isNumber(v),
        ],
    ] as [string, unknown, ((entry: [PropertyKey, unknown]) => boolean)?][])(
        '%s → false',
        (_label, input, check) => {
            expect(isRecord(input, check)).toBe(false);
        },
    );
});
