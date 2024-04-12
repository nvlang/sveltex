import { suite, describe, it, expect, vi } from 'vitest';
import { CodeHandler, createCodeHandler } from '$handlers';
import { missingDeps } from '$src/globals/index.js';
import { defaultCodeConfiguration } from '$src/config/defaults.js';

vi.spyOn(console, 'error').mockImplementation(() => undefined);

suite("CodeHandler<'custom'>", async () => {
    const handler = await createCodeHandler('custom', {
        process: (input: string) => input,
    });
    describe("createCodeHandler('custom', ...)", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await createCodeHandler('custom', {
                process: (input: string) => input,
                processor: {},
                configure: () => {
                    return;
                },
                configuration: undefined,
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
            expect(handler.processor).toEqual({});
            expect(handler.configuration).toEqual(defaultCodeConfiguration);
        });
    });

    describe('codeHandler', () => {
        describe('process()', () => {
            it('should work', async () => {
                expect(await handler.process('x')).toEqual('x');
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
                expect(handler.backendIs('escapeOnly')).toBe(false);
                expect(handler.backendIs('highlight.js')).toBe(false);
                expect(handler.backendIs('prismjs')).toBe(false);
                expect(handler.backendIs('starry-night')).toBe(false);
                expect(handler.backendIs('custom')).toBe(true);
            });
        });
    });
});

suite('CodeHandler error handling', () => {
    describe("createCodeHandler('highlight.js') with highlight.js mocked to throw error", () => {
        vi.mock('highlight.js', () => {
            throw new Error('highlight.js not found');
        });
        it('pushes "highlight.js" to missingDeps and then throws error', async () => {
            await expect(() =>
                createCodeHandler('highlight.js'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('highlight.js');
        });
    });

    describe("createCodeHandler('starry-night') with starry-night mocked to throw error", () => {
        vi.mock('@wooorm/starry-night', () => {
            throw new Error('Starry night not found');
        });
        it('pushes "starry-night" to missingDeps and then throws error', async () => {
            await expect(() =>
                createCodeHandler('starry-night'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('@wooorm/starry-night');
            expect(missingDeps).toContain('hast-util-find-and-replace');
            expect(missingDeps).toContain('hast-util-to-html');
        });
    });

    describe("createCodeHandler('prismjs') with prismjs mocked to throw error", () => {
        vi.mock('prismjs', () => {
            throw new Error('PrismJS not found');
        });
        it('pushes "prismjs" to missingDeps and then throws error', async () => {
            await expect(() =>
                createCodeHandler('prismjs'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('prismjs');
        });
    });

    describe("createCodeHandler('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                createCodeHandler('custom', undefined!),
            ).rejects.toThrowError(
                'Called createCodeHandler("custom", custom) without a second parameter.',
            );
        });
    });
});
