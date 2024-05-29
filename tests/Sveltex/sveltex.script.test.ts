import { Sveltex, sveltex } from '$Sveltex.js';
import { spy } from '$tests/fixtures.js';
import { mockFs } from '$dev_deps.js';
import { Processed } from 'svelte/compiler';
import {
    MockInstance,
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

describe('Sveltex', () => {
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(
            ['fancyWrite', 'spawnCliInstruction', 'log', 'mkdir', 'existsSync'],
            true,
        );
        log = mocks.log;
    });

    let sp: Sveltex<'micromark', 'highlight.js', 'mathjax'>;

    beforeAll(async () => {
        sp = await sveltex({
            markdownBackend: 'micromark',
            codeBackend: 'highlight.js',
            texBackend: 'mathjax',
        });
        await sp.configure({
            tex: {
                css: {
                    type: 'hybrid',
                },
            },
            code: {
                theme: {
                    type: 'self-hosted',
                },
            },
            verbatim: {
                tex: { aliases: ['TeX'], type: 'advancedTex' },
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
                filename: 'baa575e4-2347-4575-abd9-3fff8fb22906.svelte',
            });
            expect(scriptOut).toEqual(undefined);
        });
    });

    describe('Sveltex.markup + Sveltex.script', () => {
        it('works (basic)', async () => {
            const markupOut = await sp.markup({
                content: '<tex ref="something">x</tex>\n`code`\n$x$',
                filename: '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<svelte:head>\n<link rel="stylesheet" href="/src/sveltex/mathjax@3.2.2.svg.min.css">\n</svelte:head>\n<script>\n</script>\n<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure>\n<p><code>code</code>\n<mjx-container class="MathJax"',
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
                "\nimport Sveltex__tex__something from '/src/sveltex/tex/something.svelte';\nimport '/src/sveltex/highlight.js@11.9.0.default.min.css';\n",
            );
            expect(log).toHaveBeenCalledTimes(1);

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (no tex components)', async () => {
            const markupOut = await sp.markup({
                content: 'something',
                filename: '7a541239-3058-460b-b3c6-5076a2f3f73b.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\n<p>something</p>',
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
            ).toBeUndefined();
            sp.advancedTexHandler.texComponents = {};
        });
        it('works', async () => {
            const markupOut = await sp.markup({
                content:
                    '---\nfoo: bar\ntitle: Example\nauthor: Jane Doe\n---\n*text*\n<tex ref=ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>\n`code`\n$x$',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });

            expect((markupOut as Processed).code).toContain(
                '<svelte:head>\n<title>Example</title>\n<meta name="author" content="Jane Doe">\n<link rel="stylesheet" href="/src/sveltex/mathjax@3.2.2.svg.min.css">\n</svelte:head>\n<script>\n</script>\n\n<p><em>text</em></p>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_without_quotation_marks} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>\n<p><code>code</code>\n<mjx-container class="MathJax" jax="SVG">',
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
                markup: '<tex ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>`code`$x$',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                '\nimport Sveltex__tex__ref_without_quotation_marks from \'/src/sveltex/tex/ref-without-quotation-marks.svelte\';\nimport \'/src/sveltex/highlight.js@11.9.0.default.min.css\';\nconst foo = "bar";\nconst author = "Jane Doe";\nconst title = "Example";\nconst meta = [{"name":"author","content":"Jane Doe"}];\n',
            );

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (coffeescript)', async () => {
            const markupOut = await sp.markup({
                content:
                    '<tex ref=ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>\n`code`\n$x$',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_without_quotation_marks} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>',
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
                markup: '<tex ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\n```\nimport Sveltex__tex__ref_without_quotation_marks from '/src/sveltex/tex/ref-without-quotation-marks.svelte';\nimport '/src/sveltex/highlight.js@11.9.0.default.min.css';\n```\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });
    });
});
