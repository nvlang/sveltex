import {
    isMetaHttpEquiv,
    isMetaName,
} from '../../../src/typeGuards/frontmatter.js';
import { describe, it, expect } from 'vitest';

describe('isMetaName', () => {
    it.each([
        ['charset', true],
        ['author', true],
        ['application-name', true],
        ['description', true],
        ['generator', true],
        ['keywords', true],
        ['viewport', true],
        ['content-security-policy', false],
        ['default-style', false],
        ['title', false],
        ['foo', false],
    ])('isMetaName(%o) → %o', (str, expected) => {
        expect(isMetaName(str)).toEqual(expected);
    });
});

describe('isMetaHttpEquiv()', () => {
    it.each([
        ['charset', false],
        ['author', false],
        ['application-name', false],
        ['description', false],
        ['generator', false],
        ['keywords', false],
        ['viewport', false],
        ['content-security-policy', true],
        ['default-style', true],
        ['title', false],
        ['foo', false],
    ])('isMetaHttpEquiv(%o) → %o', (str, expected) => {
        expect(isMetaHttpEquiv(str)).toEqual(expected);
    });
});
