import { suite, describe, it, expect, vi } from 'vitest';
import {
    shouldParseAsInline,
    markdownBlockRegex,
    MarkdownHandler,
    createMarkdownHandler,
} from '$handlers';
import { missingDeps } from '$src/globals/index.js';

suite('MarkdownHandler', () => {
    describe('backendIs()', () => {
        it('should work', async () => {
            const handler = await createMarkdownHandler('none');
            expect(handler.backendIs('none')).toBe(true);
            expect(handler.backendIs('custom')).toBe(false);
            expect(handler.backendIs('markdown-it')).toBe(false);
            expect(handler.backendIs('marked')).toBe(false);
            expect(handler.backendIs('micromark')).toBe(false);
            expect(handler.backendIs('unified')).toBe(false);
        });
    });

    describe('shouldParseAsInline()', () => {
        it('should return true for inline markdown', () => {
            expect(shouldParseAsInline('**strong** *em*')).toBe(true);
        });

        it('should return false for block markdown', () => {
            expect(shouldParseAsInline('a\n\nb')).toBe(false);
        });
    });

    describe('markdownBlockRegex', () => {
        it('should match multiple newlines', () => {
            const input = '\n\n';
            expect(markdownBlockRegex.test(input)).toBe(true);
        });

        it('should match headings', () => {
            const input = '# Heading';
            expect(markdownBlockRegex.test(input)).toBe(true);
        });

        it('should match setext heading', () => {
            const input = 'Heading\n---';
            expect(markdownBlockRegex.test(input)).toBe(true);
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
    describe("createMarkdownHandler('marked') with marked mocked to throw error", () => {
        vi.mock('marked', () => {
            throw new Error('marked not found');
        });
        it('pushes "marked" to missingDeps and then throws error', async () => {
            await expect(() =>
                createMarkdownHandler('marked'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('marked');
        });
    });

    describe("createMarkdownHandler('markdown-it') with markdown-it mocked to throw error", () => {
        vi.mock('markdown-it', () => {
            throw new Error('markdown-it not found');
        });
        it('pushes "markdown-it" to missingDeps and then throws error', async () => {
            await expect(() =>
                createMarkdownHandler('markdown-it'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('markdown-it');
        });
    });

    describe("createMarkdownHandler('micromark') with micromark mocked to throw error", () => {
        vi.mock('micromark', () => {
            throw new Error('micromark not found');
        });
        it('pushes "micromark" to missingDeps and then throws error', async () => {
            await expect(() =>
                createMarkdownHandler('micromark'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('micromark');
        });
    });

    describe("createMarkdownHandler('unified') with unified mocked to throw error", () => {
        vi.mock('unified', () => {
            throw new Error('unified not found');
        });
        it('pushes "unified" to missingDeps and then throws error', async () => {
            await expect(() =>
                createMarkdownHandler('unified'),
            ).rejects.toThrowError();
            expect(missingDeps).toContain('unified');
        });
    });

    describe("createMarkdownHandler('custom')", () => {
        it('throws error if second parameter is missing', async () => {
            await expect(() =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                createMarkdownHandler('custom', undefined!),
            ).rejects.toThrowError(
                'Called createMarkdownHandler("custom", custom) without a second parameter.',
            );
        });

        it("should set `configure` to noop by default if backend is 'custom'", async () => {
            const handler = await createMarkdownHandler('custom', {
                process: () => 'output',
            });
            expect(handler.configure).toBeTypeOf('function');
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(await handler.configure({})).toBeUndefined();
        });
    });
});
