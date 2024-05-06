/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect } from 'vitest';
import { TexHandler } from '$handlers';
import { MathDocument } from 'mathjax-full/js/core/MathDocument.js';

suite("TexHandler<'mathjax-full'>", async () => {
    const handler = await TexHandler.create('mathjax-full');

    describe("TexHandler.create('mathjax-full')", () => {
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });
    });

    describe('texHandler', () => {
        describe('process()', () => {
            it('should work, and output CHTML by default', async () => {
                expect(await handler.process('x')).toEqual(
                    '<mjx-math class=" MJX-TEX"><mjx-mi class="mjx-i"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi></mjx-math>',
                );
            });

            it('should be able to output SVG', async () => {
                await handler.configure({ outputFormat: 'svg' });
                expect(await handler.process('x')).toEqual(
                    '<svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-1-TEX-I-1D465"></use></g></g></g></svg>',
                );
                await handler.configure({ outputFormat: 'chtml' });
            });

            it('should throw error if MathJax did not return a valid node', async () => {
                const handler = await TexHandler.create('mathjax-full');
                handler.processor = {
                    convert: () => null,
                } as unknown as MathDocument<unknown, unknown, unknown>;
                await expect(
                    async () => await handler.process('abcde'),
                ).rejects.toThrowError(
                    'MathJax did not return a valid node (result: null).',
                );
            });
        });

        describe('processor', () => {
            it('is object', () => {
                expect(handler.processor).toBeTypeOf('object');
                expect(handler.processor).not.toBeNull();
            });
        });

        describe('configure()', () => {
            it('is a function', () => {
                expect(handler.configure).toBeTypeOf('function');
                expect(handler.configure).not.toBeNull();
            });

            it('configures code correctly', async () => {
                await handler.configure({ outputFormat: 'svg' });
                expect(await handler.process('x')).toEqual(
                    '<svg style="vertical-align: -0.025ex;" xmlns="http://www.w3.org/2000/svg" width="1.294ex" height="1.025ex" role="img" focusable="false" viewBox="0 -442 572 453" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="MJX-1-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path></defs><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-1-TEX-I-1D465"></use></g></g></g></svg>',
                );
            });

            it('works with some base cases', async () => {
                await handler.configure({ outputFormat: 'svg' });
                expect(handler.configuration.outputFormat).toEqual('svg');
                await handler.configure({ outputFormat: 'chtml' });
                expect(handler.configuration.outputFormat).toEqual('chtml');
                await handler.configure({});
                expect(handler.configuration.outputFormat).toEqual('chtml');
                await handler.configure({ outputFormat: undefined });
                expect(handler.configuration.outputFormat).toEqual('chtml');
            });
        });
    });
});
