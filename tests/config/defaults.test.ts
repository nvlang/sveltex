import {
    describe,
    it,
    expect,
    vi,
    suite,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest';
import {
    getDefaultCodeConfiguration,
    getDefaultDvisvgmOptions,
    getDefaultTexComponentConfiguration,
    getDefaultAdvancedTexConfiguration,
} from '$config/defaults.js';
import path from 'node:path';
import os from 'node:os';
import { AdvancedTexHandler } from '$handlers/AdvancedTexHandler.js';
import { isTexComponentConfig } from '$type-guards/verbatim.js';
import { spy } from '$tests/fixtures.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

suite.concurrent('config/defaults', async () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });
    fixture();
    const { log } = await spy(['log']);

    describe('getDefaultTexComponentConfig', () => {
        fixture();
        it('should return a valid TexComponentConfig', () => {
            expect(typeof getDefaultTexComponentConfiguration('local')).toBe(
                'object',
            );
            expect(
                isTexComponentConfig(
                    getDefaultTexComponentConfiguration('local'),
                ),
            ).toBe(true);
        });
    });

    describe('getDefaultDvisvgmOptions()', () => {
        fixture();
        it('should be an object', () => {
            expect(typeof getDefaultDvisvgmOptions()).toBe('object');
        });
    });

    // defaultAdvancedTexConfiguration
    describe('getDefaultAdvancedTexConfiguration()', () => {
        fixture();
        it('should return an object', () => {
            expect(typeof getDefaultAdvancedTexConfiguration('local')).toBe(
                'object',
            );
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
            const config = getDefaultAdvancedTexConfiguration('local');
            expect(config.cacheDirectory).toBeDefined();
            expect(config.cacheDirectory).toEqual(
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
            const config = getDefaultAdvancedTexConfiguration('local');
            expect(config.cacheDirectory).toBeDefined();
            expect(config.cacheDirectory).toEqual(
                path.resolve(path.join(os.homedir(), '.cache'), 'sveltex'),
            );
            process.env['XDG_CACHE_HOME'] = originalXDGCacheHome;
        });
    });

    describe('defaultCodeConfiguration', () => {
        fixture();
        it('should be an object', () => {
            expect(typeof getDefaultCodeConfiguration('escapeOnly')).toBe(
                'object',
            );
        });

        it('should have wrapClassPrefix property', () => {
            expect(
                getDefaultCodeConfiguration('escapeOnly').wrapClassPrefix,
            ).toBeDefined();
            expect(
                typeof getDefaultCodeConfiguration('escapeOnly')
                    .wrapClassPrefix,
            ).toBe('string');
        });

        it('should have wrap property', () => {
            expect(
                getDefaultCodeConfiguration('escapeOnly').wrap,
            ).toBeDefined();
            expect(typeof getDefaultCodeConfiguration('escapeOnly').wrap).toBe(
                'function',
            );
        });

        it('should return correct wrapping elements for inline code', () => {
            const opts = {
                inline: true,
                lang: 'javascript',
                wrapClassPrefix: 'language-',
            };
            const [openingTag, closingTag] =
                getDefaultCodeConfiguration('escapeOnly').wrap(opts);
            expect(openingTag).toBe('<code class="language-javascript">');
            expect(closingTag).toBe('</code>');
        });

        it('should return correct wrapping elements for block code', () => {
            const opts = {
                inline: false,
                lang: 'typescript',
                wrapClassPrefix: 'language-',
            };
            const [openingTag, closingTag] =
                getDefaultCodeConfiguration('escapeOnly').wrap(opts);
            expect(openingTag).toBe('<pre><code class="language-typescript">');
            expect(closingTag).toBe('</code></pre>');
        });

        it('should return correct wrapping elements even if lang is undefined', () => {
            const opts = {
                inline: false,
                wrapClassPrefix: 'language-',
            };
            const [openingTag, closingTag] =
                getDefaultCodeConfiguration('escapeOnly').wrap(opts);
            expect(openingTag).toBe('<pre><code>');
            expect(closingTag).toBe('</code></pre>');
        });
    });

    describe('postprocess()', () => {
        fixture();
        it('should work', async () => {
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            expect(
                tc.configuration.postprocess(
                    '<svelte:component this={...} />',
                    tc,
                ),
            ).toEqual('<figure>\n<svelte:component this={...} />\n</figure>');
        });

        it('figure attributes', async () => {
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: {
                    ref: 'ref',
                    attr: 'something',
                    class: 'class-example',
                },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
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
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: {
                    ref: 'ref',
                    caption: 'example caption',
                },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
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
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: {
                    ref: 'ref',
                    caption: 'example caption',
                    fig_caption_class: 'class-example',
                    'figcaption:attr': 'something',
                },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
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
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: {
                    ref: 'ref',
                    class: 'class-example-figure',
                    caption: 'example caption',
                    fig_caption_class: 'class-example-figcaption',
                    'figcaption:attr': 'something',
                },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
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
        it('should complain if non-string attributes are passed', async () => {
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref', something: 123 as unknown as string },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
            });
            expect(tc.handledAttributes).toEqual({
                caption: undefined,
                captionAttributes: {},
                figureAttributes: {},
            });
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining('Expected string'),
            );
        });
        it('should handle attributes correctly', async () => {
            const attributes = {
                class: 'figure',
                id: 'figure-1',
                caption: 'This is a caption',
                'caption-style': 'italic',
                ref: 'figure-ref',
                preamble: '\\usepackage{amsmath}',
                documentclass: 'article',
            };
            const ath = await AdvancedTexHandler.create('local');
            const tc = ath.createTexComponent('test', {
                attributes: { ref: 'ref' },
                filename: 'test.sveltex',
                selfClosing: false,
                tag: 'tex',
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
});
