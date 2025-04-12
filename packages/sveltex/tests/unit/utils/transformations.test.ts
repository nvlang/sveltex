import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { spy } from '../fixtures.js';
import { applyTransformations } from '../../../src/utils/transformers.js';
import type { Transformer } from '../../../src/types/handlers/Handler.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('applyTransformations()', () => {
    fixture();
    // let log: MockInstance;
    // let writeFile: MockInstance;
    // let spawnCliInstruction: MockInstance;
    // let readFile: MockInstance;

    beforeAll(async () => {
        await spy(['writeFile', 'log', 'spawnCliInstruction', 'readFile']);
        // log = mocks.log;
        // writeFile = mocks.writeFile;
        // spawnCliInstruction = mocks.spawnCliInstruction;
        // readFile = mocks.readFile;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('input: Transformation', () => {
        fixture();
        it.each([
            [[/a.*e/u, 'a.e'], 'a.e'],
            [[/a.*e/gu, 'a.e'], 'a.e'],
            [[/a(.*)e/gu, '$1'], 'bcd'],
            [['b', '.'], 'a.cde'],
            [(s: string) => s.replace('d', '.'), 'abc.e'],
        ] as [Transformer, string][])('%s', (transformation, expected) => {
            expect(applyTransformations('abcde', {}, transformation)).toEqual(
                expected,
            );
        });
    });

    describe('input: Transformation[]', () => {
        fixture();
        it.each([
            [[[/a.*e/u, 'a.e']], 'a.e'],
            [[['b', '.']], 'a.cde'],
            [
                [
                    ['b', 'x'],
                    ['x', '.'],
                ],
                'a.cde',
            ],
            [[(s: string) => s.replace('d', '.')], 'abc.e'],
            [
                [
                    (s: string) => s.replace('d', 'x'),
                    (s: string) => s.replace('x', '.'),
                ],
                'abc.e',
            ],
            [[(s: string) => s.replace('d', 'x'), ['x', '.']], 'abc.e'],
            [[['d', 'x'], (s: string) => s.replace('x', '.')], 'abc.e'],
        ] as [Transformer[], string][])('%s', (transformers, expected) => {
            expect(applyTransformations('abcde', {}, transformers)).toEqual(
                expected,
            );
        });
    });
});
