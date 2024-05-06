/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, vi } from 'vitest';
import { TexHandler } from '$handlers';
import { consoles } from '$utils/debug.js';

suite("TexHandler<'mathjax-node'>", async () => {
    const handler = await TexHandler.create('mathjax-node');
    describe("TexHandler.create('mathjax-node')", () => {
        it('returns instance of TexHandler', () => {
            expect(handler).toBeTypeOf('object');
            expect(handler).not.toBeNull();
            expect(handler).toBeInstanceOf(TexHandler);
        });
    });

    describe('texHandler', () => {
        const expected = {
            html: {
                inline: '<span class="mjx-chtml"><span class="mjx-math" aria-label="x"><span class="mjx-mrow" aria-hidden="true"><span class="mjx-mi"><span class="mjx-char MJXc-TeX-math-I" style="padding-top: 0.225em; padding-bottom: 0.298em;">x</span></span></span></span></span>',
                display:
                    '<span class="mjx-chtml MJXc-display" style="text-align: center;"><span class="mjx-math" aria-label="x"><span class="mjx-mrow" aria-hidden="true"><span class="mjx-mi"><span class="mjx-char MJXc-TeX-math-I" style="padding-top: 0.225em; padding-bottom: 0.298em;">x</span></span></span></span></span>',
            },
            svg: {
                inline: '<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="1.33ex" height="1.676ex" style="vertical-align: -0.338ex;" viewBox="0 -576.1 572.5 721.6" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg" aria-labelledby="MathJax-SVG-1-Title">\n<title id="MathJax-SVG-1-Title">x</title>\n<defs aria-hidden="true">\n<path stroke-width="1" id="E1-MJMATHI-78" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path>\n</defs>\n<g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)" aria-hidden="true">\n <use xlink:href="#E1-MJMATHI-78" x="0" y="0"></use>\n</g>\n</svg>',
                display:
                    '<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="1.33ex" height="1.676ex" style="vertical-align: -0.338ex;" viewBox="0 -576.1 572.5 721.6" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg" aria-labelledby="MathJax-SVG-1-Title">\n<title id="MathJax-SVG-1-Title">x</title>\n<defs aria-hidden="true">\n<path stroke-width="1" id="E1-MJMATHI-78" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path>\n</defs>\n<g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)" aria-hidden="true">\n <use xlink:href="#E1-MJMATHI-78" x="0" y="0"></use>\n</g>\n</svg>',
            },
            mml: {
                inline: '<math xmlns="http://www.w3.org/1998/Math/MathML" alttext="x">\n  <mi>x</mi>\n</math>',
                display:
                    '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" alttext="x">\n  <mi>x</mi>\n</math>',
            },
            none: {
                inline: '',
                display: '',
            },
        };
        const cases: { input: string; mode: 'inline' | 'display' }[] = [
            { input: 'x', mode: 'inline' },
            { input: '$x$', mode: 'inline' },
            { input: '$$x$$', mode: 'display' },
            { input: '\\(x\\)', mode: 'inline' },
            { input: '\\[x\\]', mode: 'display' },
        ];
        describe.each(cases)('process()', ({ input, mode }) => {
            it('should work, and output CHTML by default', async () => {
                const handler = await TexHandler.create('mathjax-node');
                expect(await handler.process(input)).toEqual(
                    expected.html[mode],
                );
            });

            it.each([{ svg: true }, { mml: true }, { html: true }, {}])(
                `should work with $mode $opts`,
                async (opts) => {
                    let expectedFormat: 'svg' | 'mml' | 'html' | 'none' =
                        'none';
                    if (opts.mml) expectedFormat = 'mml';
                    if (opts.svg) expectedFormat = 'svg';
                    if (opts.html) expectedFormat = 'html';
                    await handler.configure({
                        inputConfiguration: {
                            html: false,
                            svg: false,
                            mml: false,
                            htmlNode: false,
                            svgNode: false,
                            mmlNode: false,
                            ...opts,
                        },
                    });
                    expect(
                        await handler.process(input, {
                            inputConfiguration: opts,
                        }),
                    ).toEqual(expected[expectedFormat][mode]);
                },
            );

            it('should deal with errors gracefully', async () => {
                const consoleErrorMock = vi
                    .spyOn(consoles, 'error')
                    .mockImplementation(() => undefined);
                vi.doMock('mathjax-node', (): typeof import('mathjax-node') => {
                    return {
                        typeset: vi
                            .fn()
                            .mockImplementation(() =>
                                Promise.resolve({ errors: ['something'] }),
                            ),
                        start: vi
                            .fn()
                            .mockImplementation(() => Promise.resolve()),
                        config: vi
                            .fn()
                            .mockImplementation(() => Promise.resolve()),
                    };
                });
                const handler = await TexHandler.create('mathjax-node');
                expect(await handler.process(input)).toEqual('');
                expect(consoleErrorMock).toHaveBeenCalledTimes(1);
                expect(consoleErrorMock).toHaveBeenNthCalledWith(
                    1,
                    expect.stringContaining('Errors: '),
                    ['something'],
                );
                vi.doUnmock('mathjax-node');
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

            it('configures code correctly', async () => {
                await handler.configure({
                    inputConfiguration: { html: false, svg: true },
                });
                expect(await handler.process('x')).toEqual(
                    '<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="1.33ex" height="1.676ex" style="vertical-align: -0.338ex;" viewBox="0 -576.1 572.5 721.6" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg" aria-labelledby="MathJax-SVG-1-Title">\n<title id="MathJax-SVG-1-Title">x</title>\n<defs aria-hidden="true">\n<path stroke-width="1" id="E1-MJMATHI-78" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path>\n</defs>\n<g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)" aria-hidden="true">\n <use xlink:href="#E1-MJMATHI-78" x="0" y="0"></use>\n</g>\n</svg>',
                );
            });

            it('should correctly configure mathjaxNodeConfig', async () => {
                await handler.configure({
                    mathjaxNodeConfiguration: { displayErrors: false },
                });
                expect(
                    handler.configuration.mathjaxNodeConfiguration
                        .displayErrors,
                ).toEqual(false);
                await handler.configure({
                    mathjaxNodeConfiguration: { displayErrors: true },
                });
                expect(
                    handler.configuration.mathjaxNodeConfiguration
                        .displayErrors,
                ).toEqual(true);
            });

            // it('can add new languages', () => {
            //     handler.configure({ languages: [] });
            //     expect(await handler.process('let a', { lang: 'js' })).toEqual(
            //         'let a',
            //     );
            //     handler.configure({ languages: ['js'] });
            //     expect(await handler.process('let a', { lang: 'js' })).toEqual(
            //         '<span class="hljs-keyword">let</span> a',
            //     );
            // });
        });
    });
});
