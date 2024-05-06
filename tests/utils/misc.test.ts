import {
    ensureWithinRange,
    interpretAttributes,
    interpretString,
    re,
    sha256,
} from '$utils/misc.js';
import { spy } from '$tests/fixtures.js';
import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';

suite.concurrent('utils/misc', async () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });
    const { log } = await spy(['log']);

    describe('interpretString', () => {
        it.each([
            ['true', true],
            ['false', false],
            ['null', null],
            ['undefined', undefined],
            ['NaN', NaN],
            ['Infinity', Infinity],
            ['+Infinity', +Infinity],
            ['-Infinity', -Infinity],
            ['5', 5],
            ['5.5', 5.5],
            ['something', 'something'],
        ])('interprets "$str" as $str', (str, val) => {
            expect(interpretString(str)).toEqual(val);
        });

        it('interprets undefined as undefined', () => {
            expect(interpretString(undefined)).toEqual(undefined);
        });
    });

    describe('interpretAttributes', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });
        it('should work', () => {
            expect(
                interpretAttributes({
                    a: 'true',
                    b: 'false',
                    c: 'null',
                    d: 'undefined',
                    e: 'NaN',
                    f: 'Infinity',
                    g: '+Infinity',
                    h: '-Infinity',
                    i: '5',
                    j: '5.5',
                    k: 'something',
                    l: 'undefined',
                }),
            ).toEqual(
                expect.objectContaining({
                    a: true,
                    b: false,
                    c: null,
                    d: undefined,
                    e: NaN,
                    f: Infinity,
                    g: +Infinity,
                    h: -Infinity,
                    i: 5,
                    j: 5.5,
                    k: 'something',
                    l: undefined,
                }),
            );
            expect(log).not.toHaveBeenCalled();
        });

        it('should deal with non-strings gracefully (strict)', () => {
            expect(interpretAttributes({ a: null })).toEqual({});
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining('Ignoring attribute.'),
            );
        });

        it('should deal with non-strings gracefully (non-strict)', () => {
            log.mockClear();
            expect(interpretAttributes({ a: null }, false)).toEqual({
                a: null,
            });
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'warn',
                expect.stringContaining('Passing value as-is.'),
            );
        });

        it('should pass `undefined`s as-is', () => {
            log.mockClear();
            expect(interpretAttributes({ a: undefined })).toEqual({
                a: undefined,
            });
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('ensureWithinRange', () => {
        it('should return number as is if within range', () => {
            expect(ensureWithinRange(5, [0, 10])).toEqual(5);
        });

        it('should return upper bound if number is above range', () => {
            expect(ensureWithinRange(123, [0, 10])).toEqual(10);
        });

        it('should return lower bound if number is below range', () => {
            expect(ensureWithinRange(-123, [0, 10])).toEqual(0);
        });

        it('should return NaN if invalid range is provided', () => {
            expect(ensureWithinRange(0, [1, 0])).toEqual(NaN);
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                'Invalid range:',
                [1, 0],
            );
        });

        it('should return number as is if range is unbounded', () => {
            expect(ensureWithinRange(5, [-Infinity, Infinity])).toEqual(5);
        });

        it('should work with partially unbounded ranges', () => {
            expect(ensureWithinRange(5, [0, Infinity])).toEqual(5);
            expect(ensureWithinRange(-5, [0, Infinity])).toEqual(0);
            expect(ensureWithinRange(-5, [-Infinity, 0])).toEqual(-5);
            expect(ensureWithinRange(5, [-Infinity, 0])).toEqual(0);
        });
    });

    describe('sha256', () => {
        it('should work', () => {
            // [Test vector from Wikipedia](https://en.wikipedia.org/wiki/SHA-2#Test_vectors)
            expect(sha256('', 'hex')).toEqual(
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            );
        });
    });

    describe('re', () => {
        it('removes unescaped whitespace', () => {
            expect(re` a  b `).toEqual(/ab/);
            expect(re` a \\ b `).toEqual(/a\\b/);
            expect(re` a \\\\ b `).toEqual(/a\\\\b/);
            expect(
                re`
                    a\\\\ b \n

                    \n
                `,
            ).toEqual(/a\\\\b\n\n/);
        });
        it('unescapes escaped whitespace', () => {
            expect(re` a \   b `).toEqual(/a b/);
            expect(re` a  \\\   b `).toEqual(/a\\ b/);
        });
        it('removes comments', () => {
            expect(re` a \   b # abc `).toEqual(/a b/);
            expect(
                re` a  \\\   b # some comment \\ something \n\n\n c `,
            ).toEqual(/a\\ b/);
        });
        it('unescapes escaped backticks and hashtags', () => {
            expect(re` a \   b \# \\\# \\\\# abc \# \\\# \\\\#`).toEqual(
                /a b#\\#\\\\/,
            );
            expect(
                re` \`\\\` a  \\\   b # some comment \\ something \n\n\n c `,
            ).toEqual(/`\\`a\\ b/);
        });
    });
});
