import { describe, test, expect, vi } from 'vitest';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';
import { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
import { codeBackends } from '$utils/diagnosers/backendChoices.js';
import { getDefaultCodeConfig } from '$config/defaults.js';
import { nodeAssert } from '$deps.js';
import { isFunction, isString } from '$type-guards/utils.js';
import { mergeConfigs } from '$utils/merge.js';
import { bundledLanguages, bundledThemes } from 'shiki';

import { fuzzyTest, fc } from '$dev_deps.js';
import { escapeStringForRegExp } from '$utils/escape.js';
import type { Transformer } from '$types/handlers/Handler.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

describe('CodeHandler.create', () => {
    describe.each(
        codeBackends.flatMap((backend) => [
            [backend, '{}', {}],
            [
                backend,
                'config',
                {
                    addLanguageClass: 'something',
                    appendNewline: false,
                    transformers: {
                        post: [() => '', ['a', 'b'], [/a/, 'b']],
                        pre: [/a/, 'b'],
                    },
                } as CodeConfiguration<CodeBackend>,
            ],
        ]) as [CodeBackend, string, CodeConfiguration<CodeBackend>][],
    )('(%o, %s) → [object Object]', (backend, _configStr, config) => {
        test(`_premise_`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler).toBeDefined();
            expect(handler).toBeTypeOf('object');
        });
        // Vite needs stuff to be serializable (i.e., "JSON.stringify-able").
        test(`_serializable_`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler).toBeDefined();
            expect(() => JSON.stringify(handler)).not.toThrow();
            expect(JSON.stringify(handler)).not.toMatch(/circular|circle/i);
        });
        test(`.backend → '${backend}'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.backend).toEqual(backend);
        });
        const configIsEmpty = Object.entries(config).length === 0;
        test(
            `.configuration → ` +
                (configIsEmpty ? `default` : `mergeConfigs(default, config)`),
            async () => {
                const handler = await CodeHandler.create(backend, config);
                const expected = mergeConfigs(
                    getDefaultCodeConfig(backend),
                    config,
                );
                Object.entries(handler.configuration).forEach(
                    ([key, value]) => {
                        if (isFunction(value)) {
                            const defaultFunction =
                                expected[key as keyof typeof expected];
                            nodeAssert(isFunction(defaultFunction));
                            expect(value.toString()).toEqual(
                                defaultFunction.toString(),
                            );
                        } else {
                            expect(value).toEqual(
                                expected[key as keyof typeof expected],
                            );
                        }
                    },
                );
            },
        );
        test(`typeof .configure → 'function'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.configure).toBeTypeOf('function');
        });
        test(`typeof .process → 'function'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.process).toBeTypeOf('function');
        });
        test(`typeof .processor → 'object'`, async () => {
            const handler = await CodeHandler.create(backend, config);
            expect(handler.processor).toBeTypeOf('object');
        });
    });
});

describe.concurrent.each(codeBackends)('CodeHandler<%o>', (backend) => {
    describe('.process', () => {
        describe.each([['', {}]])('(%o) → ParsedSnippet', (input, opts) => {
            test(`_premise_`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process(input, opts);
                expect(output).toBeDefined();
                expect(output).toBeTypeOf('object');
            });
            test(`typeof .processed → 'string'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process(input, opts);
                expect(output.processed).toBeDefined();
                expect(output.processed).toBeTypeOf('string');
            });
            test(`typeof .unescapeOptions → 'object'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process('let a');
                expect(output.unescapeOptions).toBeTypeOf('object');
            });
            test(`typeof .unescapeOptions.removeParagraphTag → 'boolean'`, async () => {
                const handler = await CodeHandler.create(backend, {});
                const output = await handler.process('let a');
                expect(output.unescapeOptions.removeParagraphTag).toBeTypeOf(
                    'boolean',
                );
            });
            if (backend === 'none') {
                test(`.processed → ''`, async () => {
                    const handler = await CodeHandler.create(backend, {});
                    const output = await handler.process(input, opts);
                    expect(output.processed).toEqual('');
                });
            } else {
                test(`.processed → '<pre...><code...>...</code...></pre>'`, async () => {
                    const handler = await CodeHandler.create(backend, {});
                    const output = await handler.process(input, opts);
                    expect(output.processed).toMatch(
                        /^<pre[^>]*?><code[^>]*?>.*<\/code[^>]*?><\/pre[^>]*?>/s,
                    );
                });
            }
        });
        if (backend !== 'none') {
            describe('features', () => {
                describe('addLanguageClass', () => {
                    test.each([true, false, 'something-', ''])(
                        '%o',
                        async (addLanguageClass) => {
                            const handler = await CodeHandler.create(backend, {
                                addLanguageClass,
                            });
                            const output = await handler.process('let a;', {
                                lang: 'js',
                            });
                            if (addLanguageClass === true) {
                                expect(output.processed).toContain(
                                    'class="language-js"',
                                );
                            } else if (isString(addLanguageClass)) {
                                expect(output.processed).toContain(
                                    `class="${addLanguageClass}js"`,
                                );
                            } else {
                                expect(output.processed).not.toMatch(
                                    /class=".*(js|javascript)("| .*")/,
                                );
                            }
                        },
                    );
                });
                if (backend === 'shiki') {
                    describe('theme', () => {
                        fuzzyTest.concurrent.prop(
                            [
                                fc.constantFrom(...Object.keys(bundledThemes)),
                                fc.constantFrom(
                                    ...Object.keys(bundledLanguages),
                                ),
                                fc.fullUnicodeString({ minLength: 1 }),
                                fc.boolean(),
                            ],
                            { errorWithCause: true, verbose: 2 },
                        )(
                            'fuzzy: (theme, lang, inline, code)',
                            async (theme, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        shiki: { theme },
                                    },
                                );
                                const output = await handler.process(code, {
                                    inline,
                                    lang,
                                });
                                expect(output).toBeDefined();
                                let pre;
                                if (inline) {
                                    pre = `<code class="language-${escapeStringForRegExp(lang)} `;
                                } else {
                                    pre = `<pre class="`;
                                }
                                expect(output.processed).toMatch(
                                    new RegExp(`^${pre}shiki ${theme}`),
                                );
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            },
                        );
                    });
                    describe('themes', () => {
                        fuzzyTest.concurrent.prop(
                            [
                                fc.constantFrom(...Object.keys(bundledThemes)),
                                fc.dictionary(
                                    fc.stringMatching(/^[\w-]+$/),
                                    fc.constantFrom(
                                        ...Object.keys(bundledThemes),
                                    ),
                                    { maxKeys: 5, minKeys: 1 },
                                ),
                                fc.constantFrom(
                                    ...Object.keys(bundledLanguages),
                                ),
                                fc.fullUnicodeString({ minLength: 1 }),
                                fc.boolean(),
                            ],
                            { errorWithCause: true, verbose: 2 },
                        )(
                            'fuzzy: (themes, lang, inline, code)',
                            async (light, otherThemes, lang, code, inline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        shiki: {
                                            themes: {
                                                light,
                                                ...otherThemes,
                                            },
                                        },
                                    },
                                );
                                const output = await handler.process(code, {
                                    inline,
                                    lang,
                                });
                                expect(output).toBeDefined();
                                const str = Object.values(otherThemes)
                                    .map(escapeStringForRegExp)
                                    .join(' ');
                                let pre;
                                if (inline) {
                                    pre = `<code class="language-${escapeStringForRegExp(lang)} `;
                                } else {
                                    pre = `<pre class="`;
                                }
                                expect(output.processed).toMatch(
                                    new RegExp(
                                        `^${pre}shiki shiki-themes ${light}${str ? ' ' + str : ''}`,
                                    ),
                                );
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            },
                        );
                    });
                }
                if (backend !== 'escapeOnly') {
                    describe('inline syntax highlighting', () => {
                        test('w/ language flag set internally', async () => {
                            type PossibleBackend = typeof backend;
                            let handler: CodeHandler<typeof backend>;
                            if (backend === 'shiki') {
                                handler = (await CodeHandler.create(backend, {
                                    shiki: { theme: 'github-light' },
                                })) as CodeHandler<PossibleBackend>;
                            } else {
                                handler = (await CodeHandler.create(backend, {
                                    theme: { type: 'none' },
                                    ...(backend === 'starry-night'
                                        ? { languages: 'common' }
                                        : {}),
                                })) as CodeHandler<PossibleBackend>;
                            }
                            const output = await handler.process(
                                'const x = 3;',
                                {
                                    inline: true,
                                    lang: 'js',
                                },
                            );
                            expect(output).toBeDefined();
                            if (backend === 'shiki') {
                                expect(output.processed).toContain(
                                    '<span style="color:',
                                );
                            } else {
                                expect(output.processed).toContain(
                                    '<span class=',
                                );
                            }
                        });
                        test.each([
                            'js',
                            '{js}',
                            '{js a b=false c}',
                            'someAlias',
                        ])(
                            'w/ language flag set ad hoc (`%s ...`)',
                            async (str) => {
                                type PossibleBackend = typeof backend;
                                let handler: CodeHandler<typeof backend>;
                                if (backend === 'shiki') {
                                    handler = (await CodeHandler.create(
                                        backend,
                                        {
                                            shiki: { theme: 'github-light' },
                                            langAlias: {
                                                someAlias: 'javascript',
                                            },
                                        },
                                    )) as CodeHandler<PossibleBackend>;
                                } else {
                                    handler = (await CodeHandler.create(
                                        backend,
                                        {
                                            theme: { type: 'none' },
                                            langAlias: {
                                                someAlias: 'javascript',
                                            },
                                            ...(backend === 'starry-night'
                                                ? { languages: 'common' }
                                                : {}),
                                        },
                                    )) as CodeHandler<PossibleBackend>;
                                }

                                const output = await handler.process(
                                    `${str} const x = 3;`,
                                    { inline: true },
                                );
                                expect(output).toBeDefined();
                                if (backend === 'shiki') {
                                    expect(output.processed).toContain(
                                        '<span style="color:',
                                    );
                                } else {
                                    expect(output.processed).toContain(
                                        '<span class=',
                                    );
                                }
                            },
                        );
                    });
                }
                describe('appendNewline', () => {
                    test.each([
                        [true, 'appends \\n'],
                        [false, "doesn't append \\n"],
                    ])('%o → %s', async (appendNewline) => {
                        const handler = await CodeHandler.create(backend, {
                            appendNewline,
                            ...(backend === 'starry-night' ||
                            backend === 'highlight.js'
                                ? { theme: { type: 'none' } }
                                : {}),
                        });
                        const output = await handler.process('const x = 3;', {
                            inline: false,
                        });
                        if (appendNewline) {
                            expect(output.processed).toContain('\n');
                        } else {
                            expect(output.processed).not.toContain('\n');
                        }
                    });
                    if (
                        backend === 'starry-night' ||
                        backend === 'highlight.js' ||
                        backend === 'escapeOnly'
                    ) {
                        test.each([true, false])(
                            '%o → empty string stays empty',
                            async (appendNewline) => {
                                const handler = await CodeHandler.create(
                                    backend,
                                    {
                                        appendNewline,
                                        ...(backend === 'starry-night' ||
                                        backend === 'highlight.js'
                                            ? { theme: { type: 'none' } }
                                            : {}),
                                    },
                                );
                                expect(
                                    (
                                        await handler.process('', {
                                            inline: true,
                                        })
                                    ).processed,
                                ).toMatch(
                                    /^<code[^>]*?>(<span><\/span>)?<\/code>$/su,
                                );
                                expect(
                                    (
                                        await handler.process('', {
                                            inline: false,
                                        })
                                    ).processed,
                                ).toMatch(
                                    /^<pre[^>]*?><code[^>]*?>(<span><\/span>)?<\/code><\/pre>$/su,
                                );
                            },
                        );
                    }
                });
            });
        }
    });
});

describe('misc', () => {
    describe('configuration getter & setter', () => {
        test('inlineMeta', async () => {
            const handler = await CodeHandler.create('none', {});
            expect(handler.configuration.inlineMeta).toBeTypeOf('function');
            expect(
                handler.configuration.inlineMeta('js let a;', () => true),
            ).toEqual({ code: 'let a;', lang: 'js', meta: undefined });
            await handler.configure({ inlineMeta: null });
            expect(handler.configuration.inlineMeta).not.toEqual(null);
            expect(handler.configuration.inlineMeta).toBeTypeOf('function');
            expect(
                handler.configuration.inlineMeta('js let a;', () => true),
            ).toBeUndefined();
        });
        test('parseMetaString', async () => {
            const handler = await CodeHandler.create('shiki', {});
            expect(handler.configuration.parseMetaString).toBeTypeOf(
                'function',
            );
            await handler.configure({ parseMetaString: null });
            expect(handler.configuration.parseMetaString).not.toEqual(null);
            expect(handler.configuration.parseMetaString).toBeTypeOf(
                'function',
            );
        });
        test('transformers', async () => {
            const pre: Transformer = ['a', 'b'];
            const post: Transformer = ['c', 'd'];
            const handler = await CodeHandler.create('none', {
                transformers: { pre, post },
            });
            expect(handler.configuration.transformers.pre).toEqual(pre);
            expect(handler.configuration.transformers.post).toEqual(post);
            expect(handler.configuration.transformers).not.toBe(pre);
            expect(handler.configuration.transformers).not.toBe(post);

            await handler.configure({
                transformers: { pre: undefined, post: undefined },
            });
            expect(pre).toEqual(['a', 'b']);
            expect(post).toEqual(['c', 'd']);
            expect(handler.configuration.transformers.pre).toEqual(pre);
            expect(handler.configuration.transformers.post).toEqual(post);
            expect(handler.configuration.transformers).not.toBe(pre);
            expect(handler.configuration.transformers).not.toBe(post);

            await handler.configure({
                transformers: { pre: null, post: null },
            });
            expect(pre).toEqual(['a', 'b']);
            expect(post).toEqual(['c', 'd']);
            expect(handler.configuration.transformers.pre).toEqual([]);
            expect(handler.configuration.transformers.post).toEqual([]);

            await handler.configure({
                transformers: { pre, post },
            });
            expect(pre).toEqual(['a', 'b']);
            expect(post).toEqual(['c', 'd']);
            expect(handler.configuration.transformers.pre).toEqual(pre);
            expect(handler.configuration.transformers.post).toEqual(post);
            expect(handler.configuration.transformers).not.toBe(pre);
            expect(handler.configuration.transformers).not.toBe(post);

            await handler.configure({ transformers: { pre: [], post: [] } });
            expect(pre).toEqual(['a', 'b']);
            expect(post).toEqual(['c', 'd']);
            expect(handler.configuration.transformers.pre).toEqual([]);
            expect(handler.configuration.transformers.post).toEqual([]);
        });
    });
});
