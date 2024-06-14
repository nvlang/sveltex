import { describe, expect, it } from 'vitest';

import {
    getHexRegExp,
    parseCssColorVarsFromTex,
    unescapeCssColorVars,
} from '$utils/css.js';
import { nodeAssert } from '$deps.js';
import { sha256 } from '$utils/misc.js';
import { hexOfNamedColor } from '$data/css.js';

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

describe('parseCssColorVarsFromTex', () => {
    describe('should be able to deal with collisions', () => {
        it('with reserved colors', () => {
            const cssVar = '--npvyzwya';
            nodeAssert(sha256(cssVar, 'hex').startsWith(hexOfNamedColor.wheat));
            const res = parseCssColorVarsFromTex(
                [
                    '\\color{var(--yellow)}',
                    `\\textcolor{var(${cssVar})}{example}`,
                    'text',
                    '\\color{var(--red)}',
                ].join('\n'),
            );
            expect([...res.values()]).not.toContain(hexOfNamedColor.wheat);
            expect([...res.values()]).toEqual(['2bd23b', 'd28547', '68fdb4']);
        });
        it('with previous hashes', () => {
            const cssVar1 = '--nvykiagp';
            const cssVar2 = '--mboqcuhm';
            nodeAssert(
                sha256(cssVar1, 'hex').slice(0, 6) ===
                    sha256(cssVar2, 'hex').slice(0, 6),
            );
            const res = parseCssColorVarsFromTex(
                [
                    `\\color{var(${cssVar1})}`,
                    `\\textcolor{var(--red)}{example}`,
                    'text',
                    `\\color{var(${cssVar2})}`,
                    `\\color{var(${cssVar2})}`,
                ].join('\n'),
            );
            expect([...res.values()]).not.toContain(hexOfNamedColor.wheat);
            expect([...res.values()]).toEqual(['a0db91', '68fdb4', '65ca50']);
        });
        it('with reserved colors and previous hashes', () => {
            const cssVar = '--npvyzwya';
            nodeAssert(sha256(cssVar, 'hex').startsWith(hexOfNamedColor.wheat));
            const cssVar1 = '--nvykiagp';
            const cssVar2 = '--mboqcuhm';
            nodeAssert(
                sha256(cssVar1, 'hex').slice(0, 6) ===
                    sha256(cssVar2, 'hex').slice(0, 6),
            );
            const res = parseCssColorVarsFromTex(
                [
                    `\\color{var(${cssVar1})}`,
                    `\\textcolor{var(${cssVar})}{example}`,
                    'text',
                    `\\color{var(${cssVar2})}`,
                    `\\color{var(${cssVar2})}`,
                ].join('\n'),
            );
            expect([...res.values()]).not.toContain(hexOfNamedColor.wheat);
            expect([...res.values()]).toEqual(['a0db91', 'd28547', '65ca50']);
        });
    });
});

// --nvykiagp, --mboqcuhm
// Shared SHA-256 Prefix: a0db91
// SHA-256 Hashes: a0db91b7cfe2a93d7c6926450c1532ec4870a5e154fbb7e287157f594141e546, a0db914608009376c0a11c8fd4ff1a8b38650d50059387ba5e8ad9e0b84b60df
