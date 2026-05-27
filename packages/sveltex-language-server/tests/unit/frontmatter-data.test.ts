// Unit tests for the frontmatter documentation tables and helpers
// (`src/core/frontmatter-data.ts`): the per-context key sets and the two
// `<meta>`-template helpers (`metaRenderedHtml` / `metaHeadEffect`) that derive
// rendered HTML and head-effect prose from a `<meta …>` element string.

import { describe, expect, it } from 'vitest';
import {
    keysForContext,
    metaHeadEffect,
    metaRenderedHtml,
    META_HTTP_EQUIV,
    META_NAMES,
} from '../../src/core/frontmatter-data.js';

describe('keysForContext', () => {
    it('returns the meta keys (names, pragmas and item keys) inside `meta`', () => {
        const keys = keysForContext('meta');
        // Metadata names, pragma directives and array-item keys all valid.
        expect(keys).toHaveProperty('description');
        expect(keys).toHaveProperty('content-security-policy');
        expect(keys).toHaveProperty('name');
        expect(keys).toHaveProperty('content');
        // A top-level structural key is not valid here.
        expect(keys).not.toHaveProperty('title');
    });

    it('returns just the base keys inside `base`', () => {
        const keys = keysForContext('base');
        expect(Object.keys(keys).sort()).toEqual(['href', 'target']);
    });

    it('returns the link keys inside `link`', () => {
        const keys = keysForContext('link');
        expect(Object.keys(keys).sort()).toEqual(
            ['as', 'crossorigin', 'href', 'rel', 'type'].sort(),
        );
    });

    it('returns the top-level keys for an unknown / undefined context', () => {
        const top = keysForContext(undefined);
        // Structural keys plus metadata names plus pragma directives.
        expect(top).toHaveProperty('title');
        expect(top).toHaveProperty('imports');
        expect(top).toHaveProperty('description');
        expect(top).toHaveProperty('content-security-policy');
    });

    it('falls through to the top level for an unrecognised block name', () => {
        // Any name other than meta/base/link hits the `default` arm.
        expect(keysForContext('totally-unknown')).toBe(keysForContext(undefined));
    });
});

describe('metaRenderedHtml', () => {
    it('slots a `content` attribute into a `<meta name>` element', () => {
        expect(metaRenderedHtml('<meta name="author">')).toBe(
            '<meta name="author" content="〈value〉">',
        );
    });

    it('slots a `content` attribute into a `<meta http-equiv>` element', () => {
        expect(metaRenderedHtml('<meta http-equiv="default-style">')).toBe(
            '<meta http-equiv="default-style" content="〈value〉">',
        );
    });

    it('renders the value into the `charset` attribute for `<meta charset>`', () => {
        expect(metaRenderedHtml('<meta charset>')).toBe(
            '<meta charset="〈value〉">',
        );
    });

    it('returns undefined for an element that fits neither template', () => {
        // Structural elements (`<title>`, `<base>`) and bare attribute refs
        // (`<base href>`) supply their own `rendersAs`, so this helper returns
        // undefined for them.
        expect(metaRenderedHtml('<title>')).toBeUndefined();
        expect(metaRenderedHtml('<base href>')).toBeUndefined();
        // A `name` without a value does not match the value-bearing template.
        expect(metaRenderedHtml('<meta name>')).toBeUndefined();
    });

    it('derives templates for every `META_NAMES` / `META_HTTP_EQUIV` element', () => {
        // Sanity check that the table entries all resolve to a rendered form.
        for (const doc of Object.values(META_NAMES)) {
            expect(metaRenderedHtml(doc.element ?? '')).toBeDefined();
        }
        for (const doc of Object.values(META_HTTP_EQUIV)) {
            expect(metaRenderedHtml(doc.element ?? '')).toBeDefined();
        }
    });
});

describe('metaHeadEffect', () => {
    it('wraps the rendered HTML in an "Inserts … into <svelte:head>" sentence', () => {
        const effect = metaHeadEffect('<meta name="description">');
        expect(effect).toContain(
            'Inserts `<meta name="description" content="〈value〉">`',
        );
        expect(effect).toContain("into the page's `<svelte:head>`");
    });

    it('handles the `<meta charset>` element', () => {
        expect(metaHeadEffect('<meta charset>')).toContain(
            'Inserts `<meta charset="〈value〉">`',
        );
    });

    it('returns undefined when the element fits no rendered template', () => {
        expect(metaHeadEffect('<title>')).toBeUndefined();
        expect(metaHeadEffect('<base href>')).toBeUndefined();
    });
});
