import { Sveltex, sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { mockFs } from '$dev_deps.js';
import { Processed } from 'svelte/compiler';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    suite,
    vi,
} from 'vitest';

suite('Sveltex', async () => {
    // const { log, spawnCliInstruction, writeFile } =
    await spy(
        ['fancyWrite', 'spawnCliInstruction', 'log', 'mkdir', 'existsSync'],
        true,
    );

    let sp: Sveltex<'none', 'highlight.js', 'mathjax', 'local'>;

    beforeAll(async () => {
        sp = await sveltex({
            markdownBackend: 'none',
            codeBackend: 'highlight.js',
            texBackend: 'mathjax',
            advancedTexBackend: 'local',
        });
        await sp.configure({
            advancedTex: {
                components: {
                    tex: { aliases: ['TeX'] },
                },
            },
            tex: {
                css: {
                    type: 'self-hosted',
                },
            },
            code: {
                theme: {
                    type: 'self-hosted',
                },
            },
        });
        mockFs({});
    });
    afterAll(() => {
        mockFs.restore();
        vi.restoreAllMocks();
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Sveltex.script', () => {
        it('should noop if no filename was provided', () => {
            const scriptOut = sp.script({
                content: '',
                attributes: {},
                markup: '',
            });
            expect(scriptOut).toEqual(undefined);
        });
        it('should noop if no filename with non-sveltex extension was provided', () => {
            const scriptOut = sp.script({
                content: '',
                attributes: {},
                markup: '',
                filename: 'test.svelte',
            });
            expect(scriptOut).toEqual(undefined);
        });
    });

    describe('Sveltex.markup + Sveltex.script', () => {
        it('works (basic)', async () => {
            const markupOut = await sp.markup({
                content: '<tex ref="something">x</tex> `code` $x$',
                filename: '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<script>\n</script>\n<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure> <code class="language-plaintext">code</code>',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents[
                    '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex'
                ]?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: '<tex ref="something">x</tex> `code`',
                filename: '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Sveltex__tex__something from '/src/sveltex/tex/something.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\nimport '/src/sveltex/highlight.js@11.9.0.default.min.css';\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (no tex components)', async () => {
            const markupOut = await sp.markup({
                content: 'something',
                filename: '7a541239-3058-460b-b3c6-5076a2f3f73b.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\nsomething',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(0);
            expect(
                sp.advancedTexHandler.texComponents[
                    '7a541239-3058-460b-b3c6-5076a2f3f73b.sveltex'
                ],
            ).toBeUndefined();

            expect(
                (
                    await sp.script({
                        content: '',
                        attributes: {},
                        markup: 'something',
                        filename:
                            '7a541239-3058-460b-b3c6-5076a2f3f73b.sveltex',
                    })
                )?.code,
            ).not.toContain('Sveltex__');
            sp.advancedTexHandler.texComponents = {};
        });

        it('works', async () => {
            const markupOut = await sp.markup({
                content:
                    '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>`code`$x$',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_as_valueless_attribute} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure><code class="language-plaintext">code</code><mjx-container class="MathJax" jax="SVG">',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents[
                    '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex'
                ]?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>`code`$x$',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Sveltex__tex__ref_as_valueless_attribute from '/src/sveltex/tex/ref-as-valueless-attribute.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\nimport '/src/sveltex/highlight.js@11.9.0.default.min.css';\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (coffeescript)', async () => {
            const markupOut = await sp.markup({
                content:
                    '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>`code`$x$',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_as_valueless_attribute} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents[
                    '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex'
                ]?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: { lang: 'coffeescript' },
                markup: '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\n```\nimport Sveltex__tex__ref_as_valueless_attribute from '/src/sveltex/tex/ref-as-valueless-attribute.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\nimport '/src/sveltex/highlight.js@11.9.0.default.min.css';\n```\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });
    });
});
