import { range } from '$tests/utils.js';
import { spy } from '$tests/fixtures.js';
import { isString } from '$type-guards/utils.js';
import { Diagnoser } from '$utils/diagnosers/Diagnoser.js';
import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    type MockInstance,
    beforeAll,
} from 'vitest';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('Diagnoser', () => {
    let log: MockInstance;
    fixture();
    beforeAll(async () => {
        const mocks = await spy(
            ['writeFileEnsureDir', 'log', 'existsSync'],
            true,
        );
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('is a class', () => {
        expect(Diagnoser).toBeTypeOf('function');
        expect(Diagnoser).toBeInstanceOf(Function);
    });

    it('should log nice error messages (no details by default)', () => {
        const x = {
            a: {},
            b: null,
            c: '',
            d: 0,
            e: true,
            f: [],
            g: () => undefined,
            h: undefined,
        };
        const d = new Diagnoser(x);
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
        const expected = [
            'an object',
            'null',
            'a string',
            'a number',
            'a boolean',
            'an object',
            'a function',
        ] as const;
        letters.forEach((key) => {
            d.ifPresent(key, '', () => false);
        });
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(7);
        d.printProblems();
        expect(log).toHaveBeenCalledTimes(7);
        range(1, 7).forEach((i) => {
            expect(log).toHaveBeenNthCalledWith(
                i,
                'error',
                `- Expected "${String(letters[i - 1])}" to be . Instead, got ${String(expected[i - 1])}.`,
            );
        });
    });

    it('should log nice error messages (with details if requested)', () => {
        const x = { a: [], b: 0, c: {} };
        const d = new Diagnoser(x);
        d.ifPresent('a', 'nonempty', () => false, 'object');
        d.ifPresent('b', 'nonzero', () => false, 'number');
        d.ifPresent('c', '≠ {}', () => false, 'object');
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(3);
        d.printProblems();
        expect(log).toHaveBeenCalledTimes(3);
        expect(log).toHaveBeenNthCalledWith(
            1,
            'error',
            '- Expected "a" to be nonempty. Instead, got: []',
        );
        expect(log).toHaveBeenNthCalledWith(
            2,
            'error',
            '- Expected "b" to be nonzero. Instead, got: 0',
        );
        expect(log).toHaveBeenNthCalledWith(
            3,
            'error',
            '- Expected "c" to be ≠ {}. Instead, got: {}',
        );
    });

    it('should work with nested properties (pass)', () => {
        const x = { a: { b: { c: 123 } } };
        const d = new Diagnoser(x);
        d.ifPresent('a.b.c', '123', (x) => x === 123);
        expect(d.passed).toBe(true);
        expect(d.problems).toEqual([]);
        d.printProblems();
        expect(log).not.toHaveBeenCalled();
    });

    it('should work with nested properties (fail)', () => {
        const x = { a: { b: { c: 'something' } } };
        const d = new Diagnoser(x);
        d.ifPresent('a.b.c', '123', (x) => x === 123);
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(1);
        d.printProblems();
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(
            1,
            'error',
            '- Expected "a.b.c" to be 123. Instead, got undefined.',
        );
    });

    it('should be able to turn off colors', () => {
        const x = { a: { b: { c: 'something' } } };
        const d = new Diagnoser(x);
        d.ifPresent('a.b.c', '123', (x) => x === 123);
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(1);
        d.printProblems(undefined, undefined, undefined, false);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(
            1,
            { severity: 'error', style: null },
            '- Expected "a.b.c" to be 123. Instead, got undefined.',
        );
    });

    it('addProblem', () => {
        const x = {};
        const d = new Diagnoser(x);
        d.addProblem('a');
        d.addProblem('b', 'warn');
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(2);
        d.printProblems();
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(1, 'error', '- a');
        expect(log).toHaveBeenNthCalledWith(2, 'warn', '- b');
    });

    it('should be able to change prefix', () => {
        const x = { a: { b: { c: 'something' } } };
        const d = new Diagnoser(x);
        d.ifPresent('a.b.c', '123', (x) => x === 123);
        expect(d.passed).toBe(false);
        expect(d.problems.length).toEqual(1);
        d.printProblems(undefined, undefined, undefined, undefined, 'prefix ');
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenNthCalledWith(
            1,
            'error',
            'prefix Expected "a.b.c" to be 123. Instead, got undefined.',
        );
    });

    describe('what + grouped + order', () => {
        fixture();
        const x = {
            '1': null,
            '2': null,
            '5': null,
            '6': null,
            '8': null,
            '9': null,
        };
        const d = new Diagnoser(x);
        d.ifPresent('1', 'string', isString);
        d.ifPresent('2', 'string', isString, undefined, 'warn');
        d.ifPresent('8', 'string', isString, undefined, 'warn');
        d.ifPresent('9', 'string', isString);
        d.ifPresent('5', 'string', isString);
        d.ifPresent('6', 'string', isString, undefined, 'warn');

        it.each([
            [undefined, undefined, undefined, [1, 5, 9, 2, 6, 8]],
            ['both', false, 'asc', [1, 2, 5, 6, 8, 9]],
            ['both', true, 'asc', [1, 5, 9, 2, 6, 8]],
            ['both', false, 'desc', [9, 8, 6, 5, 2, 1]],
            ['both', true, 'desc', [9, 5, 1, 8, 6, 2]],
            ['both', false, 'unmodified', [1, 2, 8, 9, 5, 6]],
            ['both', true, 'unmodified', [1, 9, 5, 2, 8, 6]],
            ['both', false, 'reversed', [6, 5, 9, 8, 2, 1]],
            ['both', true, 'reversed', [5, 9, 1, 6, 8, 2]],
            ['warnings', false, 'asc', [2, 6, 8]],
            ['warnings', true, 'asc', [2, 6, 8]],
            ['warnings', false, 'desc', [8, 6, 2]],
            ['warnings', true, 'desc', [8, 6, 2]],
            ['warnings', false, 'unmodified', [2, 8, 6]],
            ['warnings', true, 'unmodified', [2, 8, 6]],
            ['warnings', false, 'reversed', [6, 8, 2]],
            ['warnings', true, 'reversed', [6, 8, 2]],
            ['errors', false, 'asc', [1, 5, 9]],
            ['errors', true, 'asc', [1, 5, 9]],
            ['errors', false, 'desc', [9, 5, 1]],
            ['errors', true, 'desc', [9, 5, 1]],
            ['errors', false, 'unmodified', [1, 9, 5]],
            ['errors', true, 'unmodified', [1, 9, 5]],
            ['errors', false, 'reversed', [5, 9, 1]],
            ['errors', true, 'reversed', [5, 9, 1]],
        ] as const)(
            'should properly sort and group problems (order: %s, grouping: %s)',
            (what, order, grouping, expectedOrder) => {
                d.printProblems(what, order, grouping);
                expect(log).toHaveBeenCalledTimes(
                    what === 'both' || what === undefined ? 6 : 3,
                );
                expectedOrder.forEach((key, i) => {
                    expect(log).toHaveBeenNthCalledWith(
                        i + 1,
                        key === 1 || key === 9 || key === 5 ? 'error' : 'warn',
                        expect.stringContaining(String(key)),
                    );
                });
            },
        );
    });
});
