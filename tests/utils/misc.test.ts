import {
    ensureDoesNotStartWithSlash,
    prefixWithSlash,
    ensureWithinRange,
    re,
    sha256,
    copyTransformation,
    isValidComponentName,
    copyTransformations,
    postfixWithSlash,
} from '$utils/misc.js';
import { spy } from '$tests/fixtures.js';
import {
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
    type MockInstance,
} from 'vitest';
import { interpretString, interpretAttributes } from '$utils/parseComponent.js';
import { Transformation } from '$types/handlers/misc.js';

describe.concurrent('utils/misc', () => {
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['log']);
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    describe('isValidTexComponentConfig', () => {
        it('should return true for a valid configuration', () => {
            expect(isValidComponentName('something')).toBe(true);
        });
        it('should return false for a valid configuration', () => {
            expect(isValidComponentName('div')).toBe(false);
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

    describe('ensureDoesNotStartWithSlash', () => {
        it('should remove leading slash', () => {
            expect(ensureDoesNotStartWithSlash('/abc')).toEqual('abc');
            expect(ensureDoesNotStartWithSlash('//abc')).toEqual('/abc');
        });
        it('should return strings without leading slashes as-is', () => {
            expect(ensureDoesNotStartWithSlash('abc')).toEqual('abc');
            expect(ensureDoesNotStartWithSlash('abc/')).toEqual('abc/');
        });
    });

    describe('prefixWithSlash', () => {
        it('should add leading slash', () => {
            expect(prefixWithSlash('abc')).toEqual('/abc');
        });
        it('should return strings with leading slashes as-is', () => {
            expect(prefixWithSlash('/abc')).toEqual('/abc');
            expect(prefixWithSlash('/abc/')).toEqual('/abc/');
        });
    });

    describe('postfixWithSlash', () => {
        it('should add leading slash', () => {
            expect(postfixWithSlash('abc')).toEqual('abc/');
        });
        it('should return strings with leading slashes as-is', () => {
            expect(postfixWithSlash('abc/')).toEqual('abc/');
            expect(postfixWithSlash('/abc/')).toEqual('/abc/');
        });
    });

    describe.each([
        [/a/, 'b'],
        [/.*(\[)-+/gmsu, 'b'],
        ['abc', 'def'],
    ])('copyTransformation([%o, %o])', (r, s) => {
        it('should return equivalent transformation', () => {
            expect(copyTransformation([r, s])).toEqual([r, s]);
        });
        it('should not return reference to original transformation', () => {
            const t: Transformation = [r, s];
            expect(copyTransformation(t)).not.toBe(t);
        });
    });

    describe.each([(str: string) => str + str])(
        'copyTransformation(%s)',
        (t) => {
            it('should return equivalent transformation', () => {
                expect(copyTransformation(t)).toEqual(t);
            });
            it('should return reference to original transformation', () => {
                expect(copyTransformation(t)).toBe(t);
            });
        },
    );

    describe.each([
        [[/a/, 'b']],
        [[/.*(\[)-+/gmsu, 'b']],
        [['abc', 'def']],
    ] as Transformation[][])('copyTransformations([%o, %o])', (t) => {
        it('should return equivalent transformation', () => {
            expect(copyTransformations(t)).toEqual(t);
        });
        it('should not return reference to original transformation', () => {
            expect(copyTransformations(t)).not.toBe(t);
        });
    });

    describe.each([
        [(str: string) => str + str, (str: string) => 'a' + str + 'b'],
    ])('copyTransformations(%s)', (t) => {
        it('should return equivalent transformation', () => {
            expect(copyTransformations(t)).toEqual(t);
        });
        it('should return reference to original transformation', () => {
            expect(copyTransformations(t)).toBe(t);
        });
    });
});
