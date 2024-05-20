import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TexHandler } from '$handlers/TexHandler.js';
import { missingDeps } from '$utils/env.js';

describe("TexHandler<'none'>", () => {
    let handler: TexHandler<'none'>;
    beforeAll(async () => {
        handler = await TexHandler.create('none');
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

describe("TexHandler<'custom'>", () => {
    let handler: TexHandler<'custom'>;
    beforeAll(async () => {
        handler = await TexHandler.create('custom', {
            process: (input: string) => input,
        });
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

describe('TexHandler error handling', () => {
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
