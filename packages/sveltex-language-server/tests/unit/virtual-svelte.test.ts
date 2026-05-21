// Unit tests for the virtual `.svelte` document builder
// (`src/core/virtual-svelte.ts`): delegated regions copied verbatim,
// non-delegated regions blanked to equal-length whitespace, and the resulting
// source map.

import { describe, expect, it } from 'vitest';
import { computeRegions } from '../../src/core/regions.js';
import { buildVirtualSvelte } from '../../src/core/virtual-svelte.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';

const config = defaultConfigSnapshot();

describe('buildVirtualSvelte', () => {
    it('keeps the virtual document the exact length of the source', () => {
        const source = '# H\n\n$$x$$\n\n<script>let a=1;</script>\n';
        const regions = computeRegions(source, config);
        const { text } = buildVirtualSvelte(source, regions);
        expect(text.length).toBe(source.length);
    });

    it('preserves the line count so line numbers never shift', () => {
        const source = 'a\n\n```\ncode\nhere\n```\n\nb';
        const regions = computeRegions(source, config);
        const { text } = buildVirtualSvelte(source, regions);
        const sourceLines = (source.match(/\n/gu) ?? []).length;
        const virtualLines = (text.match(/\n/gu) ?? []).length;
        expect(virtualLines).toBe(sourceLines);
    });

    it('copies delegated regions byte-for-byte', () => {
        const source = '<script>\nlet greeting = "hi";\n</script>';
        const regions = computeRegions(source, config);
        const { text } = buildVirtualSvelte(source, regions);
        expect(text).toContain('let greeting = "hi";');
    });

    it('blanks non-delegated regions to whitespace', () => {
        const source = 'text\n\n$$\\secret math\\$$\n\ntext';
        const regions = computeRegions(source, config);
        const { text } = buildVirtualSvelte(source, regions);
        // The math content is gone; only whitespace remains in its span.
        expect(text).not.toContain('secret');
        // The delegated Markdown around it survives.
        expect(text).toContain('text');
    });

    it('copies a noop verbatim body into the virtual document', () => {
        // `type: 'noop'` envs are relabelled to `svelte` (delegated), so
        // their body must reach the virtual `.svelte` document — that's
        // what lets `svelte-language-server` offer completion / hover
        // inside them. (`escape`-typed envs, by contrast, stay blanked.)
        const noopConfig = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'Raw'],
            noopTags: ['Raw'],
        };
        const source = '# Heading\n\n<Raw>\n<button on:click={fn} />\n</Raw>\n';
        const regions = computeRegions(source, noopConfig);
        const { text } = buildVirtualSvelte(source, regions);
        expect(text).toContain('<button on:click={fn} />');
    });

    it('blanks an escape verbatim body from the virtual document', () => {
        // The complement: `escape`-typed bodies must NOT reach Svelte —
        // they're literal text and Svelte would mis-parse e.g. `{ … }`.
        const escapeConfig = {
            ...config,
            verbatimTags: [...config.verbatimTags, 'Esc'],
            escapeTags: [...config.escapeTags, 'Esc'],
        };
        const source = '<Esc>{not a mustache}</Esc>';
        const regions = computeRegions(source, escapeConfig);
        const { text } = buildVirtualSvelte(source, regions);
        expect(text).not.toContain('not a mustache');
    });

    it('emits a source map that round-trips delegated offsets', () => {
        const source = '<script>\nlet value = 42;\n</script>';
        const regions = computeRegions(source, config);
        const { sourceMap } = buildVirtualSvelte(source, regions);
        const offset = source.indexOf('value');
        const generated = sourceMap.sourceOffsetToGenerated(offset);
        expect(generated).toBeDefined();
        if (generated !== undefined) {
            expect(sourceMap.generatedOffsetToSource(generated)).toBe(offset);
        }
    });

    it('emits no mapping for non-delegated offsets', () => {
        const source = 'a\n\n$$x + y$$\n\nb';
        const regions = computeRegions(source, config);
        const { sourceMap } = buildVirtualSvelte(source, regions);
        const mathOffset = source.indexOf('x + y');
        expect(sourceMap.sourceOffsetToGenerated(mathOffset)).toBeUndefined();
    });

    it('produces an empty virtual document for an empty source', () => {
        const regions = computeRegions('', config);
        const { text } = buildVirtualSvelte('', regions);
        expect(text).toBe('');
    });
});
