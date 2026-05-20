import {
    describe,
    it,
    expect,
    type MockInstance,
    beforeAll,
    afterAll,
    vi,
    beforeEach,
} from 'vitest';
import {
    handleFrontmatter,
    interpretFrontmatter,
    normalizeFrontmatterConfiguration,
    parseFrontmatter,
} from '../../../src/utils/frontmatter.js';
import type { Frontmatter } from '../../../src/types/utils/Frontmatter.js';
import type { FullFrontmatterConfiguration } from '../../../src/types/SveltexConfiguration.js';
import { spy } from '../fixtures.js';
import { isString } from '../../../src/typeGuards/utils.js';
import type { ProcessableSnippet } from '../../../src/types/utils/Escape.js';

let log: MockInstance;
beforeAll(async () => {
    const mocks = await spy(['log'], true);
    log = mocks.log;
});
afterAll(() => {
    vi.restoreAllMocks();
});
beforeEach(() => {
    vi.clearAllMocks();
});

describe('parseFrontmatter', () => {
    describe('YAML', () => {
        describe('correctly interprets values', () => {
            it.each([
                ['foo: bar', { foo: 'bar' }],
                ['foo: null', { foo: null }],
                ['foo: true', { foo: true }],
                ['foo: false', { foo: false }],
                ['foo: 123', { foo: 123 }],
                ['foo: 123.456', { foo: 123.456 }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'yaml' },
                    }),
                ).toEqual(expected);
            });
        });
        describe('respects structure', () => {
            it.each([
                ['foo: bar\nbaz: qux', { foo: 'bar', baz: 'qux' }],
                [
                    'foo: bar\nbaz:\n- qux\n- quux',
                    { foo: 'bar', baz: ['qux', 'quux'] },
                ],
                ['foo:\n  bar: baz', { foo: { bar: 'baz' } }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'yaml' },
                    }),
                ).toEqual(expected);
            });
        });
        describe('catches and logs errors', () => {
            it.each(['-:a: b\n-'])('%o → error', (innerContent) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'yaml' },
                    }),
                ).toBeUndefined();
                expect(log).toHaveBeenCalledWith(
                    'error',
                    expect.stringContaining('Error parsing frontmatter'),
                );
            });
        });
    });

    describe('TOML', () => {
        describe('correctly interprets values', () => {
            it.each([
                ['foo = "bar"', { foo: 'bar' }],
                ["foo = 'bar'", { foo: 'bar' }],
                ['foo = true', { foo: true }],
                ['foo = false', { foo: false }],
                ['foo = 123', { foo: 123 }],
                ['foo = 123.456', { foo: 123.456 }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'toml' },
                    }),
                ).toEqual(expected);
            });
        });
        describe('respects structure', () => {
            it.each([
                ['foo = "bar"\nbaz = "qux"', { foo: 'bar', baz: 'qux' }],
                [
                    'foo = "bar"\nbaz = ["qux", "quux"]',
                    { foo: 'bar', baz: ['qux', 'quux'] },
                ],
                ['[foo]\nbar = "baz"', { foo: { bar: 'baz' } }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'toml' },
                    }),
                ).toEqual(expected);
            });
        });
        describe('catches and logs errors', () => {
            it.each(['...'])('%o → error', (innerContent) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'toml' },
                    }),
                ).toBeUndefined();
                expect(log).toHaveBeenCalledWith(
                    'error',
                    expect.stringContaining('Error parsing frontmatter'),
                );
            });
        });
    });

    describe('JSON', () => {
        describe('correctly interprets values', () => {
            it.each([
                ['{"foo": "bar"}', { foo: 'bar' }],
                ['{"foo": null}', { foo: null }],
                ['{"foo": true}', { foo: true }],
                ['{"foo": false}', { foo: false }],
                ['{"foo": 123}', { foo: 123 }],
                ['{"foo": 123.456}', { foo: 123.456 }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'json' },
                    }),
                ).toEqual(expected);
            });
        });

        describe('respects structure', () => {
            it.each([
                ['{"foo": "bar","baz": "qux"}', { foo: 'bar', baz: 'qux' }],
                [
                    '{"foo": "bar","baz": ["qux","quux"]}',
                    { foo: 'bar', baz: ['qux', 'quux'] },
                ],
                ['{"foo": {"bar": "baz"}}', { foo: { bar: 'baz' } }],
            ])('%o → %o', (innerContent, expected) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'json' },
                    }),
                ).toEqual(expected);
            });
        });

        describe('catches and logs errors', () => {
            it.each(['...'])('%o → error', (innerContent) => {
                expect(
                    parseFrontmatter({
                        innerContent,
                        optionsForProcessor: { type: 'json' },
                    }),
                ).toBeUndefined();
                expect(log).toHaveBeenCalledWith(
                    'error',
                    expect.stringContaining('Error parsing frontmatter'),
                );
            });
        });
    });
});

describe('interpretFrontmatter()', () => {
    it.each([
        [{}, {}],
        [
            {
                title: 'Hello, World!',
                noscript: 'This site requires JavaScript to function.',
                base: { href: 'https://example.com', target: '_blank' },
                link: [
                    { rel: 'stylesheet', href: 'styles.css' },
                    { rel: 'preload', as: 'style', href: 'styles.css' },
                ],
                meta: [
                    { name: 'description', content: 'This is a test page.' },
                    { name: 'keywords', content: 'test, page' },
                    { name: 'author', content: 'Jane Doe' },
                    { name: 'application-name', content: 'test' },
                    { name: 'generator', content: 'test' },
                    { name: 'viewport', content: 'test' },
                    {
                        'http-equiv': 'content-security-policy',
                        content: 'test',
                    },
                    { 'http-equiv': 'default-style', content: 'test' },
                ],
                foo: 'bar',
                baz: 'qux',
            },
        ],
        // Top-level metadata-name keys ARE used to synthesize `<meta>`
        // tags for `<svelte:head>`, but that synthesised list is kept
        // separate from `frontmatter.meta` — so the returned frontmatter
        // here is just `{ author }`, with the `<meta>` rendering covered
        // by the `handleFrontmatter()` tests below.
        [{ author: 'Jane Doe' }],
        [{ description: '...' }],
        // `charset` would also produce a `<meta charset>` tag, but it
        // doesn't leak into `frontmatter.meta` either.
        [{ charset: 'utf-8' }],
        [
            { meta: [{ name: 'charset', content: 'utf-8' }] },
            { meta: [{ charset: 'utf-8' }] },
        ],
        [
            { meta: { charset: 'utf-8' } } as unknown as Frontmatter,
            { meta: [{ charset: 'utf-8' }] },
        ],
        // The top-level `description` synthesises a `<meta name="description">`
        // tag, but `frontmatter.meta` only carries the user's `meta:` block.
        [
            {
                description: '...',
                meta: [{ name: 'keywords', content: 'a, b, c' }],
            },
        ],
        [
            {
                description: '...',
                meta: [{ name: 'description', content: 'test' }],
            },
            {
                description: '...',
                meta: [{ name: 'description', content: 'test' }],
            },
            ['warn', 'Duplicate meta name "description" found in frontmatter.'],
        ],
        [
            {
                'default-style': '...',
                meta: [{ 'http-equiv': 'default-style', content: 'test' }],
            },
            {
                'default-style': '...',
                meta: [{ 'http-equiv': 'default-style', content: 'test' }],
            },
            [
                'warn',
                'Duplicate meta http-equiv "default-style" found in frontmatter.',
            ],
        ],
        [
            {
                description: '...',
                'default-style': '...',
                meta: [
                    { 'http-equiv': 'default-style', content: 'test' },
                    { name: 'description', content: 'test' },
                ],
            },
            {
                'default-style': '...',
                description: '...',
                meta: [
                    { 'http-equiv': 'default-style', content: 'test' },
                    { name: 'description', content: 'test' },
                ],
            },
            [
                [
                    'warn',
                    'Duplicate meta http-equiv "default-style" found in frontmatter.',
                ],
                [
                    'warn',
                    'Duplicate meta name "description" found in frontmatter.',
                ],
            ],
        ],
        [
            {
                description: '...',
                meta: { author: 'Jane Doe', description: 'test' },
            },
            {
                description: '...',
                meta: [
                    { content: 'Jane Doe', name: 'author' },
                    { content: 'test', name: 'description' },
                ],
            },
        ],
        [
            { titulo: '...', meta: { auteur: 'Jane Doe', desc: 'test' } },
            { titulo: '...' },
        ],
        // `base` is truthy but neither a string nor a non-null object, so it
        // is dropped entirely.
        [{ base: 123 } as unknown as Frontmatter, {}],
        [{ base: true } as unknown as Frontmatter, {}],
        // `base` object provides only `target` (no `href`).
        [{ base: { target: '_blank' } }, { base: { target: '_blank' } }],
        // `link` is truthy but not an array: `frontmatter.link` is reset to an
        // empty array and nothing is interpreted.
        [{ link: { rel: 'stylesheet' } } as unknown as Frontmatter, { link: [] }],
        // `link` is an array, but none of its items are valid objects with a
        // string `rel`, so the interpreted link list stays empty.
        [
            {
                link: ['not-an-object', { href: 'x.css' }, { rel: 42 }],
            } as unknown as Frontmatter,
            { link: [] },
        ],
        // A `meta` array item carries `content` but neither a valid `name` nor
        // a valid `http-equiv`, so it contributes nothing.
        [{ meta: [{ content: 'orphan content' }] }, {}],
        // `meta` is truthy but neither an array nor a non-null object.
        [{ meta: 'a bare string' } as unknown as Frontmatter, {}],
    ] as [Frontmatter, object?, ([string, string] | [string, string][])?][])(
        '%o → %o',
        (input, expected, logs) => {
            expect(interpretFrontmatter(input)?.frontmatter).toEqual(
                expected ?? input,
            );
            if (logs) {
                if (isString(logs[0])) {
                    expect(log).toHaveBeenCalledWith(...logs);
                } else {
                    (logs as [string, string][]).forEach((logArgs, i) => {
                        expect(log).toHaveBeenNthCalledWith(i + 1, ...logArgs);
                    });
                }
            }
        },
    );
});

describe('handleFrontmatter()', () => {
    it.each([
        {
            label: 'undefined',
            snippet: {
                innerContent: undefined,
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [],
        },
        {
            label: 'foo: bar',
            snippet: {
                innerContent: 'foo: bar',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                'foo: "bar",',
                '};',
            ],
        },
        {
            label: 'base',
            snippet: {
                innerContent:
                    'base:\n  href: https://example.com\n  target: _blank',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<base href="https://example.com" target="_blank">'],
            scriptModuleLines: [
                'export const metadata = {',
                'base: {"href":"https://example.com","target":"_blank"},',
                '};',
            ],
        },
        {
            label: 'base (string)',
            snippet: {
                innerContent: 'base: https://example.com',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<base href="https://example.com">'],
            scriptModuleLines: [
                'export const metadata = {',
                'base: {"href":"https://example.com"},',
                '};',
            ],
        },
        {
            label: 'base (invalid target)',
            snippet: {
                innerContent:
                    'base:\n  href: https://example.com\n  target: 123',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<base href="https://example.com">'],
            scriptModuleLines: [
                'export const metadata = {',
                'base: {"href":"https://example.com"},',
                '};',
            ],
        },
        {
            label: 'base (invalid href)',
            snippet: {
                innerContent: 'base:\n  href: 123\n  target: _blank',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<base target="_blank">'],
            scriptModuleLines: [
                'export const metadata = {',
                'base: {"target":"_blank"},',
                '};',
            ],
        },
        {
            label: 'meta object',
            snippet: {
                innerContent:
                    'author: ...\n' +
                    'meta:\n' +
                    '  author: Jane Doe\n' +
                    '  description: ...\n' +
                    '  default-style: styles.css',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta name="author" content="Jane Doe">',
                '<meta name="description" content="...">',
                '<meta http-equiv="default-style" content="styles.css">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'author: "...",',
                'meta: [{"name":"author","content":"Jane Doe"},{"name":"description","content":"..."},{"http-equiv":"default-style","content":"styles.css"}],',
                '};',
            ],
        },
        {
            label: 'meta array',
            snippet: {
                innerContent:
                    'author: ...\nmeta:\n- name: author\n  content: Jane Doe',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta name="author" content="Jane Doe">'],
            scriptModuleLines: [
                'export const metadata = {',
                'author: "...",',
                'meta: [{"name":"author","content":"Jane Doe"}],',
                '};',
            ],
        },
        {
            label: 'meta array (no content)',
            snippet: {
                innerContent: 'meta:\n- name: author',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [],
        },
        {
            label: 'meta object + keywords array',
            snippet: {
                innerContent:
                    'meta:\n  description: This is a test page.\n  keywords:\n  - a\n  - b',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta name="description" content="This is a test page.">',
                '<meta name="keywords" content="a, b">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"a, b"}],',
                '};',
            ],
        },
        {
            label: 'meta array + keywords array',
            snippet: {
                innerContent:
                    'meta:\n' +
                    '- name: description\n' +
                    '  content: This is a test page.\n' +
                    '- name: keywords\n' +
                    '  content:\n' +
                    '  - a\n' +
                    '  - b',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta name="description" content="This is a test page.">',
                '<meta name="keywords" content="a, b">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"a, b"}],',
                '};',
            ],
        },
        {
            label: 'last value takes precedence',
            snippet: {
                innerContent:
                    'meta:\n' +
                    '- name: description\n' +
                    '  content: ...\n' +
                    '- name: description\n' +
                    '  content: This is a test page.\n' +
                    '- name: keywords\n' +
                    '  content:\n' +
                    '  - a\n' +
                    '  - b\n' +
                    '- name: keywords\n' +
                    '  content: c, d',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta name="description" content="This is a test page.">',
                '<meta name="keywords" content="c, d">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"c, d"}],',
                '};',
            ],
        },
        {
            label: 'title + links',
            snippet: {
                innerContent:
                    'title: ...\n' +
                    'link:\n' +
                    '- rel: stylesheet\n' +
                    '  href: styles.css\n' +
                    '- rel: stylesheet\n' +
                    '  href: styles2.css',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<title>...</title>',
                '<link rel="stylesheet" href="styles.css">',
                '<link rel="stylesheet" href="styles2.css">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'title: "...",',
                'link: [{"rel":"stylesheet","href":"styles.css"},{"rel":"stylesheet","href":"styles2.css"}],',
                '};',
            ],
        },
        {
            label: 'noscript',
            snippet: {
                innerContent: 'noscript: ...',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<noscript>...</noscript>'],
            scriptModuleLines: [
                'export const metadata = {',
                'noscript: "...",',
                '};',
            ],
        },
        {
            label: 'http-equiv with array',
            snippet: {
                innerContent: 'meta:\n  default-style:\n  - a\n  - b',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta http-equiv="default-style" content="a, b">'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"http-equiv":"default-style","content":"a, b"}],',
                '};',
            ],
        },
        {
            label: 'imports',
            snippet: {
                innerContent:
                    'imports:\n' +
                    '  $lib/utils.js:\n' +
                    '    - b\n' +
                    '    - c\n' +
                    '  ./Something.svelte: Something',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptLines: [
                "import { b, c } from '$lib/utils.js';",
                "import Something from './Something.svelte';",
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'imports: {"$lib/utils.js":["b","c"],"./Something.svelte":"Something"},',
                '};',
            ],
        },
        {
            // `base` is an empty object in the raw frontmatter;
            // `interpretFrontmatter` drops it (neither `href` nor `target`),
            // so it never reaches `handleFrontmatter`'s `headLines` logic.
            label: 'base (empty object, dropped on interpretation)',
            snippet: {
                innerContent: 'base: {}',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [],
        },
        // The rows below cover non-identifier keys: the metadata-name keys
        // SvelTeX accepts at the top level have hyphens (`color-scheme`,
        // `theme-color`, …), and a user may write any string. Such keys
        // become quoted object keys in the `metadata` export so the
        // emitted JavaScript stays syntactically valid.
        {
            label: 'metadata-name key with hyphens (top level)',
            snippet: {
                innerContent: 'color-scheme: dark',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta name="color-scheme" content="dark">'],
            scriptModuleLines: [
                'export const metadata = {',
                '"color-scheme": "dark",',
                '};',
            ],
        },
        {
            label: 'non-metadata-name key with hyphens',
            snippet: {
                innerContent: 'my-foo: bar',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                '"my-foo": "bar",',
                '};',
            ],
        },
        {
            // The key starts with a digit — not a valid JS identifier — so
            // the `metadata` export quotes it.
            label: 'key with no valid identifier form',
            snippet: {
                innerContent: '"123abc": ok',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                '"123abc": "ok",',
                '};',
            ],
        },
        // The rows below cover the `charset` key. `<meta charset="…">`
        // carries its value in the `charset` attribute itself, not in a
        // separate `content="…"` attribute, so SvelTeX emits a dedicated
        // `{ charset: … }` entry rather than the regular `{ name: …,
        // content: … }` shape. Every input form that can name `charset`
        // — top level, `meta:` mapping, `meta:` array with `name:
        // charset` — must end up with the same `<meta charset="…">` tag.
        {
            label: 'charset (top level)',
            snippet: {
                innerContent: 'charset: utf-8',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta charset="utf-8">'],
            scriptModuleLines: [
                'export const metadata = {',
                'charset: "utf-8",',
                '};',
            ],
        },
        {
            label: 'charset (`meta:` mapping form)',
            snippet: {
                innerContent: 'meta:\n  charset: utf-8',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta charset="utf-8">'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"utf-8"}],',
                '};',
            ],
        },
        {
            label: 'charset (`meta:` array form, `name: charset`)',
            snippet: {
                innerContent: 'meta:\n- name: charset\n  content: utf-8',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta charset="utf-8">'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"utf-8"}],',
                '};',
            ],
        },
        {
            // An array value for `charset` is meaningless in HTML, but is
            // syntactically a valid frontmatter input — `addCharset`
            // joins it with `, ` for symmetry with `addMetaName`.
            label: 'charset (array value, joined)',
            snippet: {
                innerContent: 'meta:\n  charset:\n  - utf-8\n  - ascii',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta charset="utf-8, ascii">'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"utf-8, ascii"}],',
                '};',
            ],
        },
        {
            // Two `charset` entries — the second replaces the first
            // (with a warning) so there is exactly one `<meta charset>`.
            label: 'charset (duplicate, last wins)',
            snippet: {
                innerContent:
                    'meta:\n' +
                    '- name: charset\n' +
                    '  content: utf-8\n' +
                    '- name: charset\n' +
                    '  content: ascii',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta charset="ascii">'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"ascii"}],',
                '};',
            ],
        },
        {
            // Duplicate http-equiv inside the user's `meta:` block. The
            // user-only `frontmatter.meta` build deduplicates silently;
            // the rendered build then warns once (covered by the
            // "Duplicate meta http-equiv" expected log already exercised
            // by other rows). Exists to keep the `silent` branch of
            // `addMetaHttpEquiv` covered.
            label: 'http-equiv (duplicate in meta block, last wins)',
            snippet: {
                innerContent:
                    'meta:\n' +
                    '- http-equiv: default-style\n' +
                    '  content: alpha\n' +
                    '- http-equiv: default-style\n' +
                    '  content: beta',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta http-equiv="default-style" content="beta">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"http-equiv":"default-style","content":"beta"}],',
                '};',
            ],
        },
        {
            // Adding a meta name when `charset` is already present must
            // preserve the charset entry (and vice versa for http-equiv).
            label: 'charset preserved alongside a meta name',
            snippet: {
                innerContent: 'meta:\n  charset: utf-8\n  description: foo',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta charset="utf-8">',
                '<meta name="description" content="foo">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"utf-8"},{"name":"description","content":"foo"}],',
                '};',
            ],
        },
        {
            label: 'charset preserved alongside an http-equiv',
            snippet: {
                innerContent:
                    'meta:\n  charset: utf-8\n  default-style: foo',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [
                '<meta charset="utf-8">',
                '<meta http-equiv="default-style" content="foo">',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"utf-8"},{"http-equiv":"default-style","content":"foo"}],',
                '};',
            ],
        },
        // The rows below exercise the `frontmatter` configuration: each
        // disables one (or all) of the four processing steps. They use
        // frontmatter that *would* produce output for the disabled step, so
        // the empty result confirms the step really was skipped.
        {
            label: 'head disabled',
            snippet: {
                innerContent: 'title: My Title\nnoscript: enable JS',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: false,
                metadata: true,
                imports: true,
            },
            headLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                'title: "My Title",',
                'noscript: "enable JS",',
                '};',
            ],
        },
        {
            label: 'metadata disabled',
            snippet: {
                innerContent: 'title: My Title',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: true,
                metadata: false,
                imports: true,
            },
            headLines: ['<title>My Title</title>'],
            scriptModuleLines: [],
        },
        {
            // With `imports` off, the `imports` key is still included in
            // the `metadata` export, but no `import` statement is generated
            // from it.
            label: 'imports disabled',
            snippet: {
                innerContent: 'imports:\n  ./C.svelte: C',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: true,
                metadata: true,
                imports: false,
            },
            headLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                'imports: {"./C.svelte":"C"},',
                '};',
            ],
        },
        {
            label: 'all steps disabled (frontmatter: false)',
            snippet: {
                innerContent: 'title: My Title\nimports:\n  ./C.svelte: C',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: false,
                metadata: false,
                imports: false,
            },
            headLines: [],
            scriptModuleLines: [],
        },
    ] as {
        label?: string;
        snippet: ProcessableSnippet<'frontmatter'>;
        config?: FullFrontmatterConfiguration;
        headLines?: string[];
        scriptLines?: string[];
        scriptModuleLines?: string[];
    }[])(
        '$label',
        ({ snippet, config, headLines, scriptLines, scriptModuleLines }) => {
            expect(
                handleFrontmatter(
                    snippet,
                    config ?? {
                        head: true,
                        metadata: true,
                                imports: true,
                    },
                ),
            ).toMatchObject({
                headLines: headLines ?? [],
                scriptLines: scriptLines ?? [],
                scriptModuleLines: scriptModuleLines ?? [],
            });
        },
    );
});

describe('normalizeFrontmatterConfiguration()', () => {
    it.each([
        {
            label: 'true → every step enabled',
            input: true,
            expected: {
                head: true,
                metadata: true,
                imports: true,
            },
        },
        {
            label: 'false → every step disabled',
            input: false,
            expected: {
                head: false,
                metadata: false,
                imports: false,
            },
        },
        {
            label: 'object → returned unchanged',
            input: {
                head: false,
                metadata: true,
                imports: true,
            },
            expected: {
                head: false,
                metadata: true,
                imports: true,
            },
        },
    ] as {
        label: string;
        input: boolean | FullFrontmatterConfiguration;
        expected: FullFrontmatterConfiguration;
    }[])('$label', ({ input, expected }) => {
        expect(normalizeFrontmatterConfiguration(input)).toEqual(expected);
    });
});

