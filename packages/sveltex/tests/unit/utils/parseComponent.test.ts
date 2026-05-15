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
import { spy } from '../fixtures.js';
import {
    componentRegExp,
    parseComponent,
    interpretString,
    interpretAttributes,
} from '../../../src/utils/parseComponent.js';

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
        describe('interprets strings correctly', () => {
            it.each([
                ['true', true],
                ['false', false],
                ['null', null],
                ['undefined', undefined],
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['+Infinity', Infinity],
                ['-Infinity', -Infinity],
                ['5', 5],
                ['5.5', 5.5],
                ['something', 'something'],
            ])('%o → %o', (str, val) => {
                expect(interpretString(str)).toEqual(val);
            });
        });

        describe('leaves non-strings as they are', () => {
            it.each(
                [
                    true,
                    false,
                    null,
                    undefined,
                    NaN,
                    Infinity,
                    Infinity,
                    -Infinity,
                    5,
                    5.5,
                ].map((v) => [v, v]),
            )('%o → %o', (x) => {
                expect(interpretString(x)).toEqual(x);
            });
        });

        describe('leaves Infinity-suffixed non-numbers as strings', () => {
            // These strings end with "Infinity" (so they pass the
            // `endsWith('Infinity')` check) but match neither the `+Infinity`
            // nor the `-Infinity` pattern.
            it.each(['5Infinity', 'xInfinity', '*Infinity'])(
                '%o stays a string',
                (str) => {
                    expect(interpretString(str)).toEqual(str);
                },
            );
        });

        it('leaves a numeric-looking string as a string when Number() is NaN', () => {
            // `1_9` matches the loose numeric regex (the `.` there matches any
            // character), but `Number('1_9')` is `NaN`, so the original string
            // must be returned unchanged.
            expect(interpretString('1_9')).toEqual('1_9');
        });
    });

    describe('interpretAttributes', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });
        it.each([
            [
                {
                    a1: 'true',
                    a2: 'false',
                    a3: 'null',
                    a4: 'undefined',
                    a5: 'NaN',
                    a6: 'Infinity',
                    a7: '+Infinity',
                    a8: '-Infinity',
                    a9: '5',
                    a10: '5.5',
                    a11: 'something',
                    a12: 'undefined',
                },
                {
                    a1: true,
                    a2: false,
                    a3: null,
                    a4: undefined,
                    a5: NaN,
                    a6: Infinity,
                    a7: Infinity,
                    a8: -Infinity,
                    a9: 5,
                    a10: 5.5,
                    a11: 'something',
                    a12: undefined,
                },
            ],
        ])('%o → %o', (raw, interpreted) => {
            expect(interpretAttributes(raw)).toEqual(interpreted);
            expect(log).not.toHaveBeenCalled();
        });

        it('should deal with non-strings gracefully', () => {
            log.mockClear();
            expect(interpretAttributes({ a: null })).toEqual({
                a: null,
            });
            expect(log).toHaveBeenCalledTimes(0);
        });

        it('should pass `undefined`s as-is', () => {
            log.mockClear();
            expect(interpretAttributes({ a: undefined })).toEqual({
                a: undefined,
            });
            expect(log).not.toHaveBeenCalled();
        });

        it('should drop non-string values of unsupported types', () => {
            // Objects and arrays are neither strings nor booleans/numbers/null,
            // so they are not copied into the result.
            log.mockClear();
            expect(interpretAttributes({ a: {}, b: [1, 2], c: 'kept' })).toEqual(
                { c: 'kept' },
            );
            expect(log).not.toHaveBeenCalled();
        });
    });
});

describe('parseComponent', () => {
    describe('core', () => {
        it.each([
            [
                '<div class="container">Hello, world!</div>',
                {
                    tag: 'div',
                    attributes: { class: 'container' },
                    innerContent: 'Hello, world!',
                    selfClosing: false,
                },
            ],
            [
                '<tex ref="test">\\begin{something}&&&;<>>\\end{something}</tex>',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    innerContent: '\\begin{something}&&&;<>>\\end{something}',
                    selfClosing: false,
                },
            ],
            [
                '<tex ref="test" />',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    innerContent: undefined,
                    selfClosing: true,
                },
            ],
            [
                '<tex ref=test />',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    innerContent: undefined,
                    selfClosing: true,
                },
            ],
            [
                '<a:b-c_d test />',
                {
                    tag: 'a:b-c_d',
                    attributes: { test: undefined },
                    innerContent: undefined,
                    selfClosing: true,
                },
            ],
        ])('%o → %o', (input, expected) => {
            expect(parseComponent(input)).toEqual(expected);
        });
    });

    describe('error handling', () => {
        it.each(['</div>', '<></>', '<tag/></tag>'])(
            'should throw on invalid HTML: %o',
            (input) => {
                expect(() => parseComponent(input)).toThrow();
            },
        );

        it('should reject a self-closing tag that also has a closing tag', () => {
            // The whitespace between `/>` and `</tag>` forces the regex to
            // capture a non-empty `innerContent` AND a `closingTag`, so the
            // `selfClosing && closingTag !== undefined` guard fires.
            expect(() => parseComponent('<span/> </span>')).toThrow(
                'self-closing tag should not have closing tag',
            );
        });

        it('should reject a void element that has inner content', () => {
            expect(() => parseComponent('<br>content</br>')).toThrow(
                'void element <br> should not have inner content',
            );
        });

        it('should reject a void element with inner content but no closing tag', () => {
            expect(() => parseComponent('<hr>text')).toThrow(
                'void element <hr> should not have inner content',
            );
        });

        it('should accept a self-closing void element without content', () => {
            // Exercises the void-element branch where there is neither inner
            // content nor a closing tag (the `else if` falls through).
            expect(parseComponent('<br/>')).toEqual({
                tag: 'br',
                attributes: {},
                innerContent: undefined,
                selfClosing: true,
            });
        });

        it('should accept a void element written without a slash', () => {
            expect(parseComponent('<input name="q">')).toEqual({
                tag: 'input',
                attributes: { name: 'q' },
                innerContent: undefined,
                selfClosing: false,
            });
        });
    });
});

describe('componentsRegExp', () => {
    it.each(['<span>text</span>'])(
        'should match valid HTML components',
        (input) => {
            expect(input.match(componentRegExp)).not.toBeNull();
        },
    );
});
