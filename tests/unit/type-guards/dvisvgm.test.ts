import { describe, it, expect } from 'vitest';
import { isPaperSize } from '$typeGuards/dvisvgm.js';

describe('isPaperSize', () => {
    it('should return true for valid paper size strings', () => {
        expect(isPaperSize('A4')).toBe(true);
        expect(isPaperSize('letter')).toBe(true);
    });

    it('should return true for valid paper size objects', () => {
        expect(isPaperSize({ paperSize: 'A4' })).toBe(true);
        expect(
            isPaperSize({ paperSize: 'letter', orientation: 'portrait' }),
        ).toBe(true);
    });

    it('should return false for invalid paper size values', () => {
        expect(isPaperSize('InvalidSize')).toBe(false);
        expect(isPaperSize({})).toBe(false);
        expect(isPaperSize({ paperSize: 'A4', orientation: 'invalid' })).toBe(
            false,
        );
    });
});
