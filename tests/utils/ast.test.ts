import { describe, it, expect } from 'vitest';
import { getLocationUnist, lineColToLocation } from '$utils/ast.js';
import type { UnistNode } from '$deps.js';
import { cartesianProduct, range } from '$tests/utils.js';
import { LineColumn, Offsets } from '$types/utils/Ast.js';

describe('getLocationUnist', () => {
    describe('core functionality', () => {
        it.each([
            [
                {
                    start: { offset: 0, column: 1, line: 1 },
                    end: { offset: 10, column: 11, line: 1 },
                },
                ['const x = "something";', 'const y = "something else";'],
            ],
            [
                {
                    start: { offset: 20, column: 21, line: 1 },
                    end: { offset: 25, column: 3, line: 2 },
                },
                ['const x = "something";', 'const y = "something else";'],
            ],
            [
                {
                    start: { offset: 2, column: 1, line: 2 },
                    end: { offset: 6, column: 2, line: 4 },
                },
                ['a', '', 'b', 'c'],
            ],
        ] as [NonNullable<UnistNode['position']>, string[]][])(
            '%o on %o',
            (position, source) => {
                const n1: UnistNode = { type: '', position };

                const expected = {
                    start: position.start.offset,
                    end: position.end.offset,
                };

                position.start.offset = undefined;
                position.end.offset = undefined;

                const n2: UnistNode = { type: '', position };

                const loc1 = getLocationUnist(n1, source);
                const loc2 = getLocationUnist(n2, source);

                expect(loc1).toEqual(expected);
                expect(loc2).toEqual(expected);
            },
        );
    });
    describe('error handling', () => {
        it('no position prop → throw error', () => {
            const node = { type: 'test' };
            expect(() => getLocationUnist(node, [''])).toThrowError(
                /Could not determine location of node:/,
            );
        });
    });
});

describe('lineColToLocation', () => {
    describe("'123456789\\n123...9\\n1...'", () => {
        /**
         * This source string has the neat property that within it one can
         * convert line-column pairs to offsets with the following
         * formula:
         *
         * ```
         * offset = (line - 1) * 10 + col - 1
         * ```
         */
        const source = range(1, 10).map(() => '123456789');

        const tests: [string, LineColumn, LineColumn, Offsets][] =
            cartesianProduct([1, 2, 5], [1, 4, 10], [1, 2, 3], [1, 4, 10]).map(
                ([line, column, lineShift, endColumn]) => {
                    const start = (line - 1) * 10 + column - 1;
                    const end = (line + lineShift - 1) * 10 + endColumn - 1;
                    const label = `${String(line)}:${String(column)} to ${String(line + lineShift)}:${String(endColumn)} → ${String(start)} to ${String(end)}`;
                    return [
                        label,
                        { line, column },
                        { line: line + lineShift, column: endColumn },
                        { start, end },
                    ];
                },
            );

        describe.each([0, 1])(`%i-based cols`, (colOrigin) => {
            it.each(tests)('%s', (_label, start, end, expected) => {
                const location = lineColToLocation(
                    start,
                    end,
                    source,
                    !!colOrigin,
                );
                expect(location.start).toEqual(expected.start + +!colOrigin);
                expect(location.end).toEqual(expected.end + +!colOrigin);
            });
        });
    });

    describe('empty string', () => {
        it.each([0, 1])('%i-based cols', (colOrigin) => {
            const source = [''];
            expect(
                lineColToLocation(
                    { line: 1, column: colOrigin },
                    { line: 1, column: colOrigin },
                    source,
                    !!colOrigin,
                ),
            ).toEqual({ start: 0, end: 0 });
        });
    });
});
