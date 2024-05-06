import { suite, describe, it, expect, vi } from 'vitest';
import { CodeHandler } from '$handlers';
import { missingDeps } from '$utils/globals.js';
import { getDefaultCodeConfiguration } from '$config/defaults.js';
import { consoles } from '$utils/debug.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

suite("CodeHandler<'custom'>", async () => {
    const handler = await CodeHandler.create('custom', {
        process: (input: string) => input,
    });
    describe("CodeHandler.create('custom', ...)", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await CodeHandler.create('custom', {
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
            expect(handler.configuration.wrapClassPrefix).toEqual(
                getDefaultCodeConfiguration('custom').wrapClassPrefix,
            );
        });
    });

    describe('codeHandler', () => {
        describe('process()', () => {
            it('should work', async () => {
                expect(await handler.process('x', {})).toEqual(
                    '<pre><code>\nx\n</code></pre>',
                );
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
    describe("CodeHandler.create('highlight.js') with highlight.js mocked to throw error", () => {
        vi.mock('highlight.js', () => {
            throw new Error('highlight.js not found');
        });
        it('pushes "highlight.js" to missingDeps and then throws error', async () => {
            await expect(() =>
                CodeHandler.create('highlight.js'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('highlight.js');
        });
    });

    describe("CodeHandler.create('starry-night') with starry-night mocked to throw error", () => {
        vi.mock('@wooorm/starry-night', () => {
            throw new Error('Starry night not found');
        });
        it('pushes "starry-night" to missingDeps and then throws error', async () => {
            await expect(() =>
                CodeHandler.create('starry-night'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('@wooorm/starry-night');
            expect(missingDeps).toContain('hast-util-find-and-replace');
            expect(missingDeps).toContain('hast-util-to-html');
        });
    });

    describe("CodeHandler.create('prismjs') with prismjs mocked to throw error", () => {
        vi.mock('prismjs', () => {
            throw new Error('PrismJS not found');
        });
        it('pushes "prismjs" to missingDeps and then throws error', async () => {
            await expect(() =>
                CodeHandler.create('prismjs'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('prismjs');
        });
    });

    describe("CodeHandler.create('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                CodeHandler.create('custom', undefined!),
            ).rejects.toThrowError(
                'Called CodeHandler.create("custom", custom) without a second parameter.',
            );
        });
    });

    describe("CodeHandler.create('unsupported')", () => {
        it('throws error', async () => {
            await expect(() =>
                CodeHandler.create('unsupported' as 'none'),
            ).rejects.toThrowError();
        });
    });
});
