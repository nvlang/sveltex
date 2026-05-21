// Tests that the examples in `docs/src/docs/markdown.md` actually produce
// the documented output. The `[sveltex]` tab of each docs code-group is the
// `input` below, and the `[svelte]` tab is the `expected` output — keep
// them in sync.

import { describe, expect, it } from 'vitest';
import { preprocess, type PreprocessorGroup } from 'svelte/compiler';
import { sveltex } from '../../../src/mod.js';

const run = async (s: PreprocessorGroup, input: string): Promise<string> => {
    const result = await preprocess(input, s, { filename: 'test.sveltex' });
    return result.code;
};

describe('docs/src/docs/markdown.md examples', () => {
    describe('### Imports', () => {
        it('produces the documented output', async () => {
            const sp = await sveltex({ markdownBackend: 'micromark' });
            const input = [
                '---',
                'imports:',
                '  $lib/components/Example.svelte: Example',
                '  $lib/utils.js:',
                '    - a',
                '    - b',
                '---',
                '',
            ].join('\n');
            const expected = [
                '<script module>',
                '',
                'export const metadata = {',
                'imports: {"$lib/components/Example.svelte":"Example","$lib/utils.js":["a","b"]},',
                '};',
                '</script>',
                '<script>',
                '',
                "import Example from '$lib/components/Example.svelte';",
                "import { a, b } from '$lib/utils.js';",
                '</script>',
                '',
                '',
            ].join('\n');
            expect(await run(sp, input)).toEqual(expected);
        });
    });

    describe('### Metadata export', () => {
        it('the frontmatter example produces the documented output', async () => {
            const sp = await sveltex({ markdownBackend: 'micromark' });
            const input = [
                '---',
                'title: Example',
                'author: Jane Doe',
                'color-scheme: dark',
                '---',
                '',
            ].join('\n');
            const expected = [
                '<svelte:head>',
                '<title>Example</title>',
                '<meta name="author" content="Jane Doe">',
                '<meta name="color-scheme" content="dark">',
                '</svelte:head>',
                '<script module>',
                '',
                'export const metadata = {',
                'author: "Jane Doe",',
                '"color-scheme": "dark",',
                'title: "Example",',
                '};',
                '</script>',
                '<script>',
                '</script>',
                '',
                '',
            ].join('\n');
            expect(await run(sp, input)).toEqual(expected);
        });

        it('the in-page-usage example produces the documented output', async () => {
            const sp = await sveltex({ markdownBackend: 'micromark' });
            const input = [
                '---',
                'title: Welcome',
                '---',
                '',
                '# {metadata.title}',
                '',
                "Posted by {metadata.author ?? 'anonymous'}.",
                '',
            ].join('\n');
            const expected = [
                '<svelte:head>',
                '<title>Welcome</title>',
                '</svelte:head>',
                '<script module>',
                '',
                'export const metadata = {',
                'title: "Welcome",',
                '};',
                '</script>',
                '<script>',
                '</script>',
                '',
                '<h1>{metadata.title}</h1>',
                "<p>Posted by {metadata.author ?? 'anonymous'}.</p>",
                '',
            ].join('\n');
            expect(await run(sp, input)).toEqual(expected);
        });
    });

    describe('### Disabling frontmatter processing', () => {
        it('the head-disabled example produces the documented output', async () => {
            const sp = await sveltex(
                { markdownBackend: 'micromark' },
                { frontmatter: { head: false } },
            );
            const input = [
                '---',
                'title: Welcome',
                '---',
                '',
                '<svelte:head>',
                '<title>{metadata.title} — My Site</title>',
                '</svelte:head>',
                '',
                '# {metadata.title}',
                '',
            ].join('\n');
            const expected = [
                '<script module>',
                '',
                'export const metadata = {',
                'title: "Welcome",',
                '};',
                '</script>',
                '<script>',
                '</script>',
                '',
                '<svelte:head>',
                '<title>{metadata.title} — My Site</title>',
                '</svelte:head>',
                '<h1>{metadata.title}</h1>',
                '',
            ].join('\n');
            expect(await run(sp, input)).toEqual(expected);
        });
    });
});
