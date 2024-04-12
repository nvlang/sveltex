import type {
    FullSveltexConfig,
    MarkdownBackend,
    CodeBackend,
    TexBackend,
    AdvancedTexBackend,
    DvisvgmOptions,
    GeneralCodeConfiguration,
    RequiredNonNullable,
    CodeProcessOptions,
    FullAdvancedTexConfiguration,
    FirstTwoLevelsRequiredNotUndefined,
    FullTexComponentConfig,
} from '$types';
import findCacheDirectory from 'find-cache-dir';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';

export const defaultTexComponentConfig: FullTexComponentConfig = {
    documentClass: '\\documentclass{standalone}',
    preamble: '\\usepackage{microtype}',
    overrides: {
        shellEscape: false,
        saferLua: false,
        intermediateFiletype: 'pdf',
        overrideCompilationCommand: undefined,
        overrideConversionCommand: undefined,
    },
    defaultAttributes: {},
    aliases: [],
} as const;

export const defaultDvisvgmOptions: FirstTwoLevelsRequiredNotUndefined<DvisvgmOptions> =
    {
        console: {
            color: true, // overrides dvisvgm default
            message: null,
            progress: true, // overrides dvisvgm default
            verbosity: 0b0011, // overrides dvisvgm default
        },
        customArgs: [],
        svg: {
            bbox: null,
            bitmapFormat: 'png', // overrides dvisvgm default
            clipJoin: null,
            comments: false, // matches dvisvgm default, but we want to make sure
            currentColor: '#000', // overrides dvisvgm default
            fontFormat: 'woff2', // overrides dvisvgm default
            gradOverlap: false, // matches dvisvgm default, but we want to make sure
            gradSegments: null,
            gradSimplify: null,
            linkmark: 'none', // matches dvisvgm default, but we want to make sure
            noStyles: null,
            optimize: 'all', // matches dvisvgm default, but we want to make sure
            precision: 'auto', // matches dvisvgm default, but we want to make sure
            relative: true, // overrides dvisvgm default
            zip: false, // matches dvisvgm default, but we want to make sure
        },
        processing: {
            cache: null,
            exactBbox: true, // overrides dvisvgm default
            keep: null,
            mag: null,
            noMktexmf: null,
            noSpecials: null,
            traceAll: null,
        },
        svgTransformations: {
            rotate: null,
            scale: null,
            transform: null,
            translate: null,
            zoom: null,
        },
    } as const;

const cacheDir = findCacheDirectory({ name: 'sveltex-preprocess' });
export const defaultCacheDirectory = cacheDir
    ? relative(process.cwd(), cacheDir)
    : resolve(
          process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'),
          'sveltex',
      );

export const defaultAdvancedTexConfiguration = {
    local: {
        caching: true,
        verbose: false,
        cacheDirectory: defaultCacheDirectory,
        outputDirectory: 'static/sveltex',
        engine: 'lualatex',
        dvisvgmOptions: defaultDvisvgmOptions,
        intermediateFiletype: 'pdf',
        overrideCompilationCommand: undefined,
        overrideConversionCommand: undefined,
        saferLua: false,
        shellEscape: false,
        components: {},
    } as FullAdvancedTexConfiguration<'local'>,
    custom: {},
    none: {},
} as const;

/**
 * Default CodeConfiguration
 */
export const defaultCodeConfiguration = {
    wrapClassPrefix: 'language-',
    wrap: (opts: CodeProcessOptions & { wrapClassPrefix: string }) => {
        const attr =
            opts.lang !== undefined
                ? ` class="${opts.wrapClassPrefix}${opts.lang}"`
                : '';
        return opts.inline === true
            ? ([`<code${attr}>`, '</code>'] as [string, string])
            : ([`<pre><code${attr}>`, '</code></pre>'] as [string, string]);
    },
} as const;

/**
 * Null CodeConfiguration
 */
export const nullCodeConfiguration: RequiredNonNullable<GeneralCodeConfiguration> =
    {
        wrapClassPrefix: '',
        wrap: () => ['', ''],
    } as const;

/**
 * Default SvelTeX configuration options
 */
export const defaultSveltexConfig: FullSveltexConfig<
    MarkdownBackend,
    CodeBackend,
    TexBackend,
    AdvancedTexBackend
> = {
    general: {
        wrap: {
            begin: '<div class="sveltex-output">',
            end: '</div>',
        },
        extensions: ['.sveltex'] as `.${string}`[],
        verbatimEnvironments: {},
        tex: {
            delimiters: {
                inline: ['$', '$'] as [string, string],
                display: ['$$', '$$'] as [string, string],
            },
        },
    },
    tex: {},
    code: defaultCodeConfiguration,
    markdown: {},
    advancedTex: {},
} as const;

export const defaultMarkdownConfig = {
    micromark: {},
    'markdown-it': {},
    unified: {
        remarkPlugins: [],
        rehypePlugins: [],
    },
    marked: {
        options: {},
        extensions: [],
    },
} as const;
