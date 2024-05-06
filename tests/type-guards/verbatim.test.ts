import {
    isCliInstruction,
    isDvisvgmOptions,
    isSimpleEscapeInstruction,
    isSupportedTexEngine,
    isTexLiveConfig,
    isVerbatimEnvironmentConfiguration,
} from '$type-guards/verbatim.js';
import type { VerbatimEnvironmentConfiguration } from '$types';
import { describe, expect, it } from 'vitest';

describe('isVerbatimEnvironmentConfiguration', () => {
    const verbatimEnvironmentConfigurations: VerbatimEnvironmentConfiguration[] =
        [
            {
                processInner: {},
            },
            {
                processInner: {
                    escapeBraces: true,
                    escapeHtml: true,
                },
            },
            {
                respectSelfClosing: true,
                selfCloseOutputWith: '/>',
                processInner: 'code',
            },
            {
                processInner: 'noop',
            },
            {},
        ];
    it.each([
        ...verbatimEnvironmentConfigurations,
        {
            processInner: 'noop',
            // someUnknownProperty: 'value',
        },
    ])(
        'should return true for valid VerbatimEnvironmentCode objects (%o)',
        (config) => {
            expect(isVerbatimEnvironmentConfiguration(config)).toBe(true);
        },
    );

    it.each([
        {
            processInner: {
                escapeBraces: 'true',
                escapeHtml: true,
            },
        },
        {
            selfCloseOutputWith: '/>',
            processInner: false,
        },
    ])(
        'should return false for invalid VerbatimEnvironmentCode objects (%o)',
        (config) => {
            expect(isVerbatimEnvironmentConfiguration(config)).toBe(false);
        },
    );
});

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
    it.each(['pdflatex', 'lualatex', 'lualatexmk', 'tex', 'latexmk'])(
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

describe('isTexLiveConfig', () => {
    it.each([{}, { shellEscape: 'restricted' }])(
        'should return true for valid TexLiveConfig objects (%o)',
        (config) => {
            expect(isTexLiveConfig(config)).toBe(true);
        },
    );

    it.each([null, '', 123, 'something', undefined])(
        'should return false for invalid TexLiveConfig objects (%o)',
        (config) => {
            expect(isTexLiveConfig(config)).toBe(false);
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