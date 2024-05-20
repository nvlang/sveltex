import { describe, it, expect, vi, beforeAll } from 'vitest';

import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

describe("CodeHandler<'escapeOnly'>", () => {
    let handler: CodeHandler<'escapeOnly'>;
    beforeAll(async () => {
        handler = await CodeHandler.create('escapeOnly');
    });

    describe("CodeHandler.create('escapeOnly')", () => {
        it('returns instance of CodeHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(CodeHandler);
        });
    });

    describe('codeHandler', () => {
        describe('process()', () => {
            it('is a function', () => {
                expect(handler.process).toBeTypeOf('function');
                expect(handler.process).not.toBeNull();
            });

            it('escapes `{`, `}`, `<`, and `>` in plain code correctly', async () => {
                const output = (
                    await handler.process('a <b> {c}', {
                        lang: 'plaintext',
                    })
                ).processed;
                const expected =
                    '<pre><code class="language-plaintext">a &lt;b&gt; &lbrace;c&rbrace;\n</code></pre>';
                expect(output).toEqual(expected);
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('returns void/undefined', async () => {
                // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                expect(await handler.configure({})).toBeUndefined();
            });

            it('correctly configures handler', async () => {
                await handler.configure({ escapeBraces: false });
                expect(handler.configuration.escapeBraces).toEqual(false);
                await handler.configure({ escapeBraces: true });
                expect(handler.configuration.escapeBraces).toEqual(true);
            });
        });

        describe('processor', () => {
            it('equals {}', () => {
                expect(handler.processor).toEqual({});
            });
        });

        describe('configuration', () => {
            it('is a property', () => {
                expect('configuration' in handler).toBe(true);
            });

            it('is defined', () => {
                expect(handler.configuration).toBeDefined();
            });
        });
    });

    describe('backend', () => {
        it("is 'escapeOnly'", () => {
            expect(handler.backend).toBe('escapeOnly');
        });
    });
});
