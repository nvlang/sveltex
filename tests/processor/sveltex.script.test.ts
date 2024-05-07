import { sveltex } from '$sveltex-preprocess';
import { spy } from '$tests/fixtures.js';
import mockFs from 'mock-fs';
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

const sp = await sveltex({
    markdownBackend: 'none',
    codeBackend: 'none',
    texBackend: 'mathjax',
    advancedTexBackend: 'local',
});

await sp.configure({
    advancedTex: {
        components: {
            tex: { aliases: ['TeX'] },
        },
    },
});

suite('Sveltex', async () => {
    // const { log, spawnCliInstruction, writeFile } =
    await spy(['writeFile', 'spawnCliInstruction', 'log'], true);
    beforeAll(() => {
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
                content: '<tex ref="something">x</tex>',
                filename: 'test-basic.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\n<figure>\n<svelte:component this={Sveltex__tex__something} />\n</figure>',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents['test-basic.sveltex']
                    ?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: '<tex ref="something">x</tex>',
                filename: 'test-basic.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Sveltex__tex__something from '/src/sveltex/tex/something.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (no tex components)', async () => {
            const markupOut = await sp.markup({
                content: 'something',
                filename: 'test-basic.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\nsomething',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(0);
            expect(
                sp.advancedTexHandler.texComponents['test-basic.sveltex'],
            ).toBeUndefined();

            expect(
                await sp.script({
                    content: '',
                    attributes: {},
                    markup: 'something',
                    filename: 'test-basic.sveltex',
                }),
            ).toBeUndefined();
            sp.advancedTexHandler.texComponents = {};
        });

        it('works', async () => {
            const markupOut = await sp.markup({
                content:
                    '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: 'test.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_as_valueless_attribute} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents['test.sveltex']?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: 'test.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Sveltex__tex__ref_as_valueless_attribute from '/src/sveltex/tex/ref-as-valueless-attribute.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });

        it('works (coffeescript)', async () => {
            const markupOut = await sp.markup({
                content:
                    '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: 'test.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_as_valueless_attribute} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>',
            );
            expect(
                Object.keys(sp.advancedTexHandler.texComponents).length,
            ).toEqual(1);
            expect(
                sp.advancedTexHandler.texComponents['test.sveltex']?.length,
            ).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: { lang: 'coffeescript' },
                markup: '<tex ref-as-valueless-attribute id="something" caption="some text here" caption:id="caption-id" >x</tex>',
                filename: 'test.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\n```\nimport Sveltex__tex__ref_as_valueless_attribute from '/src/sveltex/tex/ref-as-valueless-attribute.svelte';\nimport '/src/sveltex/mathjax@3.2.2.svg.min.css';\n```\n",
            );

            sp.advancedTexHandler.texComponents = {};
        });
    });
});
