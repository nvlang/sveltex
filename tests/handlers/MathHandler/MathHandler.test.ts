import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MathHandler } from '$handlers/MathHandler.js';
import { missingDeps } from '$utils/env.js';

describe("MathHandler<'none'>", () => {
    let handler: MathHandler<'none'>;
    beforeAll(async () => {
        handler = await MathHandler.create('none');
    });

    beforeAll(async () => {
        vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default);
    });
    describe("MathHandler.create('none')", () => {
        it('returns instance of MathHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
        });
    });

    describe('mathHandler', () => {
        describe('process()', () => {
            it('should work, and output the input as-is', async () => {
                expect((await handler.process('x')).processed).toEqual('x');
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
    });
});

describe("MathHandler<'custom'>", () => {
    let handler: MathHandler<'custom'>;
    beforeAll(async () => {
        handler = await MathHandler.create('custom', {
            process: (input: string) => input,
        });
    });
    describe("MathHandler.create('custom', ...)", () => {
        it('returns instance of MathHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await MathHandler.create('custom', {
                process: (input: string) => input,
                processor: {},
                configure: () => {
                    return;
                },
                configuration: { test: 'a' },
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
            expect(handler.processor).toEqual({});
            expect(handler.configuration).toMatchObject({
                test: 'a',
                transformers: { pre: [], post: [] },
            });
        });
    });

    describe('mathHandler', () => {
        describe('process()', () => {
            it('should work, and output the input as-is', async () => {
                expect((await handler.process('x')).processed).toEqual('x');
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
    });
});

describe('MathHandler error handling', () => {
    describe("MathHandler.create('mathjax') with mathjax mocked to throw error", () => {
        vi.mock('mathjax-full/js/handlers/html.js', () => {
            throw new Error('MathJax not found');
        });
        it('pushes "mathjax" to missingDeps and then throws error', async () => {
            await expect(() =>
                MathHandler.create('mathjax'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('mathjax-full');
        });
    });

    describe("MathHandler.create('katex') with katex mocked to throw error", () => {
        vi.mock('katex', () => {
            throw new Error('KaTeX not found');
        });
        it('pushes "katex" to missingDeps and then throws error', async () => {
            await expect(() =>
                MathHandler.create('katex'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('katex');
        });
    });

    describe("MathHandler.create('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                MathHandler.create('custom', undefined!),
            ).rejects.toThrowError(
                'Called MathHandler.create("custom", custom) without a second parameter.',
            );
        });
    });
});
