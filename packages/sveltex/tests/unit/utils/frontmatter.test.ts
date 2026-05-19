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
    keyToIdentifier,
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
        [
            { author: 'Jane Doe' },
            {
                author: 'Jane Doe',
                meta: [{ name: 'author', content: 'Jane Doe' }],
            },
        ],
        [
            { description: '...' },
            {
                description: '...',
                meta: [{ name: 'description', content: '...' }],
            },
        ],
        // `charset` produces the dedicated `{ charset: … }` shape rather
        // than `{ name: 'charset', content: … }` — see the comment on the
        // top-level `charset` branch in `interpretFrontmatter`.
        [
            { charset: 'utf-8' },
            { charset: 'utf-8', meta: [{ charset: 'utf-8' }] },
        ],
        [
            { meta: [{ name: 'charset', content: 'utf-8' }] },
            { meta: [{ charset: 'utf-8' }] },
        ],
        [
            { meta: { charset: 'utf-8' } } as unknown as Frontmatter,
            { meta: [{ charset: 'utf-8' }] },
        ],
        [
            {
                description: '...',
                meta: [{ name: 'keywords', content: 'a, b, c' }],
            },
            {
                description: '...',
                meta: [
                    { name: 'description', content: '...' },
                    { name: 'keywords', content: 'a, b, c' },
                ],
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
            expect(interpretFrontmatter(input)).toEqual(expected ?? input);
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
            scriptLines: [],
            scriptModuleLines: [],
        },
        {
            label: 'foo: bar',
            snippet: {
                innerContent: 'foo: bar',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptLines: ['const foo = "bar";'],
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
            scriptLines: [
                'const base = {"href":"https://example.com","target":"_blank"};',
            ],
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
            scriptLines: ['const base = {"href":"https://example.com"};'],
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
            scriptLines: ['const base = {"href":"https://example.com"};'],
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
            scriptLines: ['const base = {"target":"_blank"};'],
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
            scriptLines: [
                'const author = "...";',
                'const meta = [{"name":"author","content":"Jane Doe"},{"name":"description","content":"..."},{"http-equiv":"default-style","content":"styles.css"}];',
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
            scriptLines: [
                'const author = "...";',
                'const meta = [{"name":"author","content":"Jane Doe"}];',
            ],
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
            scriptLines: [],
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
            scriptLines: [
                'const meta = [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"a, b"}];',
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
            scriptLines: [
                'const meta = [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"a, b"}];',
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
            scriptLines: [
                'const meta = [{"name":"description","content":"This is a test page."},{"name":"keywords","content":"c, d"}];',
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
            scriptLines: [
                'const title = "...";',
                'const link = [{"rel":"stylesheet","href":"styles.css"},{"rel":"stylesheet","href":"styles2.css"}];',
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
            scriptLines: ['const noscript = "...";'],
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
            scriptLines: [
                'const meta = [{"http-equiv":"default-style","content":"a, b"}];',
            ],
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
                'const imports = {"$lib/utils.js":["b","c"],"./Something.svelte":"Something"};',
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
            scriptLines: [],
            scriptModuleLines: [],
        },
        // The rows below cover non-identifier keys: the metadata-name keys
        // SvelTeX accepts at the top level have hyphens (`color-scheme`,
        // `theme-color`, …), and a user may write any string. Such keys
        // become quoted object keys in the `metadata` export and camelCased
        // variable names in the instance script; keys that can't form a
        // valid identifier at all are dropped from the variables step
        // (still present in `metadata`).
        {
            label: 'metadata-name key with hyphens (top level)',
            snippet: {
                innerContent: 'color-scheme: dark',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: ['<meta name="color-scheme" content="dark">'],
            scriptLines: [
                'const colorScheme = "dark";',
                'const meta = [{"name":"color-scheme","content":"dark"}];',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                '"color-scheme": "dark",',
                'meta: [{"name":"color-scheme","content":"dark"}],',
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
            scriptLines: ['const myFoo = "bar";'],
            scriptModuleLines: [
                'export const metadata = {',
                '"my-foo": "bar",',
                '};',
            ],
        },
        {
            // The key starts with a digit, so even after camelCasing it
            // cannot be a valid identifier. The variable is silently
            // dropped; the `metadata` export still carries the key, quoted.
            label: 'key with no valid identifier form',
            snippet: {
                innerContent: '"123abc": ok',
                optionsForProcessor: { type: 'yaml' },
            },
            headLines: [],
            scriptLines: [],
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
            scriptLines: [
                'const charset = "utf-8";',
                'const meta = [{"charset":"utf-8"}];',
            ],
            scriptModuleLines: [
                'export const metadata = {',
                'charset: "utf-8",',
                'meta: [{"charset":"utf-8"}],',
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
            scriptLines: ['const meta = [{"charset":"utf-8"}];'],
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
            scriptLines: ['const meta = [{"charset":"utf-8"}];'],
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
            scriptLines: ['const meta = [{"charset":"utf-8, ascii"}];'],
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
            scriptLines: ['const meta = [{"charset":"ascii"}];'],
            scriptModuleLines: [
                'export const metadata = {',
                'meta: [{"charset":"ascii"}],',
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
            scriptLines: [
                'const meta = [{"charset":"utf-8"},{"name":"description","content":"foo"}];',
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
            scriptLines: [
                'const meta = [{"charset":"utf-8"},{"http-equiv":"default-style","content":"foo"}];',
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
                variables: true,
                imports: true,
            },
            headLines: [],
            scriptLines: [
                'const title = "My Title";',
                'const noscript = "enable JS";',
            ],
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
                variables: true,
                imports: true,
            },
            headLines: ['<title>My Title</title>'],
            scriptLines: ['const title = "My Title";'],
            scriptModuleLines: [],
        },
        {
            label: 'variables disabled',
            snippet: {
                innerContent: 'title: My Title',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: true,
                metadata: true,
                variables: false,
                imports: true,
            },
            headLines: ['<title>My Title</title>'],
            scriptLines: [],
            scriptModuleLines: [
                'export const metadata = {',
                'title: "My Title",',
                '};',
            ],
        },
        {
            // With `variables` off but `imports` on, only the `import`
            // statement is emitted — not the `const imports = ...` line.
            label: 'variables disabled, imports kept',
            snippet: {
                innerContent: 'imports:\n  ./C.svelte: C',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: true,
                metadata: true,
                variables: false,
                imports: true,
            },
            headLines: [],
            scriptLines: ["import C from './C.svelte';"],
            scriptModuleLines: [
                'export const metadata = {',
                'imports: {"./C.svelte":"C"},',
                '};',
            ],
        },
        {
            // With `imports` off, the `imports` key is still treated as an
            // ordinary frontmatter value (hence the `const`/metadata entry),
            // but no `import` statement is generated from it.
            label: 'imports disabled',
            snippet: {
                innerContent: 'imports:\n  ./C.svelte: C',
                optionsForProcessor: { type: 'yaml' },
            },
            config: {
                head: true,
                metadata: true,
                variables: true,
                imports: false,
            },
            headLines: [],
            scriptLines: ['const imports = {"./C.svelte":"C"};'],
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
                variables: false,
                imports: false,
            },
            headLines: [],
            scriptLines: [],
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
                        variables: true,
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
                variables: true,
                imports: true,
            },
        },
        {
            label: 'false → every step disabled',
            input: false,
            expected: {
                head: false,
                metadata: false,
                variables: false,
                imports: false,
            },
        },
        {
            label: 'object → returned unchanged',
            input: {
                head: false,
                metadata: true,
                variables: false,
                imports: true,
            },
            expected: {
                head: false,
                metadata: true,
                variables: false,
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

describe('keyToIdentifier()', () => {
    it.each([
        // Already a valid identifier — kept verbatim.
        { label: 'plain identifier', input: 'foo', expected: 'foo' },
        { label: 'with underscore', input: 'foo_bar', expected: 'foo_bar' },
        { label: 'with $', input: '$foo', expected: '$foo' },
        // Camel-cased on word boundaries — the metadata-name shape.
        {
            label: 'hyphenated',
            input: 'color-scheme',
            expected: 'colorScheme',
        },
        {
            label: 'multi-hyphenated',
            input: 'content-security-policy',
            expected: 'contentSecurityPolicy',
        },
        { label: 'space-separated', input: 'my key', expected: 'myKey' },
        { label: 'dot-separated', input: 'foo.bar', expected: 'fooBar' },
        // No valid identifier can be formed.
        { label: 'leading digit', input: '123abc', expected: undefined },
        {
            label: 'only non-identifier characters',
            input: '---',
            expected: undefined,
        },
        { label: 'empty string', input: '', expected: undefined },
        // Reserved words are syntactically valid identifiers but can't be
        // bound names in strict mode (which Svelte components run as).
        { label: 'reserved word verbatim', input: 'class', expected: undefined },
        {
            label: 'camel-cased to a reserved word',
            input: 'class-',
            expected: undefined,
        },
    ] as { label: string; input: string; expected: string | undefined }[])(
        '$label: $input',
        ({ input, expected }) => {
            expect(keyToIdentifier(input)).toBe(expected);
        },
    );
});
