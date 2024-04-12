import { suite, describe, it, expect, vi } from 'vitest';
import { TexHandler, createTexHandler } from '$handlers';
import { missingDeps } from '$src/globals/index.js';

suite("TexHandler<'none'>", async () => {
    const handler = await createTexHandler('none');
    describe("createTexHandler('none')", () => {
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });
    });

    describe('texHandler', () => {
        describe('process()', () => {
            it('should work, and output the input as-is', async () => {
                expect(await handler.process('x')).toEqual('x');
            });
        });

        describe('processor', () => {
            it('should equal {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });
        });

        describe('backendIs()', () => {
            it('should work', () => {
                expect(handler.backendIs('none')).toBe(true);
                expect(handler.backendIs('katex')).toBe(false);
                expect(handler.backendIs('mathjax-node')).toBe(false);
                expect(handler.backendIs('mathjax-full')).toBe(false);
                expect(handler.backendIs('custom')).toBe(false);
            });
        });
    });
});

suite("TexHandler<'custom'>", async () => {
    const handler = await createTexHandler('custom', {
        process: (input: string) => input,
    });
    describe("createTexHandler('custom', ...)", () => {
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await createTexHandler('custom', {
                process: (input: string) => input,
                processor: {},
                configure: () => {
                    return;
                },
                configuration: {},
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
            expect(handler.processor).toEqual({});
            expect(handler.configuration).toEqual({});
        });
    });

    describe('texHandler', () => {
        describe('process()', () => {
            it('should work, and output the input as-is', async () => {
                expect(await handler.process('x')).toEqual('x');
            });

            it('should work strip math delims', async () => {
                expect(await handler.process('$x$')).toEqual('x');
                expect(await handler.process('\\(x\\)')).toEqual('x');
                expect(await handler.process('$$x$$')).toEqual('x');
                expect(await handler.process('\\[x\\]')).toEqual('x');
            });
        });

        describe('processor', () => {
            it('should equal {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configure()', () => {
            it('is a function', async () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
                // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                expect(await handler.configure({})).toBeUndefined();
            });
        });

        describe('backendIs()', () => {
            it('should work', () => {
                expect(handler.backendIs('none')).toBe(false);
                expect(handler.backendIs('katex')).toBe(false);
                expect(handler.backendIs('mathjax-node')).toBe(false);
                expect(handler.backendIs('mathjax-full')).toBe(false);
                expect(handler.backendIs('custom')).toBe(true);
            });
        });
    });
});

suite('TexHandler error handling', () => {
    describe("createTexHandler('mathjax-full') with mathjax-full mocked to throw error", () => {
        vi.mock('mathjax-full/js/handlers/html.js', () => {
            throw new Error('MathJax not found');
        });
        it('pushes "mathjax-full" to missingDeps and then throws error', async () => {
            await expect(() =>
                createTexHandler('mathjax-full'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('mathjax-full');
        });
    });

    describe("createTexHandler('mathjax-node') with mathjax-node mocked to throw error", () => {
        vi.mock('mathjax-node', () => {
            throw new Error('MathJax not found');
        });
        it('pushes "mathjax-node" to missingDeps and then throws error', async () => {
            await expect(() =>
                createTexHandler('mathjax-node'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('mathjax-node');
        });
    });

    describe("createTexHandler('katex') with katex mocked to throw error", () => {
        vi.mock('katex', () => {
            throw new Error('KaTeX not found');
        });
        it('pushes "katex" to missingDeps and then throws error', async () => {
            await expect(() =>
                createTexHandler('katex'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('katex');
        });
    });

    describe("createTexHandler('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                createTexHandler('custom', undefined!),
            ).rejects.toThrowError(
                'Called createTexHandler("custom", custom) without a second parameter.',
            );
        });
    });
});
