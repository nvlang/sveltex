import { describe, it, expect } from 'vitest';
import {
    checkBackend,
    isArray,
    isBoolean,
    isDefined,
    isNonNullObject,
    isNumber,
    isObject,
} from '$type-guards/utils.js';

describe('checkBackend', () => {
    it('returns true when obj has the specified backend', () => {
        const obj = { backend: 'backend1' };
        const backend = 'backend1';
        expect(checkBackend(obj, backend)).toBe(true);
    });

    it('returns false when obj does not have the specified backend', () => {
        const obj = { backend: 'backend1' };
        const backend = 'backend2';
        expect(checkBackend(obj, backend)).toBe(false);
    });

    it('returns true when this has the specified backend and obj does not have a backend property', () => {
        const obj = {};
        const backend = 'backend1';
        const context = { backend: 'backend1' };
        expect(checkBackend.call(context, obj, backend)).toBe(true);
    });

    it('returns false when this does not have the specified backend and obj does not have a backend property', () => {
        const obj = {};
        const backend = 'backend1';
        const context = { backend: 'backend2' };
        expect(checkBackend.call(context, obj, backend)).toBe(false);
    });
});

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
