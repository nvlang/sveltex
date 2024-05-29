import { describe, expect, it } from 'vitest';

import { getHexRegExp, unescapeCssColorVars } from '$utils/css.js';
import { nodeAssert } from '$deps.js';

describe.concurrent('getHexRegExp()', () => {
    describe.each([
        ['black', ['000', '000000', '#000', '#000000', 'black']],
        [
            'blue',
            [
                '00F',
                '00f',
                '0000FF',
                '0000fF',
                '0000Ff',
                '0000ff',
                '#00F',
                '#00f',
                '#0000FF',
                '#0000fF',
                '#0000Ff',
                '#0000ff',
                'blue',
            ],
        ],
        ['#1234', ['#1234', '#11223344']],
    ] as const)('matches %s', (_label, strings) => {
        describe.each(strings)('getHexRegExp(%o)', (string) => {
            // console.log(regExp.test('fill="#000"'));
            it.each(
                strings
                    .filter(
                        (color) =>
                            color.startsWith('#') ||
                            ['black', 'blue'].includes(color),
                    )
                    .flatMap((color) => [
                        `fill="${color}"`,
                        `stroke='${color}'`,
                        `color=${color}\n`,
                        `fill=${color}>`,
                        `fill=" ${color} "`,
                        `fill= " ${color} "`,
                        `fill = ${color} ...`,
                    ]),
            )('matches %o', (str) => {
                const regExp = getHexRegExp(string);
                expect(regExp).toBeDefined();
                nodeAssert(regExp);
                expect(regExp.test(str)).toBe(true);
            });

            // expect(
            //     strings
            //         .filter(
            //             (color) =>
            //                 color.startsWith('#') ||
            //                 ['black', 'blue'].includes(color),
            //         )
            //         .flatMap((color) => [
            //             `fill="${color}"`,
            //             `stroke='${color}'`,
            //             `color=${color}\n`,
            //             `fill=${color}>`,
            //             `fill=" ${color} "`,
            //             `fill= " ${color} "`,
            //             `fill = ${color} ...`,
            //         ])
            //         .every((str) => {
            //             const b = regExp.test(str);
            //             //!!str.match(regExp);
            //             if (!b) {
            //                 console.log(
            //                     inspect(regExp),
            //                     'did not match',
            //                     inspect(str),
            //                 );
            //             }
            //             return b;
            //         }),
            // ).toBe(true);
        });
    });
    describe('returns undefined for invalid inputs', () => {
        it.each(['12345', 'not a color name'])('%o → undefined', (string) => {
            expect(getHexRegExp(string)).toBeUndefined();
        });
    });
});

describe.concurrent('unescapeCssColorVars', () => {
    it('should work', () => {
        const map = new Map<`--${string}`, string>();
        map.set('--css-var-123456', '123456');
        expect(unescapeCssColorVars('#123456', map)).toEqual(
            'var(--css-var-123456)',
        );
    });

    it('should convert #RRGGBB to #RGB if applicable', () => {
        const map = new Map<`--${string}`, string>();
        map.set('--css-var', '112233');
        expect(unescapeCssColorVars('#123', map)).toEqual('var(--css-var)');
    });

    it('should do nothing if invalid input is given', () => {
        const map = new Map<`--${string}`, string>();
        map.set('--css-var', '12345');
        expect(unescapeCssColorVars('#12345', map)).toEqual('#12345');
    });
});
