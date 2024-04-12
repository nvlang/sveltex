import { describe, it, expect } from 'vitest';
import { escapeWhitespace } from '$src/utils/log.js';

describe('escapeWhitespace', () => {
    it('should escape whitespace characters', () => {
        const input = 'Hello\nWorld\t!';
        const expectedOutput = 'Hello\\nWorld\\t!';
        const output = escapeWhitespace(input);
        expect(output).toEqual(expectedOutput);
    });

    it('should not escape non-whitespace characters', () => {
        const input = 'Hello World!';
        const expectedOutput = 'Hello World!';
        const output = escapeWhitespace(input);
        expect(output).toEqual(expectedOutput);
    });
});
