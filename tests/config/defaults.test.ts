import { describe, it, expect, vi } from 'vitest';
import {
    defaultAdvancedTexConfiguration,
    defaultCodeConfiguration,
    defaultDvisvgmOptions,
    defaultSveltexConfig,
    defaultTexComponentConfig,
    nullCodeConfiguration,
} from '$config/defaults.js';
import path from 'node:path';
import os from 'node:os';

describe('defaultDvisvgmOptions', () => {
    it('should be an object', () => {
        expect(typeof defaultDvisvgmOptions).toBe('object');
    });
});

// defaultAdvancedTexConfiguration
describe('defaultAdvancedTexConfiguration', () => {
    it('should be an object', () => {
        expect(typeof defaultAdvancedTexConfiguration).toBe('object');
    });

    it('should set cacheDirectory even if findCacheDirectory returns undefined', () => {
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
        const config = defaultAdvancedTexConfiguration;
        expect(config.local.cacheDirectory).toBeDefined();
        expect(config.local.cacheDirectory).toEqual(
            path.resolve(
                process.env['XDG_CACHE_HOME'] ??
                    path.join(os.homedir(), '.cache'),
                'sveltex',
            ),
        );
    });

    it('should set cacheDirectory even if findCacheDirectory returns undefined and $XDG_CACHE_HOME is not defined', () => {
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
        const config = defaultAdvancedTexConfiguration;
        expect(config.local.cacheDirectory).toBeDefined();
        expect(config.local.cacheDirectory).toEqual(
            path.resolve(path.join(os.homedir(), '.cache'), 'sveltex'),
        );
        process.env['XDG_CACHE_HOME'] = originalXDGCacheHome;
    });
});

// defaultTexComponentConfig
describe('defaultTexComponentConfig', () => {
    it('should be an object', () => {
        expect(typeof defaultTexComponentConfig).toBe('object');
    });
});

//defaultSveltexConfig
describe('defaultSveltexConfig', () => {
    it('should be an object', () => {
        expect(typeof defaultSveltexConfig).toBe('object');
    });
});

describe('defaultCodeConfiguration', () => {
    it('should be an object', () => {
        expect(typeof defaultCodeConfiguration).toBe('object');
    });

    it('should have wrapClassPrefix property', () => {
        expect(defaultCodeConfiguration.wrapClassPrefix).toBeDefined();
        expect(typeof defaultCodeConfiguration.wrapClassPrefix).toBe('string');
    });

    it('should have wrap property', () => {
        expect(defaultCodeConfiguration.wrap).toBeDefined();
        expect(typeof defaultCodeConfiguration.wrap).toBe('function');
    });

    it('should return correct wrapping elements for inline code', () => {
        const opts = {
            inline: true,
            lang: 'javascript',
            wrapClassPrefix: 'language-',
        };
        const [openingTag, closingTag] = defaultCodeConfiguration.wrap(opts);
        expect(openingTag).toBe('<code class="language-javascript">');
        expect(closingTag).toBe('</code>');
    });

    it('should return correct wrapping elements for block code', () => {
        const opts = {
            inline: false,
            lang: 'typescript',
            wrapClassPrefix: 'language-',
        };
        const [openingTag, closingTag] = defaultCodeConfiguration.wrap(opts);
        expect(openingTag).toBe('<pre><code class="language-typescript">');
        expect(closingTag).toBe('</code></pre>');
    });

    it('should return correct wrapping elements even if lang is undefined', () => {
        const opts = {
            inline: false,
            wrapClassPrefix: 'language-',
        };
        const [openingTag, closingTag] = defaultCodeConfiguration.wrap(opts);
        expect(openingTag).toBe('<pre><code>');
        expect(closingTag).toBe('</code></pre>');
    });
});

describe('nullCodeConfiguration', () => {
    it('should be an object', () => {
        expect(typeof nullCodeConfiguration).toBe('object');
    });

    it('should have wrapClassPrefix property', () => {
        expect(nullCodeConfiguration.wrapClassPrefix).toBeDefined();
        expect(typeof nullCodeConfiguration.wrapClassPrefix).toBe('string');
    });

    it('should have wrap property', () => {
        expect(nullCodeConfiguration.wrap).toBeDefined();
        expect(typeof nullCodeConfiguration.wrap).toBe('function');
    });

    it.each([
        {
            inline: true,
            lang: 'javascript',
            wrapClassPrefix: 'language-',
        },
        {
            inline: false,
            lang: 'javascript',
            wrapClassPrefix: 'language-',
        },
        {
            wrapClassPrefix: 'something',
        },
        {
            lang: 'ts',
            wrapClassPrefix: '',
        },
    ])(
        'should return empty wrapping elements for both inline and block code',
        (opts) => {
            const [openingTag, closingTag] = nullCodeConfiguration.wrap(opts);
            expect(openingTag).toBe('');
            expect(closingTag).toBe('');
        },
    );
});
