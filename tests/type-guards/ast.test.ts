import { describe, it, expect } from 'vitest';
import {
    hasStartEnd_LineColumn,
    hasStartEnd_Offset,
    isFragment_v5,
} from '$type-guards/ast.js';

describe('hasStartEnd_Offset', () => {
    it('should return true for an object with start and end properties of type StartEnd_Offset', () => {
        const node = {
            start: { offset: 0 },
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(true);
    });

    it('should return false for an object without start property', () => {
        const node = {
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object without end property', () => {
        const node = {
            start: { offset: 0 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with start property of incorrect type', () => {
        const node = {
            start: 0,
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with end property of incorrect type', () => {
        const node = {
            start: { offset: 0 },
            end: 10,
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with start property as null', () => {
        const node = {
            start: null,
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with end property as null', () => {
        const node = {
            start: { offset: 0 },
            end: null,
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with start property missing offset', () => {
        const node = {
            start: {},
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with end property missing offset', () => {
        const node = {
            start: { offset: 0 },
            end: {},
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with start offset less than 0', () => {
        const node = {
            start: { offset: -1 },
            end: { offset: 10 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });

    it('should return false for an object with end offset less than start offset', () => {
        const node = {
            start: { offset: 10 },
            end: { offset: 5 },
        };

        expect(hasStartEnd_Offset(node)).toBe(false);
    });
});

describe('hasStartEnd_LineColumn', () => {
    it('should return true for a node with start and end properties of type LineColumn', () => {
        const node = {
            type: 'test',
            start: { line: 1, column: 5 },
            end: { line: 2, column: 10 },
        };

        const result = hasStartEnd_LineColumn(node);

        expect(result).toBe(true);
    });

    it('should return false for a node without start and end properties', () => {
        const node = {
            type: 'test',
        };

        const result = hasStartEnd_LineColumn(node);

        expect(result).toBe(false);
    });

    it('should return false for a node with start and end properties of incorrect types', () => {
        const node = {
            type: 'test',
            start: 1,
            end: '10',
        };

        const result = hasStartEnd_LineColumn(node);

        expect(result).toBe(false);
    });

    it('should return false for a node with end line less than start line', () => {
        const node = {
            type: 'test',
            start: { line: 2, column: 5 },
            end: { line: 1, column: 10 },
        };

        const result = hasStartEnd_LineColumn(node);

        expect(result).toBe(false);
    });

    it('should return false for a node with end line equal to start line and end column less than start column', () => {
        const node = {
            type: 'test',
            start: { line: 1, column: 10 },
            end: { line: 1, column: 5 },
        };

        const result = hasStartEnd_LineColumn(node);

        expect(result).toBe(false);
    });
});

describe('isFragment_v5', () => {
    it('should return true for a valid Fragment_v5 node', () => {
        const node = {
            type: 'Fragment',
            nodes: [
                { type: 'Text', data: 'Hello', start: 1, end: 2 },
                { type: 'Element', name: 'div', start: 3, end: 4 },
            ],
            start: 1,
            end: 4,
        };

        const result = isFragment_v5(node);

        expect(result).toBe(true);
    });

    it('should return false for a node with incorrect type', () => {
        const node = {
            type: 'Element',
            name: 'div',
            start: 1,
            end: 2,
        };

        const result = isFragment_v5(node);

        expect(result).toBe(false);
    });

    it('should return false for a node without "nodes" property', () => {
        const node = {
            type: 'Fragment',
        };

        const result = isFragment_v5(node);

        expect(result).toBe(false);
    });

    it('should return false for a node with "nodes" property that is not an array', () => {
        const node = {
            type: 'Fragment',
            nodes: {},
        };

        const result = isFragment_v5(node);

        expect(result).toBe(false);
    });

    it('should return false for a node with "nodes" property that contains non-BaseNode elements', () => {
        const node = {
            type: 'Fragment',
            nodes: [
                { type: 'Text', data: 'Hello', start: 1, end: 2 },
                { type: 'Element', name: 'div', start: 3, end: 4 },
                'InvalidNode',
            ],
        };

        const result = isFragment_v5(node);

        expect(result).toBe(false);
    });
});
