import { describe, it, expect, vi } from 'vitest';
import { MarkdownHandler } from '$handlers/MarkdownHandler.js';
import { missingDeps } from '$utils/env.js';

describe('MarkdownHandler', () => {
    describe('constructor', () => {
        it('should have optional configuration property in parameter', () => {
            const handler1 = new MarkdownHandler({
                backend: 'custom',
                processor: {},
                process: () => '',
                configure: () => {
                    return;
                },
                configuration: {},
            });
            expect(handler1.configuration).toEqual({});

            const handler2 = new MarkdownHandler({
                backend: 'custom',
                processor: {},
                process: () => '',
                configure: () => {
                    return;
                },
                configuration: {},
            });
            expect(handler2.configuration).toBeDefined();
        });

        it('should not be null', () => {
            expect(MarkdownHandler).not.toBeNull();
        });
    });
});

describe('MarkdownHandler error handling', () => {
    describe("MarkdownHandler.create('marked') with marked mocked to throw error", () => {
        vi.mock('marked', () => {
            throw new Error('marked not found');
        });
        it('pushes "marked" to missingDeps and then throws error', async () => {
            await expect(() =>
                MarkdownHandler.create('marked'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('marked');
        });
    });

    describe("MarkdownHandler.create('markdown-it') with markdown-it mocked to throw error", () => {
        vi.mock('markdown-it', () => {
            throw new Error('markdown-it not found');
        });
        it('pushes "markdown-it" to missingDeps and then throws error', async () => {
            await expect(() =>
                MarkdownHandler.create('markdown-it'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('markdown-it');
        });
    });

    describe("MarkdownHandler.create('micromark') with micromark mocked to throw error", () => {
        vi.mock('micromark', () => {
            throw new Error('micromark not found');
        });
        it('pushes "micromark" to missingDeps and then throws error', async () => {
            await expect(() =>
                MarkdownHandler.create('micromark'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('micromark');
        });
    });

    describe("MarkdownHandler.create('unified') with unified mocked to throw error", () => {
        vi.mock('unified', () => {
            throw new Error('unified not found');
        });
        it('pushes "unified" to missingDeps and then throws error', async () => {
            await expect(() =>
                MarkdownHandler.create('unified'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('unified');
        });
    });

    describe("MarkdownHandler.create('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                MarkdownHandler.create('custom', undefined!),
            ).rejects.toThrowError(
                'Called MarkdownHandler.create("custom", custom) without a second parameter.',
            );
        });

        it("should set `configure` to noop by default if backend is 'custom'", async () => {
            const handler = await MarkdownHandler.create('custom', {
                process: () => 'output',
            });
            expect(handler.configure).toBeTypeOf('function');
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(await handler.configure({})).toBeUndefined();
        });
    });

    describe("MarkdownHandler.create('unsupported')", () => {
        it('should throw error', async () => {
            await expect(() =>
                MarkdownHandler.create('unsupported' as 'none'),
            ).rejects.toThrowError();
        });
    });
});
