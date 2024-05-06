import { describe, it, expect } from 'vitest';
import { mergeConfigs } from '$utils/merge.js';
import { range } from '$tests';

function nested(
    n: number,
    obj: Record<string, unknown>,
): Record<string, unknown> {
    if (n === 0) return obj;
    return { z: nested(n - 1, obj) };
}

function mergeConfigsNested(n: number, ...configs: Record<string, unknown>[]) {
    const nestedConfigs = configs.map((c) => nested(n, c));
    if (nestedConfigs[0] === undefined) return undefined;
    return mergeConfigs(nestedConfigs[0], ...nestedConfigs.slice(1));
}

describe.each(range(1, 5))('mergeCustom', (level) => {
    it('should work with records', () => {
        const config1 = {
            a: {
                aa: 1,
                ab: 1,
            },
            b: 1,
        };
        const config2 = {
            a: {
                aa: 2,
                ac: 2,
            },
            c: 2,
        };
        const config3 = {
            a: {
                aa: 3,
                ad: 3,
            },
            d: 3,
        };
        expect(mergeConfigsNested(level, config1, config2, config3)).toEqual(
            nested(level, {
                a: {
                    aa: 3,
                    ab: 1,
                    ac: 2,
                    ad: 3,
                },
                b: 1,
                c: 2,
                d: 3,
            }),
        );
    });

    it('should concatenate arrays', () => {
        const config1 = {
            a: [1, 2],
            b: { c: [1, 2] },
        };
        const config2 = {
            a: [3],
            b: { c: [3] },
        };
        expect(mergeConfigsNested(0, config1, config2)).toEqual(
            nested(0, {
                a: [1, 2, 3],
                b: { c: [1, 2, 3] },
            }),
        );
    });

    it('should not allow undefined overrides', () => {
        const c1 = { a: 1, b: 1 };
        const c2 = { a: 2, b: undefined };
        const c3 = { a: undefined, b: 3 };
        expect(mergeConfigsNested(level, c1, c2, c3)).toEqual(
            nested(level, { a: 2, b: 3 }),
        );
    });

    it('should not allow null overrides', () => {
        const c1 = { a: 1, b: 1 };
        const c2 = { a: 2, b: null };
        const c3 = { a: null, b: 3 };
        expect(mergeConfigsNested(level, c1, c2, c3)).toEqual(
            nested(level, { a: 2, b: 3 }),
        );
    });

    it.each([
        [1, '1'],
        ['1', 1],
        [1, [1]],
        [[1], 1],
        [1, { a: 1 }],
        [{ a: 1 }, 1],
    ] as [unknown, unknown][])(
        'should prefer last input if types are incompatible',
        (a1, a2) => {
            const c1 = { a: a1 };
            const c2 = { a: a2 };
            expect(mergeConfigsNested(level, c1, c2)).toEqual(
                nested(level, { a: a2 }),
            );
        },
    );

    it.each([
        [1, '1'],
        ['1', 1],
        [1, [1]],
        [[1], 1],
        [1, { a: 1 }],
        [{ a: 1 }, 1],
    ] as [unknown, unknown][])(
        'should work equally well on any level of nesting',
        (a1, a2) => {
            const c1 = { a: a1 };
            const c2 = { a: a2 };
            expect(mergeConfigsNested(level, c1, c2)).toEqual(
                nested(level, { a: a2 }),
            );
        },
    );
});
