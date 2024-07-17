import { type Sveltex, sveltex } from '$base/Sveltex.js';
import { spy } from '$tests/unit/fixtures.js';
import { mockFs } from '$dev_deps.js';
import type { Processed } from 'svelte/compiler';
import {
    type MockInstance,
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

describe('Sveltex', () => {
    let existsSync: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(
            ['fancyWrite', 'spawnCliInstruction', 'log', 'mkdir', 'existsSync'],
            true,
        );
        existsSync = mocks.existsSync;
    });

    let sp: Sveltex<'micromark', 'highlight.js', 'katex'>;

    beforeAll(async () => {
        sp = await sveltex(
            {
                markdownBackend: 'micromark',
                codeBackend: 'highlight.js',
                mathBackend: 'katex',
            },
            {
                markdown: {
                    components: [
                        {
                            name: 'Example',
                            importPath: '$lib/components/Example.svelte',
                        },
                    ],
                },
                math: {
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
                    tex: { aliases: ['TeX'], type: 'tex' },
                },
            },
        );
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
            existsSync.mockReturnValue(true);
            const markupOut = await sp.markup({
                content: '<tex ref="something">x</tex>\n`code`\n$x$',
                filename: '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex',
            });
            expect((markupOut as Processed).code).toMatch(
                /<svelte:head>\n.{0,100}<link rel="stylesheet" href=".{0,100}\.css">\n.{0,100}<\/svelte:head>\n<script>\n<\/script>\n.{0,100}<figure>\n<svelte:component this={Sveltex__tex__something} \/>\n<\/figure>\n.{0,100}<p><code>code<\/code>.{0,100}\n<span class="katex">/s,
            );
            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: markupOut?.code ?? '',
                filename: '90ed9f9c-b8b8-4a8a-aeee-1dc3cb412cc4.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Sveltex__tex__something from '/src/sveltex/tex/something.svelte';\n",
            );
            existsSync.mockReset();
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
                (
                    await sp.script({
                        content: '',
                        attributes: {},
                        markup: markupOut?.code ?? '',
                        filename:
                            '7a541239-3058-460b-b3c6-5076a2f3f73b.sveltex',
                    })
                )?.code,
            ).toBeUndefined();
        });
        it('works', async () => {
            existsSync.mockReturnValue(true);
            const markupOut = await sp.markup({
                content:
                    '---\nfoo: bar\ntitle: Example\nauthor: Jane Doe\n---\n*text*\n<tex ref=ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>\n`code`\n$x$',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });
            const res = (markupOut as Processed).code;
            expect(res).toMatch(
                /<svelte:head>\n<title>Example<\/title>\n<meta name="author" content="Jane Doe">\n<link rel="stylesheet" href=".{1,100}\.css">\n/,
            );
            expect(res).toMatch(
                /<figure id="something">\n<svelte:component this={Sveltex__tex__ref_without_quotation_marks} \/>\n<figcaption id="caption-id">some text here<\/figcaption>\n<\/figure>\n<p><code>code<\/code>\n<span class="katex">/,
            );

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: markupOut?.code ?? '',
                filename: '9ae17b43-d19c-4ca3-9772-36e506ffb4a5.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                '\nimport Sveltex__tex__ref_without_quotation_marks from \'/src/sveltex/tex/ref-without-quotation-marks.svelte\';\nconst foo = "bar";\nconst author = "Jane Doe";\nconst title = "Example";\nconst meta = [{"name":"author","content":"Jane Doe"}];\n',
            );

            existsSync.mockReset();
        });

        it('works (coffeescript)', async () => {
            existsSync.mockReturnValue(true);
            const markupOut = await sp.markup({
                content:
                    '<tex ref=ref-without-quotation-marks id="something" caption="some text here" caption:id="caption-id" >x</tex>\n`code`\n$x$',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((markupOut as Processed).code).toContain(
                '<script>\n</script>\n<figure id="something">\n<svelte:component this={Sveltex__tex__ref_without_quotation_marks} />\n<figcaption id="caption-id">some text here</figcaption>\n</figure>',
            );

            const scriptOut = await sp.script({
                content: '',
                attributes: { lang: 'coffeescript' },
                markup: markupOut?.code ?? '',
                filename: '420274ac-0f4d-49b9-842e-f9937ae45ca6.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\n```\nimport Sveltex__tex__ref_without_quotation_marks from '/src/sveltex/tex/ref-without-quotation-marks.svelte';\n```\n",
            );

            existsSync.mockReset();
        });

        it('auto-importing some components', async () => {
            existsSync.mockReturnValue(true);
            const markupOut = await sp.markup({
                content: '<Example />',
                filename: '6f85b451-6ae9-42c4-a03b-cca772ef7455.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<script>\n</script>\n<Example />',
            );

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: markupOut?.code ?? '',
                filename: '6f85b451-6ae9-42c4-a03b-cca772ef7455.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport Example from '$lib/components/Example.svelte';\n",
            );
            existsSync.mockReset();
        });

        it('auto-importing some components (already imported)', async () => {
            existsSync.mockReturnValue(true);
            const markupOut = await sp.markup({
                content:
                    "<script>\nimport Example from '$lib/components/Example.svelte';\n</script>\n<Example />",
                filename: '6f85b451-6ae9-42c4-a03b-cca772ef7455.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                "<script>\nimport Example from '$lib/components/Example.svelte';\n</script>\n<Example />",
            );

            const scriptOut = await sp.script({
                content:
                    "\nimport Example from '$lib/components/Example.svelte';\n",
                attributes: {},
                markup: markupOut?.code ?? '',
                filename: '6f85b451-6ae9-42c4-a03b-cca772ef7455.sveltex',
            });
            expect(scriptOut).toBeUndefined();
            existsSync.mockReset();
        });
    });
});
