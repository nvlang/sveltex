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
import { spy } from '$tests/unit/fixtures.js';
import { componentRegExp, parseComponent } from '$utils/parseComponent.js';
import { interpretString, interpretAttributes } from '$utils/parseComponent.js';

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
                ['+Infinity', +Infinity],
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
                    +Infinity,
                    -Infinity,
                    5,
                    5.5,
                ].map((v) => [v, v]),
            )('%o → %o', (x) => {
                expect(interpretString(x)).toEqual(x);
            });
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
                    a7: +Infinity,
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
                    innerContent: '',
                    selfClosing: true,
                },
            ],
            [
                '<tex ref=test />',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    innerContent: '',
                    selfClosing: true,
                },
            ],
            [
                '<a:b-c_d test />',
                {
                    tag: 'a:b-c_d',
                    attributes: { test: true },
                    innerContent: '',
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
