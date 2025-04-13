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
    parseFrontmatter,
} from '../../../src/utils/frontmatter.js';
import type { Frontmatter } from '../../../src/types/utils/Frontmatter.js';
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
                    { name: 'charset', content: 'utf-8' },
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
    ] as {
        label?: string;
        snippet: ProcessableSnippet<'frontmatter'>;
        headLines?: string[];
        scriptLines?: string[];
        scriptModuleLines?: string[];
    }[])('$label', ({ snippet, headLines, scriptLines, scriptModuleLines }) => {
        expect(handleFrontmatter(snippet)).toMatchObject({
            headLines: headLines ?? [],
            scriptLines: scriptLines ?? [],
            scriptModuleLines: scriptModuleLines ?? [],
        });
    });
});
