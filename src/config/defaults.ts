// Types
import type {
    AdvancedTexBackend,
    CodeBackend,
    CodeProcessOptions,
    DvisvgmOptions,
    FirstTwoLevelsRequiredNotUndefined,
    FullAdvancedTexConfiguration,
    FullCodeConfiguration,
    FullMarkdownConfiguration,
    FullSveltexConfiguration,
    FullTexComponentConfiguration,
    FullTexConfiguration,
    FullVerbatimEnvironmentConfiguration,
    MarkdownBackend,
    TexBackend,
} from '$types';

// Internal dependencies
import { isNonNullObject, isPresentAndDefined, isString } from '$type-guards';
import { interpretAttributes } from '$utils/misc.js';

// External dependencies
import findCacheDirectory from 'find-cache-dir';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';

/**
 * Get the default configuration for a TeX backend.
 */
export function getDefaultTexConfiguration<T extends TexBackend>(
    texBackend: T,
): FullTexConfiguration<T> {
    const css = {
        dir: 'src/sveltex',
        write: true,
        read: true,
    };
    switch (texBackend) {
        case 'katex':
            return {
                css,
                katex: {},
            } as FullTexConfiguration<T>;
        case 'mathjax':
            return {
                css,
                outputFormat: 'svg',
                mathjaxConfiguration: {
                    chtml: {
                        fontURL:
                            'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
                    },
                },
            } as FullTexConfiguration<T>;
        case 'mathjax-node':
            return {
                css,
                mathjaxNodeConfiguration: {},
                inputConfiguration: {},
            } as FullTexConfiguration<T>;
        default:
            return {} as FullTexConfiguration<T>;
    }
}

/**
 * Get the default configuration for a TeX component.
 *
 * @param advancedTexBackend - The backend of the `AdvancedTexHandler` that
 * created the `TexComponent`.
 * @returns The default configuration for the TeX component.
 */
export function getDefaultTexComponentConfiguration<
    A extends AdvancedTexBackend,
>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _advancedTexBackend: A,
): FullTexComponentConfiguration<A> {
    return {
        documentClass: '\\documentclass{standalone}',
        preamble: '\\usepackage{microtype}',
        overrides: {
            shellEscape: false,
            saferLua: false,
            intermediateFiletype: 'pdf',
            overrideCompilationCommand: undefined,
            overrideConversionCommand: undefined,
            overrideSvgPostprocess: undefined,
        },
        aliases: [],
        handleAttributes(attributes, tc) {
            const entries = Object.entries(interpretAttributes(attributes));
            // Attributes for the <figure> element
            const figureAttributes: Record<
                string,
                string | number | boolean | null | undefined
            > = {};
            // Attributes for the optional <figcaption> element
            const captionAttributes: Record<
                string,
                string | number | boolean | null | undefined
            > = {};
            let caption: string | undefined = undefined;
            for (const [key, value] of entries) {
                const lowercaseKey = key.toLowerCase();
                if (lowercaseKey === 'caption') {
                    caption = String(value);
                } else if (
                    lowercaseKey.match(
                        /^((fig|figure)[-_:.@#+]?)?caption[-_:.@#+]/,
                    ) !== null
                ) {
                    captionAttributes[key.replace(/^.*?caption./i, '')] = value;
                } else if (key !== 'ref') {
                    if (lowercaseKey === 'preamble') {
                        tc.configuration.preamble = String(value);
                    } else if (lowercaseKey === 'documentclass') {
                        tc.configuration.documentClass = String(value);
                    } else {
                        figureAttributes[key] = value;
                    }
                }
            }
            return { caption, figureAttributes, captionAttributes };
        },
        postprocess(svgComponent, tc) {
            let figureAttributesString = '';
            let caption = '';
            const attributes = tc.handledAttributes;
            if (
                isPresentAndDefined(attributes, 'figureAttributes') &&
                isNonNullObject(attributes.figureAttributes)
            ) {
                const figureAttributes = Object.entries(
                    attributes.figureAttributes,
                );
                figureAttributesString = figureAttributes
                    .map((attr) => `${attr[0]}="${String(attr[1])}"`)
                    .join(' ');
                if (figureAttributesString !== '') {
                    figureAttributesString = ` ${figureAttributesString}`;
                }
            }
            if (
                isPresentAndDefined(attributes, 'caption') &&
                isString(attributes.caption)
            ) {
                let captionAttributesString = '';
                if (
                    isPresentAndDefined(attributes, 'captionAttributes') &&
                    isNonNullObject(attributes.captionAttributes)
                ) {
                    const captionAttributes = Object.entries(
                        attributes.captionAttributes,
                    );
                    captionAttributesString = captionAttributes
                        .map((attr) => `${attr[0]}="${String(attr[1])}"`)
                        .join(' ');
                    if (captionAttributesString !== '') {
                        captionAttributesString = ` ${captionAttributesString}`;
                    }
                    caption = `<figcaption${captionAttributesString}>${attributes.caption}</figcaption>\n`;
                }
            }
            return `<figure${figureAttributesString}>\n${svgComponent}\n${caption}</figure>`;
        },
    };
}

export function getDefaultDvisvgmOptions(): FirstTwoLevelsRequiredNotUndefined<DvisvgmOptions> {
    return {
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
    };
}

const cacheDir = findCacheDirectory({ name: 'sveltex-preprocess' });
export const defaultCacheDirectory = cacheDir
    ? relative(process.cwd(), cacheDir)
    : resolve(
          process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'),
          'sveltex',
      );

export function getDefaultAdvancedTexConfiguration<
    A extends AdvancedTexBackend,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(_advancedTexBackend: A): FullAdvancedTexConfiguration<A> {
    return {
        caching: true,
        verbose: false,
        cacheDirectory: defaultCacheDirectory,
        outputDirectory: 'src/sveltex',
        engine: 'lualatex',
        dvisvgmOptions: getDefaultDvisvgmOptions(),
        intermediateFiletype: 'pdf',
        overrideCompilationCommand: undefined,
        overrideConversionCommand: undefined,
        overrideSvgPostprocess: undefined,
        saferLua: false,
        shellEscape: false,
        components: {},
        svgoOptions: {
            js2svg: {
                pretty: false,
                eol: 'lf',
            },
            multipass: true,
            plugins: [
                'removeDoctype',
                'removeXMLProcInst',
                'removeComments',
                {
                    name: 'convertColors',
                    params: {
                        shorthex: true,
                    },
                },
                {
                    name: 'cleanupAttrs',
                    params: {
                        newlines: true,
                        spaces: true,
                        trim: false,
                    },
                },
                {
                    name: 'cleanupNumericValues',
                    params: {
                        leadingZero: false,
                        floatPrecision: 15,
                    },
                },
                {
                    name: 'removeUnknownsAndDefaults',
                    params: {
                        defaultAttrs: true,
                        defaultMarkupDeclarations: true,
                    },
                },
                'removeUselessDefs',
            ],
        },
    } as FullAdvancedTexConfiguration<A>;
}

/**
 * Default CodeConfiguration
 */
export function getDefaultCodeConfiguration<C extends CodeBackend>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _codeBackend: C,
): FullCodeConfiguration<C> {
    return {
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
    } as FullCodeConfiguration<C>;
}

/**
 * Get the default SvelTeX configuration options for the given backends.
 *
 * @param m - The Markdown backend.
 * @param c - The Code backend.
 * @param t - The TeX backend.
 * @param a - The Advanced TeX backend.
 * @returns The default SvelTeX configuration options.
 *
 * @remarks Mutating the returned object will not affect return values of
 * subsequent calls to this function.
 */
export function getDefaultSveltexConfig<
    M extends MarkdownBackend,
    C extends CodeBackend,
    T extends TexBackend,
    A extends AdvancedTexBackend,
>(m: M, c: C, t: T, a: A): FullSveltexConfiguration<M, C, T, A> {
    return {
        general: {
            wrap: {
                begin: '<div class="sveltex-output">',
                end: '</div>',
            },
            extensions: ['.sveltex'] as `.${string}`[],
            tex: {
                delimiters: {
                    inline: ['$', '$'] as [string, string],
                    display: ['$$', '$$'] as [string, string],
                },
            },
        },
        tex: getDefaultTexConfiguration(t),
        code: getDefaultCodeConfiguration(c),
        markdown: getDefaultMarkdownConfig(m),
        advancedTex: getDefaultAdvancedTexConfiguration(a),
        verbatim: { verbatimEnvironments: {} },
    };
}

export function getDefaultMarkdownConfig<M extends MarkdownBackend>(
    m: M,
): FullMarkdownConfiguration<M> {
    switch (m) {
        case 'unified':
            return {
                remarkPlugins: [],
                rehypePlugins: [],
            } as FullMarkdownConfiguration<'unified'> as FullMarkdownConfiguration<M>;
        case 'marked':
            return {
                options: {},
                extensions: [],
            } as FullMarkdownConfiguration<'marked'> as FullMarkdownConfiguration<M>;
        default:
            return {} as FullMarkdownConfiguration<M>;
    }
}

export function getDefaultVerbatimEnvironmentConfiguration(): FullVerbatimEnvironmentConfiguration {
    return {
        processInner: { escapeHtml: true, escapeBraces: true },
        aliases: [],
        attributeForwardingAllowlist: 'all',
        attributeForwardingBlocklist: ['lang', 'inline', 'info'],
        component: undefined,
        respectSelfClosing: true,
        selfCloseOutputWith: 'auto',
        defaultAttributes: {},
        wrap: false,
    };
}
