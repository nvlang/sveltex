import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    beforeAll,
    type MockInstance,
} from 'vitest';
import {
    getDefaultCodeConfig,
    getDefaultTexConfig,
    getDefaultVerbEnvConfig,
    sanitizePopplerSvgOptions,
    getTexPresetDefaults,
    getDefaultMarkdownConfig,
} from '$base/defaults.js';
import path from 'node:path';
import os from 'node:os';
import { TexHandler } from '$handlers/TexHandler.js';
import { verbatimTypes } from '$typeGuards/verbatim.js';
import { spy } from '$tests/unit/fixtures.js';
import { diagnoseVerbEnvConfig } from '$utils/diagnosers/verbatimEnvironmentConfiguration.js';
import type {
    FullVerbEnvConfigTex,
    VerbatimType,
} from '$types/handlers/Verbatim.js';
import { isCodeBackendWithCss } from '$typeGuards/code.js';
import { isPresentAndDefined } from '$typeGuards/utils.js';
import {
    codeBackends,
    markdownBackends,
} from '$utils/diagnosers/backendChoices.js';
import { is, typeAssert } from '$deps.js';
import type {
    CleanPopplerSvgOptions,
    PopplerSvgOptions,
} from '$types/utils/PopplerOptions.js';
import type { PropertiesDefined } from '$types/utils/utility-types.js';
import { fc, fuzzyTest } from '$dev_deps.js';
import { TexComponent } from '$utils/TexComponent.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe.concurrent('config/defaults', () => {
    let log: MockInstance;
    beforeAll(async () => {
        const mocks = await spy(['log']);
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    fixture();

    describe('getDefaultVerbEnvConfig()', () => {
        fixture();
        describe('returns valid VerbEnvConfig for known args', () => {
            describe.each(verbatimTypes)(
                'getDefaultVerbEnvConfig(%o)',
                (type) => {
                    const defaultVerbEnvConfig = getDefaultVerbEnvConfig(type);
                    it('passes diagnoser', () => {
                        expect(
                            diagnoseVerbEnvConfig(defaultVerbEnvConfig)
                                .problems,
                        ).toEqual(0);
                    });

                    if (type === 'tex') {
                        it('provides default for handleAttributes', async () => {
                            typeAssert(
                                is<FullVerbEnvConfigTex>(defaultVerbEnvConfig),
                            );
                            expect(
                                defaultVerbEnvConfig.handleAttributes,
                            ).toBeDefined();
                            const texHandler = await TexHandler.create();
                            const tc = TexComponent.create({
                                texHandler,
                                attributes: { ref: 'TexComponent_test_ref' },
                                filename: 'TexComponent_test_ts.sveltex',
                                tex: 'TexComponent.test.ts content',
                                tag: 'tex',
                                config: getDefaultVerbEnvConfig('tex'),
                            });

                            expect(
                                tc.configuration.overrides.conversion
                                    ?.converter,
                            ).toBeUndefined();
                            expect(tc.configuration.documentClass).toEqual({
                                name: 'standalone',
                                options: [],
                            });
                            tc.configuration.overrides.conversion = {
                                converter: 'poppler',
                            };
                            tc.configuration.documentClass = 'article';
                            expect(
                                tc.configuration.overrides.conversion.converter,
                            ).toEqual('poppler');
                            expect(tc.configuration.documentClass).toEqual(
                                'article',
                            );
                            const rv = defaultVerbEnvConfig.handleAttributes(
                                {
                                    engine: 'pdflatex',
                                    converter: undefined,
                                    documentClass: undefined,
                                },
                                tc,
                            );
                            expect(
                                tc.configuration.overrides.compilation?.engine,
                            ).toEqual('pdflatex');
                            expect(
                                tc.configuration.overrides.conversion.converter,
                            ).toEqual('dvisvgm');
                            expect(tc.configuration.documentClass).toEqual({
                                name: 'standalone',
                                options: [],
                            });
                            expect(rv).toEqual({
                                caption: undefined,
                                captionAttributes: {},
                                figureAttributes: {},
                            });
                        });
                    }
                },
            );
        });
        describe('throws error for unknown args', () => {
            it.each(['Tex', 'something'])(
                'getDefaultVerbEnvConfig(%o)',
                (type) => {
                    expect(() =>
                        getDefaultVerbEnvConfig(type as VerbatimType),
                    ).toThrowError();
                },
            );
        });
    });

    // defaultTexConfiguration
    describe('getDefaultTexConfiguration()', () => {
        fixture();
        it('should return an object', () => {
            expect(typeof getDefaultTexConfig()).toBe('object');
        });

        it('should have cacheDirectory set even if findCacheDirectory returns undefined', () => {
            vi.mock(
                'find-cache-dir',
                async (importOriginal: () => Promise<object>) => {
                    const actual = await importOriginal();
                    return {
                        ...actual,
                        default: () => undefined,
                    };
                },
            );
            const config = getDefaultTexConfig();
            expect(config.caching.cacheDirectory).toBeDefined();
            expect(config.caching.cacheDirectory).toEqual(
                path.resolve(
                    process.env['XDG_CACHE_HOME'] ??
                        path.join(os.homedir(), '.cache'),
                    'sveltex',
                ),
            );
        });

        it('should have cacheDirectory set even if findCacheDirectory returns undefined and $XDG_CACHE_HOME is not defined', () => {
            vi.mock(
                'find-cache-dir',
                async (importOriginal: () => Promise<object>) => {
                    const actual = await importOriginal();
                    return {
                        ...actual,
                        default: () => undefined,
                    };
                },
            );
            const originalXDGCacheHome = process.env['XDG_CACHE_HOME'];
            process.env['XDG_CACHE_HOME'] = undefined;
            const config = getDefaultTexConfig();
            expect(config.caching.cacheDirectory).toBeDefined();
            expect(config.caching.cacheDirectory).toEqual(
                path.resolve(path.join(os.homedir(), '.cache'), 'sveltex'),
            );
            process.env['XDG_CACHE_HOME'] = originalXDGCacheHome;
        });
    });

    describe('defaultCodeConfiguration()', () => {
        fixture();
        describe.each(codeBackends)('%s', (backend) => {
            it('should return an object', () => {
                expect(typeof getDefaultCodeConfig(backend)).toBe('object');
            });

            it('should have addLanguageClass property', () => {
                expect(
                    getDefaultCodeConfig(backend).addLanguageClass,
                ).toBeDefined();
                expect(
                    typeof getDefaultCodeConfig(backend).addLanguageClass,
                ).toMatch(/string|boolean/);
            });

            if (isCodeBackendWithCss(backend)) {
                describe('should have customProcess property', () => {
                    it('should have theme property', () => {
                        expect(
                            isPresentAndDefined(
                                getDefaultCodeConfig(backend),
                                'theme',
                            ),
                        ).toBeTruthy();
                    });
                    it.each(['cdn', 'dir', 'name', 'type', 'timeout'])(
                        'should have theme.%s property',
                        (prop) => {
                            expect(
                                isPresentAndDefined(
                                    getDefaultCodeConfig(backend).theme,
                                    prop,
                                ),
                            ).toBeTruthy();
                        },
                    );
                });
            }
        });
    });

    describe('postprocess()', () => {
        fixture();
        it('should work', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual('<figure>\n<svelte:component this={...} />\n</figure>');
        });

        it('figure attributes', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: {
                    ref: 'ref',
                    attr: 'something',
                    class: 'class-example',
                },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref" attr="something" class="class-example">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual(
                '<figure attr="something" class="class-example">\n<svelte:component this={...} />\n</figure>',
            );
        });

        it('figure caption', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: {
                    ref: 'ref',
                    caption: 'example caption',
                },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref" caption="example caption">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual(
                '<figure>\n<svelte:component this={...} />\n<figcaption>example caption</figcaption>\n</figure>',
            );
        });

        it('figure caption attributes', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: {
                    ref: 'ref',
                    caption: 'example caption',
                    fig_caption_class: 'class-example',
                    'figcaption:attr': 'something',
                },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref" caption="example caption" fig_caption_class="class-example" figcaption:attr="something">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual(
                '<figure>\n<svelte:component this={...} />\n<figcaption class="class-example" attr="something">example caption</figcaption>\n</figure>',
            );
        });

        it('figure attributes + caption attributes', async () => {
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: {
                    ref: 'ref',
                    class: 'class-example-figure',
                    caption: 'example caption',
                    fig_caption_class: 'class-example-figcaption',
                    'figcaption:attr': 'something',
                },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref" class="class-example-figure" caption="example caption" fig_caption_class="class-example" figcaption:attr="something">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual(
                '<figure class="class-example-figure">\n<svelte:component this={...} />\n<figcaption class="class-example-figcaption" attr="something">example caption</figcaption>\n</figure>',
            );
        });
    });

    describe('handleAttributes', () => {
        fixture();
        it('should handle attributes correctly', async () => {
            const attributes = {
                class: 'figure',
                id: 'figure-1',
                caption: 'This is a caption',
                'caption-style': 'italic',
                ref: 'figure-ref',
                preamble: '\\usepackage{amsmath}',
                documentClass: 'article',
            };
            const texHandler = await TexHandler.create();
            const tc = TexComponent.create({
                texHandler,
                tex: 'test',
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                tag: 'tex',
                // outerContent: '<tex ref="ref">test</tex>',
                config: getDefaultVerbEnvConfig('tex'),
            });

            const { caption, figureAttributes, captionAttributes } =
                tc.handleAttributes(attributes);

            expect(caption).toBe('This is a caption');
            expect(figureAttributes).toEqual({
                class: 'figure',
                id: 'figure-1',
            });
            expect(captionAttributes).toEqual({
                style: 'italic',
            });
            expect(tc.configuration.preamble).toBe('\\usepackage{amsmath}');
            expect(tc.configuration.documentClass).toBe('article');
        });
    });

    describe('sanitizePopplerSvgOptions()', () => {
        it.each([
            [{}, { svgFile: true }],
            [{ antialias: null }, { svgFile: true }],
            [{ antialias: 'default' }, { antialias: 'default', svgFile: true }],
            [{ antialias: 'best' }, { antialias: 'best', svgFile: true }],
        ] as [
            PropertiesDefined<PopplerSvgOptions>,
            CleanPopplerSvgOptions & {
                svgFile: true;
            },
        ][])('%o → %o', (input, expected) => {
            expect(sanitizePopplerSvgOptions(input)).toEqual(expected);
        });
    });

    describe('getTexPresetDefaults()', () => {
        it('tikz', () => {
            expect(getTexPresetDefaults('tikz')).toMatchObject({
                name: 'tikz',
                libraries: {
                    babel: true,
                    arrows: { meta: true },
                    calc: true,
                },
            });
        });
    });
});

/* -------------------------------------------------------------------------- */
/*                            Overly specific tests                           */
/* -------------------------------------------------------------------------- */

describe('prefersInline is () => true by default', () => {
    describe.each(markdownBackends)('%s', (backend) => {
        fuzzyTest.prop([fc.string()])('arbitrary input string', (input) => {
            expect(getDefaultMarkdownConfig(backend).prefersInline(input)).toBe(
                true,
            );
        });
    });
});
