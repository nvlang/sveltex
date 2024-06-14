import { describe, it, expect, vi } from 'vitest';
import { MarkdownHandler, countNewlines } from '$handlers/MarkdownHandler.js';
import { missingDeps } from '$utils/env.js';
import { getDefaultMarkdownConfig } from '$config/defaults.js';
import { markdownBackends } from '$utils/diagnosers/backendChoices.js';
import { fc, fuzzyTest } from '$dev_deps.js';

describe('MarkdownHandler', () => {
    describe('constructor', () => {
        it('should have optional configuration property in parameter', () => {
            const handler1 = new MarkdownHandler({
                backend: 'custom',
                processor: {},
                process: () => '',
                configure: () => undefined,
                configuration: getDefaultMarkdownConfig('custom'),
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { prefersInline, ...expected } =
                getDefaultMarkdownConfig('custom');
            expect(handler1.configuration).toMatchObject(expected);

            const handler2 = new MarkdownHandler({
                backend: 'custom',
                processor: {},
                process: () => '',
                configure: () => undefined,
                configuration: getDefaultMarkdownConfig('custom'),
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

describe('countNewlines()', () => {
    it.each([
        ['', 0],
        ['\n', 1],
        ['\n\n', 2],
        ['1\n2', 1],
        ['\n1\n', 2],
        ['1\n', 1],
        ['\n1', 1],
        ['', 0],
        ['\r', 1],
        ['\r\r', 2],
        ['1\r2', 1],
        ['\r1\r', 2],
        ['1\r', 1],
        ['\r1', 1],
        ['', 0],
        ['\r\n', 1],
        ['\r\n\r\n', 2],
        ['1\r\n2', 1],
        ['\r\n1\r\n', 2],
        ['1\r\n', 1],
        ['\r\n1', 1],
    ])('%o → %o', (input, expected) => {
        expect(countNewlines(input)).toEqual(expected);
    });
});

describe('prefersInline is () => true by default', () => {
    describe.each(markdownBackends)('%s', (backend) => {
        fuzzyTest.prop([fc.string()])('arbitrary input string', (input) => {
            expect(getDefaultMarkdownConfig(backend).prefersInline(input)).toBe(
                true,
            );
        });
    });
});
