import { describe, it, expect, vi, suite, beforeEach } from 'vitest';
import {
    getChildren,
    getLocation,
    lineColToLocation,
    parse,
    stringifyAst,
    walk,
} from '$utils';

suite('AST utilities', () => {
    describe.each([3, 4, 5, 6, 7, 8])('getLocation', (version) => {
        it('should return the correct location for a node with start and end properties', () => {
            const node = {
                type: 'test',
                start: 1,
                end: 10,
            };

            const location = getLocation(node, undefined, version);

            expect(location).toEqual({
                start: 1,
                end: 10,
            });
        });

        it('should return the correct location for a node with range property', () => {
            const node = { type: 'test', range: [5, 15] };

            const location = getLocation(node, undefined, version);

            expect(location).toEqual({
                start: 5,
                end: 15,
            });
        });

        it('should return the correct location for a node with loc property and source', () => {
            const node = {
                type: 'test',
                loc: {
                    start: { line: 1, column: 5 },
                    end: { line: 2, column: 10 },
                },
            };

            const source =
                'const x = "something";\nconst y = "something else";';

            const location = getLocation(node, source, version);

            expect(location).toEqual({
                start: 5,
                end: 32,
            });
        });

        it('should throw an error for a node without start and end properties', () => {
            const node = {
                type: 'test',
            };

            expect(() => getLocation(node, undefined, version)).toThrowError(
                'Could not determine location of node: ' + JSON.stringify(node),
            );
        });

        it('should', () => {
            const node = {
                type: 'test',
                loc: {
                    start: { line: 1, column: 5 },
                    end: { line: 2, column: 10 },
                },
            };

            const source =
                'const x = "something";\nconst y = "something else";';

            const location = getLocation(node, source, version);

            expect(location).toEqual({
                start: 5,
                end: 32,
            });
        });

        vi.unmock('$utils/env.js');
    });

    describe('lineColToLocation', () => {
        it('should correctly convert line-column to offset location with string source', () => {
            const source = 'line 1 - text\nline 2 - text\nline 3 - text';
            const start = { line: 2, column: 1 };
            const end = { line: 3, column: 5 };
            const location = lineColToLocation(start, end, source);
            expect(location).toEqual({ start: 14, end: 31 });
        });

        it('should correctly convert line-column to offset location with source', () => {
            const source = ['line 1 - text', 'line 2 - text', 'line 3 - text'];
            const start = { line: 1, column: 6 };
            const end = { line: 2, column: 3 };
            const location = lineColToLocation(start, end, source);
            expect(location).toEqual({ start: 6, end: 16 });
        });
    });

    describe('getChildren', () => {
        it('should return child nodes for a given Svelte AST node', () => {
            const node = {
                type: 'Fragment',
                children: [
                    { type: 'Text', data: 'Hello' },
                    { type: 'Element', name: 'div' },
                ],
            };
            const children = getChildren(node, 4);
            expect(children).toEqual(node.children);
            expect(children).not.toBe(node.children); // Ensure it's a copy
        });

        it('should return (a copy of) the .nodes property if version is 5', () => {
            const node = {
                type: 'Fragment',
                nodes: [
                    { type: 'Text', data: 'Hello', start: 1, end: 2 },
                    { type: 'Element', name: 'div', start: 3, end: 4 },
                ],
            };
            const children = getChildren(node, 5);
            expect(children).toEqual(node.nodes);
            expect(children).not.toBe(node.nodes); // Ensure it's a copy
        });

        it('AwaitBlock', () => {
            const node = {
                type: 'Fragment',
                nodes: [
                    { type: 'AwaitBlock', data: 'Hello', start: 1, end: 2 },
                    { type: 'Element', name: 'div', start: 3, end: 4 },
                ],
            };
            const children = getChildren(node, 5);
            expect(children).toEqual(node.nodes);
            expect(children).not.toBe(node.nodes); // Ensure it's a copy
        });
    });

    describe('walk', () => {
        it('should perform an action on each node in the AST', () => {
            const node = {
                type: 'Fragment',
                children: [{ type: 'Text', data: 'Hello' }],
            };
            const walkedNodes: { node: unknown; depth: number }[] = [];
            const mockAction = vi.fn((node: unknown, depth: number) =>
                walkedNodes.push({ node, depth }),
            );
            walk(node, mockAction);

            expect(mockAction).toHaveBeenCalledTimes(2); // Once for Fragment, once for Text
            expect(walkedNodes).toHaveLength(2);
            expect(walkedNodes).toEqual([
                {
                    depth: 0,
                    node: {
                        children: [
                            {
                                data: 'Hello',
                                type: 'Text',
                            },
                        ],
                        type: 'Fragment',
                    },
                },
                {
                    depth: 1,
                    node: {
                        data: 'Hello',
                        type: 'Text',
                    },
                },
            ]);
        });
    });

    describe('stringifyAst', () => {
        it('should return a string representation of the Svelte AST', () => {
            const ast = {
                type: 'Fragment',
                children: [{ type: 'Text', data: 'Hello, world!' }],
            };
            const result = stringifyAst(ast);
            expect(result).toBe('Fragment\n  Text (Hello, world!)');
        });

        it('should abridge long data', () => {
            const ast = {
                type: 'Fragment',
                children: [
                    { type: 'Text', data: '123456789012345678901234567890' },
                ],
            };
            const result = stringifyAst(ast);
            expect(result).toBe('Fragment\n  Text (12345678901234567890[...])');
        });

        it('should accept non-string data (and print "[data]" to represent it)', () => {
            const ast = {
                type: 'Fragment',
                children: [{ type: 'Text', data: {} }],
            };
            const result = stringifyAst(ast);
            expect(result).toBe('Fragment\n  Text ([data])');
        });

        it("should show a node's name, if there is one", () => {
            const ast = {
                type: 'Fragment',
                name: 'test',
                children: [{ type: 'Text', data: {} }],
            };
            const result = stringifyAst(ast);
            expect(result).toBe('Fragment (test)\n  Text ([data])');
        });

        it("should prioritize a node's name over the data it contains", () => {
            expect(
                stringifyAst({
                    type: 'Fragment',
                    children: [{ type: 'Text', name: 'test', data: {} }],
                }),
            ).toBe('Fragment\n  Text (test)');
            expect(
                stringifyAst({
                    type: 'Fragment',
                    children: [{ type: 'Text', name: 'test', data: 'data' }],
                }),
            ).toBe('Fragment\n  Text (test)');
        });
    });

    describe('parse', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should parse Svelte content into an AST (v4)', () => {
            const content =
                '<div>Hello, world!</div>\n{#if true}Hello, world!{/if}';
            const ast = parse(content);
            expect(ast).toEqual({
                children: [
                    {
                        attributes: [],
                        children: [
                            {
                                data: 'Hello, world!',
                                end: 18,
                                raw: 'Hello, world!',
                                start: 5,
                                type: 'Text',
                            },
                        ],
                        end: 24,
                        name: 'div',
                        start: 0,
                        type: 'Element',
                    },
                    {
                        data: '\n',
                        end: 25,
                        raw: '\n',
                        start: 24,
                        type: 'Text',
                    },
                    {
                        children: [
                            {
                                data: 'Hello, world!',
                                end: 48,
                                raw: 'Hello, world!',
                                start: 35,
                                type: 'Text',
                            },
                        ],
                        end: 53,
                        expression: {
                            end: 34,
                            loc: {
                                end: {
                                    column: 9,
                                    line: 2,
                                },
                                start: {
                                    column: 5,
                                    line: 2,
                                },
                            },
                            raw: 'true',
                            start: 30,
                            type: 'Literal',
                            value: true,
                        },
                        start: 25,
                        type: 'IfBlock',
                    },
                ],
                end: 53,
                start: 0,
                type: 'Fragment',
            });
        });

        it('should parse Svelte content into an AST (v6)', () => {
            vi.mock('$utils/env.js', async (importOriginal) => {
                const actual = await importOriginal();
                if (typeof actual !== 'object') {
                    throw new Error('test error');
                }
                return {
                    ...actual,
                    SVELTE_MAJOR_VERSION: 6,
                };
            });
            const content =
                '<div>Hello, world!</div>\n{#if true}Hello, world!{/if}';
            const ast = parse(content);
            expect(ast).toBeDefined(); // We currently have Svelte 4 installed, so we can't generate the actual v5 AST (more precisely, even though we're mocking the version, the actual AST will be the same as from the v4 test)
            vi.unmock('$utils/env.js');
        });

        it('should parse Svelte content into an AST (v100)', () => {
            vi.mock(
                'svelte/compiler',
                async (importOriginal: () => Promise<object>) => {
                    return {
                        ...(await importOriginal()),
                        VERSION: '100.0.0',
                    };
                },
            );
            const content =
                '<div>Hello, world!</div>\n{#if true}Hello, world!{/if}';
            const ast = parse(content);
            expect(ast).toBeDefined();
            vi.unmock('svelte/compiler');
        });
    });
});
