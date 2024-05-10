import { suite, describe, it, expect, vi } from 'vitest';
import { TexHandler } from '$handlers';
import { missingDeps } from '$utils/globals.js';

suite("TexHandler<'none'>", async () => {
    const handler = await TexHandler.create('none');
    describe("TexHandler.create('none')", () => {
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
                expect(handler.backendIs('mathjax')).toBe(false);
                expect(handler.backendIs('custom')).toBe(false);
            });
        });
    });
});

suite("TexHandler<'custom'>", async () => {
    const handler = await TexHandler.create('custom', {
        process: (input: string) => input,
    });
    describe("TexHandler.create('custom', ...)", () => {
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await TexHandler.create('custom', {
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
                expect(handler.backendIs('mathjax')).toBe(false);
                expect(handler.backendIs('custom')).toBe(true);
            });
        });
    });
});

suite('TexHandler error handling', () => {
    describe("TexHandler.create('mathjax') with mathjax mocked to throw error", () => {
        vi.mock('mathjax-full/js/handlers/html.js', () => {
            throw new Error('MathJax not found');
        });
        it('pushes "mathjax" to missingDeps and then throws error', async () => {
            await expect(() =>
                TexHandler.create('mathjax'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('mathjax-full');
        });
    });

    describe("TexHandler.create('katex') with katex mocked to throw error", () => {
        vi.mock('katex', () => {
            throw new Error('KaTeX not found');
        });
        it('pushes "katex" to missingDeps and then throws error', async () => {
            await expect(() =>
                TexHandler.create('katex'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('katex');
        });
    });

    describe("TexHandler.create('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                TexHandler.create('custom', undefined!),
            ).rejects.toThrowError(
                'Called TexHandler.create("custom", custom) without a second parameter.',
            );
        });
    });
});
