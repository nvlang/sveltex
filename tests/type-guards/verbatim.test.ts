import {
    isCliInstruction,
    isDvisvgmOptions,
    isSimpleEscapeInstruction,
    isSupportedTexEngine,
    supportedTexEngines,
} from '$type-guards/verbatim.js';
import { describe, expect, it } from 'vitest';

describe('isCliInstruction', () => {
    it.each([{ command: 'echo' }, { command: 'echo', args: ['something'] }])(
        'should return true for valid CliInstruction objects (%o)',
        (instr) => {
            expect(isCliInstruction(instr)).toBe(true);
        },
    );

    it.each([
        {},
        { command: false },
        { command: 'echo', env: '' },
        { command: 'echo', args: ['something', 123] },
    ])(
        'should return false for invalid CliInstruction objects (%o)',
        (instr) => {
            expect(isCliInstruction(instr)).toBe(false);
        },
    );
});

describe('isDvisvgmOptions', () => {
    it.each([{}])(
        'should return true for valid DvisvgmOptions objects (%o)',
        (instr) => {
            expect(isDvisvgmOptions(instr)).toBe(true);
        },
    );

    it.each([null, '', 123])(
        'should return false for invalid DvisvgmOptions objects (%o)',
        (instr) => {
            expect(isDvisvgmOptions(instr)).toBe(false);
        },
    );
});

describe('isSupportedTexEngine', () => {
    it.each(supportedTexEngines)(
        'should return true for valid SupportedTexEngine strings (%o)',
        (engine) => {
            expect(isSupportedTexEngine(engine)).toBe(true);
        },
    );

    it.each([null, '', 123, 'something', {}, undefined])(
        'should return false for invalid SupportedTexEngine strings (%o)',
        (engine) => {
            expect(isSupportedTexEngine(engine)).toBe(false);
        },
    );
});

describe('isSimpleEscapeInstruction', () => {
    it('should return true for valid SimpleEscapeInstruction object', () => {
        const obj = {
            escapeBraces: true,
            escapeHtml: false,
        };
        expect(isSimpleEscapeInstruction(obj)).toBe(true);
    });

    it('should return false for invalid SimpleEscapeInstruction object', () => {
        const obj = {
            escapeBraces: true,
            escapeHtml: 'false', // Invalid type
        };
        expect(isSimpleEscapeInstruction(obj)).toBe(false);
    });

    it('should return false for non-object input', () => {
        const obj = 'not an object';
        expect(isSimpleEscapeInstruction(obj)).toBe(false);
    });

    it('should return false for null input', () => {
        const obj = null;
        expect(isSimpleEscapeInstruction(obj)).toBe(false);
    });

    it('should return false for object with wrong types', () => {
        const obj = {
            escapeBraces: 'true',
        };
        expect(isSimpleEscapeInstruction(obj)).toBe(false);
    });
});
