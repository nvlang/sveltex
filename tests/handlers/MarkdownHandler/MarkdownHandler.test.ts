import { suite, describe, it, expect, vi } from 'vitest';
import { MarkdownHandler } from '$handlers';
import { missingDeps } from '$utils/globals.js';

suite('MarkdownHandler', () => {
    describe('backendIs()', () => {
        it('should work', async () => {
            const handler = await MarkdownHandler.create('none');
            expect(handler.backendIs('none')).toBe(true);
            expect(handler.backendIs('custom')).toBe(false);
            expect(handler.backendIs('markdown-it')).toBe(false);
            expect(handler.backendIs('marked')).toBe(false);
            expect(handler.backendIs('micromark')).toBe(false);
            expect(handler.backendIs('unified')).toBe(false);
        });
    });

    describe('MarkdownHandler.shouldParseAsInline()', () => {
        it('should return true for inline markdown', () => {
            expect(MarkdownHandler.shouldParseAsInline('**strong** *em*')).toBe(
                true,
            );
        });

        it('should return false for block markdown', () => {
            expect(MarkdownHandler.shouldParseAsInline('a\n\nb')).toBe(false);
        });
    });

    describe('MarkdownHandler.markdownBlockRegex', () => {
        it('should match multiple newlines', () => {
            const input = '\n\n';
            expect(MarkdownHandler.markdownBlockRegex.test(input)).toBe(true);
        });

        it('should match headings', () => {
            const input = '# Heading';
            expect(MarkdownHandler.markdownBlockRegex.test(input)).toBe(true);
        });

        it('should match setext heading', () => {
            const input = 'Heading\n---';
            expect(MarkdownHandler.markdownBlockRegex.test(input)).toBe(true);
        });
    });

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

suite('MarkdownHandler error handling', () => {
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