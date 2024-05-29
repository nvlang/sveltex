import { describe, test, expect, vi } from 'vitest';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { consoles } from '$utils/debug.js';
import { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
import { codeBackends } from '$utils/diagnosers/backendChoices.js';
import { getDefaultCodeConfig } from '$config/defaults.js';
import { nodeAssert } from '$deps.js';
import { isFunction } from '$type-guards/utils.js';
import { mergeConfigs } from '$utils/merge.js';
import { bundledThemes } from 'shiki';

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

describe.each(codeBackends)('CodeHandler<%o>', (backend) => {
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
        if (backend === 'shiki') {
            describe('features', () => {
                describe('theme', () => {
                    describe.each(Object.keys(bundledThemes))('%o', (theme) => {
                        test('block', async () => {
                            const handler = await CodeHandler.create(backend, {
                                shiki: { theme },
                            });
                            const output = await handler.process('');
                            expect(output).toBeDefined();
                            expect(output.processed).toMatch(
                                new RegExp(`^<pre class="shiki ${theme}"`),
                            );
                        });
                        test('inline', async () => {
                            const handler = await CodeHandler.create(backend, {
                                shiki: { theme },
                            });
                            const output = await handler.process('', {
                                inline: true,
                            });
                            expect(output).toBeDefined();
                            expect(output.processed).toMatch(
                                new RegExp(
                                    `^<code class="language-plaintext shiki ${theme}"`,
                                ),
                            );
                        });
                    });
                });
                describe('themes', () => {
                    test('block', async () => {
                        const handler = await CodeHandler.create(backend, {
                            shiki: {
                                themes: {
                                    test: 'andromeeda',
                                    light: 'github-light',
                                    dark: 'github-dark',
                                },
                            },
                        });
                        const output = await handler.process('const x = 0;', {
                            lang: 'js',
                        });
                        expect(output).toBeDefined();
                        expect(output.processed).toMatch(
                            new RegExp(`^<pre class="shiki shiki-themes "`),
                        );
                    });
                    test('inline', async () => {
                        const handler = await CodeHandler.create(backend, {
                            shiki: {
                                themes: {
                                    light: 'github-light',
                                    dark: 'github-dark',
                                },
                            },
                        });
                        const output = await handler.process('', {
                            inline: true,
                        });
                        expect(output).toBeDefined();
                        expect(output.processed).toMatch(
                            new RegExp(`^<pre class="shiki  "`),
                        );
                    });
                });
                describe('inline syntax highlighting', () => {
                    test('works', async () => {
                        const handler = await CodeHandler.create(backend, {
                            shiki: {
                                themes: {
                                    light: 'github-light',
                                    dark: 'github-dark',
                                },
                            },
                        });
                        const output = await handler.process('const x = 3;', {
                            inline: true,
                            lang: 'js',
                        });
                        expect(output).toBeDefined();
                        expect(output.processed).toContain('<span style=');
                    });
                });
            });
        }
    });
});
