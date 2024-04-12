import { describe, it, expect, vi, suite, beforeEach } from 'vitest';
import { sveltex } from '$processor';
import { Processed } from 'svelte/compiler';

let writeFileSyncCallStack: [string, string, string][] = [];

vi.mock('node:fs', async (orig: () => Promise<object>) => ({
    ...(await orig()),
    writeFileSync: vi
        .fn()
        .mockImplementation(
            (path: string, content: string, encoding: string) => {
                writeFileSyncCallStack.push([path, content, encoding]);
            },
        ),
}));

const consoleInfoSpy = vi
    .spyOn(console, 'info')
    .mockImplementation(() => undefined);
const consoleWarnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined);
const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

const sp = await sveltex('none', 'none', 'none', 'local');

await sp.configure({
    advancedTex: {
        components: {
            tex: { aliases: ['TeX'] },
        },
    },
});

suite('Sveltex', () => {
    beforeEach(() => {
        writeFileSyncCallStack = [];
        consoleInfoSpy.mockClear();
        consoleWarnSpy.mockClear();
        consoleErrorSpy.mockClear();
    });

    describe('Sveltex.markup + Sveltex.script', () => {
        it('correctly stores info in texComponentsMap', async () => {
            const markupOut = await sp.markup({
                content: '<tex>x</tex>',
                filename: 'test.sveltex',
            });
            expect((markupOut as Processed).code).toEqual(
                '<figure id="2azgFtbWfieP3uQaD41I2wi1B7Ckn12JcHetlahfjRo"></figure>',
            );
            expect(sp.texComponentsMap.size).toEqual(1);
            expect(sp.texComponentsMap.get('test.sveltex')?.length).toEqual(1);

            const scriptOut = await sp.script({
                content: '',
                attributes: {},
                markup: '<tex>x</tex>',
                filename: 'test.sveltex',
            });
            expect((scriptOut as Processed).code).toEqual(
                "\nimport { onMount as __sveltex_onMount } from 'svelte';\n__sveltex_onMount(async () => {\n    try {\ndocument.getElementById('2azgFtbWfieP3uQaD41I2wi1B7Ckn12JcHetlahfjRo')?.insertAdjacentHTML('beforeend', (await fetch('sveltex/2azgFtbWfieP3uQaD41I2wi1B7Ckn12JcHetlahfjRo.svg')).text());\n    } catch (err) {\n        console.error('[sveltex error]', err);\n    }\n});\n",
            );
        });
    });
});
