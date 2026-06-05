import { describe, it, expect } from 'vitest';

import {
    addBlockCodeA11y,
    applyCodeBlockA11y,
    codeBlockLabelInfo,
    resolveCodeBlockA11y,
} from '../../../src/utils/a11y.js';

describe('utils/a11y', () => {
    describe('resolveCodeBlockA11y', () => {
        it('returns null when disabled', () => {
            expect(resolveCodeBlockA11y(false)).toBeNull();
        });
        it('returns the figure default for `true` and `undefined`', () => {
            for (const value of [true, undefined] as const) {
                const resolved = resolveCodeBlockA11y(value);
                expect(resolved?.role).toBe('figure');
                expect(resolved?.label).toBeTypeOf('function');
            }
        });
        it('fills missing object fields with defaults', () => {
            const resolved = resolveCodeBlockA11y({});
            expect(resolved?.role).toBe('figure');
            expect(resolved?.label).toBeTypeOf('function');
        });
        it('honors an explicit role (including `false`)', () => {
            expect(resolveCodeBlockA11y({ role: 'region' })?.role).toBe(
                'region',
            );
            expect(resolveCodeBlockA11y({ role: false })?.role).toBe(false);
        });
        it('honors an explicit label (including `false`)', () => {
            const label = (): string => 'x';
            expect(resolveCodeBlockA11y({ label })?.label).toBe(label);
            expect(resolveCodeBlockA11y({ label: false })?.label).toBe(false);
        });
        it('the default label names the language or falls back to "Code block"', () => {
            const label = resolveCodeBlockA11y(true)?.label;
            expect(label).toBeTypeOf('function');
            if (typeof label === 'function') {
                expect(label({ name: 'TypeScript', tag: 'ts' })).toBe(
                    'TypeScript code block',
                );
                expect(label({ name: undefined, tag: undefined })).toBe(
                    'Code block',
                );
            }
        });
    });

    describe('codeBlockLabelInfo', () => {
        it('returns no name for an undefined tag', () => {
            expect(codeBlockLabelInfo(undefined)).toEqual({
                name: undefined,
                tag: undefined,
            });
        });
        it('treats plaintext tags as languageless', () => {
            for (const tag of ['text', 'plain', 'plaintext', 'txt', 'TXT']) {
                expect(codeBlockLabelInfo(tag)).toEqual({
                    name: undefined,
                    tag: undefined,
                });
            }
        });
        it('resolves a known tag to its language name', () => {
            expect(codeBlockLabelInfo('ts')).toEqual({
                name: 'TypeScript',
                tag: 'ts',
            });
        });
        it('keeps the tag but yields no name for an unknown language', () => {
            expect(codeBlockLabelInfo('definitely-not-a-language')).toEqual({
                name: undefined,
                tag: 'definitely-not-a-language',
            });
        });
    });

    describe('addBlockCodeA11y', () => {
        const block = '<pre><code>x</code></pre>';
        it('is a no-op when there is no <pre> (e.g. inline code)', () => {
            const inline = '<code>x</code>';
            expect(addBlockCodeA11y(inline, 'figure', 'X')).toBe(inline);
        });
        it('adds tabindex, role, aria-label, and a scoped svelte-ignore', () => {
            const out = addBlockCodeA11y(block, 'figure', 'TypeScript code block');
            expect(out).toContain(
                '<!-- svelte-ignore a11y_no_noninteractive_tabindex -->',
            );
            expect(out).toContain('tabindex="0"');
            expect(out).toContain('role="figure"');
            expect(out).toContain('aria-label="TypeScript code block"');
        });
        it('omits the role when it is `false`', () => {
            const out = addBlockCodeA11y(block, false, 'X');
            expect(out).not.toContain('role=');
            expect(out).toContain('tabindex="0"');
        });
        it('omits the aria-label when it is undefined', () => {
            const out = addBlockCodeA11y(block, 'figure', undefined);
            expect(out).not.toContain('aria-label');
            expect(out).toContain('role="figure"');
        });
        it('escapes the aria-label value', () => {
            const out = addBlockCodeA11y(block, 'figure', 'a "b" <c> & d');
            expect(out).toContain(
                'aria-label="a &quot;b&quot; &lt;c&gt; &amp; d"',
            );
        });
        it('treats `$` in the label literally, not as a replacement pattern', () => {
            // Built with slices rather than `String#replace`, so `$&` / `$1`
            // must survive verbatim (only the `&` is HTML-escaped).
            const out = addBlockCodeA11y(block, 'figure', '$5 $& $1');
            expect(out).toContain('aria-label="$5 $&amp; $1"');
        });
        it('does not duplicate attributes already present, but still adds the comment', () => {
            const pre =
                '<pre tabindex="0" role="region" aria-label="keep"><code>x</code></pre>';
            const out = addBlockCodeA11y(pre, 'figure', 'ignored');
            expect(out).toContain(
                '<!-- svelte-ignore a11y_no_noninteractive_tabindex -->',
            );
            // Existing values are preserved (not overwritten or duplicated).
            expect(out).toContain('role="region"');
            expect(out).not.toContain('role="figure"');
            expect(out).toContain('aria-label="keep"');
            expect(out.match(/tabindex=/gu)).toHaveLength(1);
        });
    });

    describe('applyCodeBlockA11y', () => {
        const block = '<pre><code>x</code></pre>';
        it('returns the html unchanged when a11y is disabled', () => {
            expect(applyCodeBlockA11y(block, false, 'ts')).toBe(block);
        });
        it('applies the default treatment with a language-aware label', () => {
            const out = applyCodeBlockA11y(block, true, 'ts');
            expect(out).toContain('role="figure"');
            expect(out).toContain('aria-label="TypeScript code block"');
        });
        it('uses a custom role and label', () => {
            const out = applyCodeBlockA11y(
                block,
                { role: 'region', label: ({ name }) => `${name ?? 'Code'} ex` },
                'ts',
            );
            expect(out).toContain('role="region"');
            expect(out).toContain('aria-label="TypeScript ex"');
        });
        it('adds no aria-label when label is false', () => {
            const out = applyCodeBlockA11y(block, { label: false }, 'ts');
            expect(out).toContain('role="figure"');
            expect(out).not.toContain('aria-label');
        });
    });
});
