import { describe, it, expect } from 'vitest';
import {
    isSimpleEscapeInstruction,
    isVerbatimEnvironmentCode,
} from '$type-guards';
import type { VerbatimEnvironmentCode } from '$src/types/SveltexConfig.js';

describe('isVerbatimEnvironmentCode', () => {
    const verbatimEnvironmentCodes: VerbatimEnvironmentCode[] = [
        // 'noop',
        // 'code',
        {
            processInner: {
                escapeBraces: true,
                escapeHtml: true,
            },
        } as VerbatimEnvironmentCode,
        // (content: string, attributes: Record<string, unknown>) =>
        //     'Custom: ' + content + JSON.stringify(attributes),
    ];
    it.each(verbatimEnvironmentCodes)(
        'should return true for valid VerbatimEnvironmentCode objects',
        (code) => {
            expect(isVerbatimEnvironmentCode(code)).toBe(true);
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

    it('should return false for object without required properties', () => {
        const obj = {
            escapeBraces: true,
        };
        expect(isSimpleEscapeInstruction(obj)).toBe(false);
    });
});
