import { describe, it, expect, beforeAll, test } from 'vitest';
import { MathHandler } from '../../../../src/handlers/MathHandler.js';
import { mathBackends } from '../../../../src/utils/diagnosers/backendChoices.js';

describe("MathHandler<'none'>", () => {
    let handler: MathHandler<'none'>;
    beforeAll(async () => {
        handler = await MathHandler.create('none');
    });

    describe('.create', () => {
        test.each(mathBackends)(
            'works without config (%s)',
            async (backend) => {
                const mathHandler = await MathHandler.create(backend);
                expect(mathHandler).toBeTypeOf('object');
                expect(mathHandler).not.toBeNull();
                expect(mathHandler).toBeInstanceOf(MathHandler);
            },
        );
    });

    describe("MathHandler<'none'>", () => {
        describe('process()', () => {
            test('should work, and output the an empty string', async () => {
                handler = await MathHandler.create('none');
                expect((await handler.process('x')).processed).toEqual('');
            });
        });
    });
});

describe("MathHandler<'custom'>", () => {
    describe("MathHandler.create('custom', ...)", () => {
        it('returns instance of MathHandler', async () => {
            const handler = await MathHandler.create('custom', {
                process: (input: string) => input,
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
        });

        it('accepts optional processor and configuration properties', async () => {
            const handler = await MathHandler.create('custom', {
                process: (input: string) => input,
            });
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(MathHandler);
            expect(handler.configuration).toMatchObject({
                transformers: { pre: [], post: [] },
            });
        });

        it("updateCss() can be called (even though it's a no-op", async () => {
            const handler = await MathHandler.create('custom', {
                process: (input: string) => input,
            });
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            expect(handler.updateCss()).toBeUndefined();
        });
    });

    describe('mathHandler', () => {
        describe('process()', () => {
            it('should work, and output the input as-is', async () => {
                const handler = await MathHandler.create('custom');
                expect((await handler.process('x')).processed).toEqual('x');
            });
        });
    });
});
