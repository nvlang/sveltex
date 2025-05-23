// File description: Default configurations for SvelTeX.

// Types
import type { FullSveltexConfiguration } from '../types/SveltexConfiguration.js';
import type {
    CodeBackend,
    FullCodeConfiguration,
} from '../types/handlers/Code.js';
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
} from '../types/handlers/Markdown.js';
import type {
    FullMathConfiguration,
    MathBackend,
    MathJaxFullCssConfiguration,
} from '../types/handlers/Math.js';
import type { FullTexConfiguration } from '../types/handlers/Tex.js';
import type {
    FullVerbEnvConfigBase,
    FullVerbEnvConfigCode,
    FullVerbEnvConfigEscape,
    FullVerbEnvConfigTex,
    Preset,
    PresetName,
    VerbatimType,
} from '../types/handlers/Verbatim.js';
import type {
    CleanPopplerSvgOptions,
    PopplerSvgOptions,
} from '../types/utils/PopplerOptions.js';
import type { PropertiesDefined } from '../types/utils/utility-types.js';

// Internal dependencies
import { sveltexHtmlAttributes } from '../data/keys.js';
import {
    isNonNullObject,
    isPresentAndDefined,
    isString,
} from '../typeGuards/utils.js';
import { interpretAttributes } from '../utils/parseComponent.js';

// External dependencies
import {
    findCacheDirectory,
    getProperty,
    homedir,
    join,
    process,
    relative,
    resolve,
    setProperty,
} from '../deps.js';

/**
 * Get the default configuration for a given math backend.
 *
 * @param mathBackend - Math backend.
 * @param ca - "CSS approach" — this corresponds to the `math.css.type` setting.
 * @returns The default configuration for the given math backend and CSS
 * approach.
 */
export function getDefaultMathConfig<
    T extends MathBackend,
    CA extends 'cdn' | 'hybrid' | 'none' = T extends 'mathjax'
        ? 'hybrid'
        : T extends 'katex'
          ? 'cdn'
          : 'none',
>(
    mathBackend: T,
    ca: CA = mathBackend === 'mathjax'
        ? ('hybrid' as CA)
        : mathBackend === 'katex'
          ? ('cdn' as CA)
          : ('none' as CA),
): FullMathConfiguration<T> {
    switch (mathBackend) {
        case 'katex': {
            const rv: FullMathConfiguration<'katex'> = {
                css:
                    ca === 'cdn'
                        ? {
                              cdn: 'jsdelivr',
                              type: 'cdn',
                          }
                        : ca === 'hybrid'
                          ? {
                                cdn: ['jsdelivr', 'esm.sh', 'cdnjs', 'unpkg'],
                                dir: 'sveltex',
                                staticDir: 'static',
                                timeout: 2000,
                                type: 'hybrid',
                            }
                          : { type: 'none' },
                katex: {},
                transformers: { post: [], pre: [] },
                delims: {
                    dollars: true,
                    inline: { singleDollar: true, escapedParentheses: true },
                    display: { escapedSquareBrackets: true },
                    doubleDollarSignsDisplay: 'fenced',
                },
            };
            return rv as FullMathConfiguration<T>;
        }
        case 'mathjax': {
            const rv: FullMathConfiguration<'mathjax'> = {
                css: {
                    cdn: ['jsdelivr', 'esm.sh', 'cdnjs', 'unpkg'],
                    dir: 'sveltex',
                    staticDir: 'static',
                    timeout: 2000,
                    type: ca === 'hybrid' ? 'hybrid' : 'none',
                    font: 'modern',
                } as MathJaxFullCssConfiguration,
                mathjax: {
                    tex: {},
                    chtml: {
                        adaptiveCSS: false,
                        fontURL:
                            'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
                    },
                },
                outputFormat: 'chtml',
                transformers: { post: [], pre: [] },
                delims: {
                    dollars: true,
                    inline: { singleDollar: true, escapedParentheses: true },
                    display: { escapedSquareBrackets: true },
                    doubleDollarSignsDisplay: 'fenced',
                },
                // mathjax: { chtml: { fontURL:
                //     'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
                // }}
            } as FullMathConfiguration<'mathjax'>;
            return rv as FullMathConfiguration<T>;
        }
        case 'custom':
            return {
                transformers: { post: [], pre: [] },
                process: (content: string) => content,
                delims: {
                    dollars: true,
                    inline: { singleDollar: true, escapedParentheses: true },
                    display: { escapedSquareBrackets: true },
                    doubleDollarSignsDisplay: 'fenced',
                },
            } as FullMathConfiguration<'custom'> as FullMathConfiguration<T>;
        default:
            return {
                transformers: { post: [], pre: [] },
                delims: {
                    dollars: false,
                    inline: { singleDollar: false, escapedParentheses: false },
                    display: { escapedSquareBrackets: false },
                    doubleDollarSignsDisplay: 'fenced',
                },
            } as FullMathConfiguration<
                'custom' | 'none'
            > as FullMathConfiguration<T>;
    }
}

/**
 * The default cache directory for SvelTeX.
 *
 * @example
 * ```ts
 * 'node_modules/.cache/@nvl/sveltex'
 * ```
 */
export function getDefaultCacheDirectory(): string {
    if (defaultCacheDirectory === undefined) {
        const cacheDir: string | undefined = findCacheDirectory({
            name: '@nvl/sveltex',
        });
        defaultCacheDirectory = cacheDir
            ? relative(process.cwd(), cacheDir)
            : resolve(
                  process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'),
                  'sveltex',
              );
    }
    return defaultCacheDirectory;
}

let defaultCacheDirectory: string | undefined = undefined;

/**
 * Get the default TeX configuration.
 *
 * @returns The default TeX configuration.
 */
export function getDefaultTexConfig(): FullTexConfiguration {
    return {
        caching: {
            cacheDirectory: getDefaultCacheDirectory(),
            enabled: true,
        },
        compilation: {
            engine: 'pdflatex',
            intermediateFiletype: 'dvi',
            overrideCompilation: null,
            saferLua: false,
            shellEscape: false,
        },
        conversion: {
            converter: 'dvisvgm',
            dvisvgm: {
                console: {
                    verbosity: 0b0011, // overrides dvisvgm default
                },
                customArgs: [],
                svg: {
                    bbox: [2, 'pt'], // overrides dvisvgm default
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
            },
            outputDirectory: 'src/sveltex',
            overrideConversion: null,
            poppler: {
                antialias: 'default',
                cropHeight: null,
                cropSize: null,
                cropWidth: null,
                cropXAxis: null,
                cropYAxis: null,
                fillPage: false,
                noCenter: false,
                noCrop: false,
                noShrink: false,
                originalPageSizes: null,
                paperHeight: null,
                paperSize: null,
                paperWidth: null,
                printVersionInfo: null,
                quiet: null,
                resolutionXAxis: 150,
                resolutionXYAxis: 150,
                resolutionYAxis: 150,
                svgFile: true,
            },
        },
        debug: {
            ignoreLogMessages: [
                'Package shellesc Warning: Shell escape disabled',
                'LaTeX Warning: Package "xcolor" has already been loaded: ignoring load-time option "dvisvgm".',
                'Package epstopdf Warning: Shell escape feature is not enabled.',
            ],
            verbosity: {
                onFailure: 'box',
                onSuccess: 'box',
            },
        },
        optimization: {
            currentColor: '#000',
            overrideOptimization: null,
            svgo: {
                js2svg: {
                    eol: 'lf',
                    finalNewline: false,
                    indent: 4,
                    pretty: false,
                    useShortTags: true,
                },
                multipass: true,
                plugins: [
                    'removeDoctype',
                    'removeXMLProcInst',
                    'removeComments',
                    {
                        name: 'convertColors',
                        params: { shorthex: true },
                    },
                    {
                        name: 'cleanupAttrs',
                        params: { newlines: true, spaces: true, trim: false },
                    },
                    {
                        name: 'cleanupNumericValues',
                        params: { leadingZero: false, floatPrecision: 15 },
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
        },
    } as FullTexConfiguration;
}

/**
 * Get the default configuration for a given code backend.
 *
 * @param codeBackend - The code backend.
 * @returns The default configuration for the given code backend.
 */
export function getDefaultCodeConfig<C extends CodeBackend>(
    codeBackend: C,
): FullCodeConfiguration<C> {
    const inlineMeta: (
        inlineCode: string,
        validLanguageTag: (tag: string) => boolean,
    ) => {
        lang?: string | undefined;
        meta?: string | undefined;
        code: string;
    } = (inlineCode, validLanguageTag) => {
        let code = inlineCode;
        let lang: string | undefined;
        let meta: string | undefined;
        if (code.startsWith('{')) {
            const m = /^\{(.+?)\}\s(\s*\S[\w\W]*)$/u.exec(code);
            const specialCandidate = m?.[1];
            const codeCandidate = m?.[2];
            if (specialCandidate && codeCandidate) {
                const space = /\s/u.exec(specialCandidate)?.index;
                const tag = specialCandidate.slice(0, space);
                if (validLanguageTag(tag)) {
                    code = codeCandidate;
                    lang = tag;
                    if (space) meta = specialCandidate.slice(space + 1);
                }
            }
        } else {
            const m = /^([\w-]['\w-]*)\s(\s*\S[\w\W]*)$/u.exec(code);
            const tag = m?.[1];
            const codeCandidate = m?.[2];
            if (tag && codeCandidate && validLanguageTag(tag)) {
                code = codeCandidate;
                lang = tag;
            }
        }
        return { code, lang, meta };
    };
    if (codeBackend === 'shiki') {
        const config: FullCodeConfiguration<'shiki'> = {
            addLanguageClass: 'language-',
            appendNewline: true,
            inlineMeta,
            langAlias: {},
            parseMetaString: (metaString) => {
                return Object.fromEntries(
                    metaString
                        .split(' ')
                        .reduce(
                            (
                                prev: [string, boolean | string][],
                                curr: string,
                            ) => {
                                const [key, value] = curr.split('=');
                                const isNormalKey =
                                    key && /^[A-Z0-9]+$/iu.test(key);
                                if (isNormalKey)
                                    prev = [...prev, [key, value ?? true]];
                                return prev;
                            },
                            [],
                        ),
                );
            },
            shiki: {},
            transformers: { post: [], pre: [] },
        };
        return config as unknown as FullCodeConfiguration<C>;
    } else if (codeBackend === 'highlight.js') {
        const config: FullCodeConfiguration<'highlight.js'> = {
            addLanguageClass: 'language-',
            appendNewline: true,
            'highlight.js': {},
            inlineMeta,
            langAlias: {},
            theme: {
                cdn: 'jsdelivr',
                min: true,
                name: 'default',
                type: 'cdn',
                // Even though the `dir` and `timeout` properties don't really
                // exist if `type` is 'cdn', we want to initialize them to
                // 'sveltex' and 2000, respectively, so that, if the user
                // changes the `type` to 'self-hosted', the `dir` and `timeout`
                // properties are already set to sensible defaults.
                dir: 'sveltex',
                staticDir: 'static',
                timeout: 2000,
            },
            transformers: { post: [], pre: [] },
        } as FullCodeConfiguration<'highlight.js'>;
        return config as unknown as FullCodeConfiguration<C>;
    } else if (codeBackend === 'escape') {
        const config: FullCodeConfiguration<'escape'> = {
            addLanguageClass: 'language-',
            appendNewline: true,
            escape: { braces: true, html: true },
            inlineMeta,
            transformers: { post: [], pre: [] },
        };
        return config as unknown as FullCodeConfiguration<C>;
    } else if (codeBackend === 'starry-night') {
        const config: FullCodeConfiguration<'starry-night'> = {
            addLanguageClass: 'language-',
            appendNewline: true,
            inlineMeta,
            lang: null,
            langAlias: {},
            languages: 'common',
            theme: {
                cdn: 'jsdelivr',
                mode: 'both',
                name: 'default',
                type: 'cdn',
                // Even though the `dir` and `timeout` properties don't really
                // exist if `type` is 'cdn', we want to initialize them to
                // 'sveltex' and 2000, respectively, so that, if the user
                // changes the `type` to 'self-hosted', the `dir` and `timeout`
                // properties are already set to sensible defaults.
                dir: 'sveltex',
                staticDir: 'static',
                timeout: 2000,
            },
            transformers: { post: [], pre: [] },
        } as FullCodeConfiguration<'starry-night'>;
        return config as unknown as FullCodeConfiguration<C>;
    }

    const config: FullCodeConfiguration<'none'> = {
        addLanguageClass: false,
        appendNewline: true,
        inlineMeta,
        transformers: { post: [], pre: [] },
    };
    return config as unknown as FullCodeConfiguration<C>;
}

/**
 * Get the default SvelTeX configuration options for the given backends.
 *
 * @param markdownBackend - The Markdown backend.
 * @param codeBackend - The Code backend.
 * @param mathBackend - The Math backend.
 * @returns The default SvelTeX configuration options.
 *
 * @remarks Mutating the returned object will not affect return values of
 * subsequent calls to this function.
 */
export function getDefaultSveltexConfig<
    MD extends MarkdownBackend = 'none',
    C extends CodeBackend = 'none',
    MT extends MathBackend = 'none',
>(
    markdownBackend: MD = 'none' as MD,
    codeBackend: C = 'none' as C,
    mathBackend: MT = 'none' as MT,
): FullSveltexConfiguration<MD, C, MT> {
    return {
        extensions: ['.sveltex'] as `.${string}`[],
        math: getDefaultMathConfig(mathBackend),
        code: getDefaultCodeConfig(codeBackend),
        markdown: getDefaultMarkdownConfig(markdownBackend),
        tex: getDefaultTexConfig(),
        verbatim: {},
    };
}

/**
 * Get the default configuration for a given Markdown backend.
 *
 * @param m - Markdown backend.
 * @returns The default configuration for the given Markdown backend.
 */
export function getDefaultMarkdownConfig<M extends MarkdownBackend>(
    m: M,
): FullMarkdownConfiguration<M> {
    switch (m) {
        case 'unified':
            return {
                remarkPlugins: [],
                rehypePlugins: [],
                retextPlugins: [],
                remarkRehypeOptions: {},
                rehypeStringifyOptions: {},
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'unified'> as FullMarkdownConfiguration<M>;
        case 'marked':
            return {
                options: {},
                extensions: [],
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'marked'> as FullMarkdownConfiguration<M>;
        case 'micromark':
            return {
                options: {
                    allowDangerousHtml: true,
                    extensions: [],
                    htmlExtensions: [],
                    allowDangerousProtocol: false,
                },
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'micromark'> as FullMarkdownConfiguration<M>;
        case 'markdown-it':
            return {
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'markdown-it'> as FullMarkdownConfiguration<M>;
        case 'custom':
            return {
                process: (content: string) => content,
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'custom'> as FullMarkdownConfiguration<M>;
        default:
            return {
                // Common options
                prefersInline: () => true,
                strict: false,
                transformers: { post: [], pre: [] },
                directives: {
                    enabled: false,
                    bracesArePartOfDirective: null,
                },
                components: [],
            } as FullMarkdownConfiguration<'none'> as FullMarkdownConfiguration<M>;
    }
}

type DefaultVerbEnvConfig<T extends VerbatimType> = T extends 'tex'
    ? FullVerbEnvConfigTex
    : T extends 'code'
      ? FullVerbEnvConfigCode
      : T extends 'escape'
        ? FullVerbEnvConfigEscape
        : FullVerbEnvConfigBase;

/**
 * Get the default configuration for a given verbatim environment type.
 *
 * @param type - Verbatim environment type.
 * @returns The default configuration for the given verbatim environment type.
 */
export function getDefaultVerbEnvConfig<T extends VerbatimType>(
    type: T,
): DefaultVerbEnvConfig<T> & Record<string, unknown> {
    const common: FullVerbEnvConfigBase = {
        aliases: [],
        type,
        attributeForwardingAllowlist: 'all',
        attributeForwardingBlocklist: [],
        selfCloseOutputWith: 'auto',
        defaultAttributes: {},
        respectSelfClosing: true,
        component: 'this',
        transformers: { post: [], pre: [] },
    };
    switch (type) {
        case 'noop':
            return common as DefaultVerbEnvConfig<T>;
        case 'escape':
            return {
                ...common,
                escape: { braces: true, html: true },
            } as DefaultVerbEnvConfig<'escape'> as DefaultVerbEnvConfig<T>;
        case 'code':
            return {
                ...common,
                attributeForwardingBlocklist: ['lang', 'inline', 'metaString'],
            } as DefaultVerbEnvConfig<'code'> as DefaultVerbEnvConfig<T>;
        case 'tex':
            return {
                ...common,
                respectSelfClosing: false,
                component: 'none',
                documentClass: { name: 'standalone', options: [] },
                preamble: '\\usepackage{microtype}',
                preset: [],
                overrides: {},
                handleAttributes(attributes, tc) {
                    const entries = Object.entries(
                        interpretAttributes(attributes),
                    );
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
                            /^((fig|figure)[-_:.@#+]?)?caption[-_:.@#+]/u.exec(
                                lowercaseKey,
                            ) !== null
                        ) {
                            captionAttributes[
                                key.replace(/^.*?caption./iu, '')
                            ] = value;
                        } else if (key !== 'ref') {
                            const dottedKey = key.replace(/[-_:.@#+]/gu, '.');
                            // If the key is a property of the configuration
                            // object that can be configured ad hoc, set it.
                            // tc.texConfig;
                            const prop = sveltexHtmlAttributes[dottedKey];
                            if (prop) {
                                // If value is undefined, we'll assume that the
                                // user wants to reset the prop's value to the
                                // default.
                                if (value === undefined) {
                                    if (prop.startsWith('overrides.')) {
                                        // The config returned by
                                        // getDefaultVerbEnvConfig() has
                                        // `overrides` set to `{}`. Hence, if
                                        // the user wants to reset a prop in
                                        // `overrides`, we need to fetch the
                                        // prop's default value from the config
                                        // returned by
                                        // getDefaultTexConfig(). To get
                                        // the right value, however, we need to
                                        // remove the `overrides.` prefix from
                                        // the key.
                                        const relKey = prop.replace(
                                            'overrides.',
                                            '',
                                        );

                                        const defaultValue = getProperty(
                                            getDefaultTexConfig(),
                                            relKey,
                                        );
                                        tc.configuration = setProperty(
                                            tc.configuration,
                                            prop,
                                            defaultValue,
                                        );
                                    } else {
                                        const defaultValue = getProperty(
                                            getDefaultVerbEnvConfig('tex'),
                                            prop,
                                        );
                                        tc.configuration = setProperty(
                                            tc.configuration,
                                            prop,
                                            defaultValue,
                                        );
                                    }
                                }
                                // If `value` is not `undefined`, we just set
                                // the property to `value`.
                                else {
                                    tc.configuration = setProperty(
                                        tc.configuration,
                                        prop,
                                        value,
                                    );
                                }
                            }
                            // The key is not a (configurable) property of
                            // the configuration object, so we'll interpret
                            // it as a regular attribute.
                            else {
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
                            .map(
                                (attr) =>
                                    `${attr[0]}=${JSON.stringify(String(attr[1]))}`,
                            )
                            .join(' ');
                        if (figureAttributesString !== '') {
                            figureAttributesString = ` ${figureAttributesString}`;
                        }
                    }
                    if (
                        isPresentAndDefined(attributes, 'caption') &&
                        isString(attributes.caption)
                    ) {
                        let captionAttributesString: string;
                        if (
                            isPresentAndDefined(
                                attributes,
                                'captionAttributes',
                            ) &&
                            isNonNullObject(attributes.captionAttributes)
                        ) {
                            const captionAttributes = Object.entries(
                                attributes.captionAttributes,
                            );
                            captionAttributesString = captionAttributes
                                .map(
                                    (attr) =>
                                        `${attr[0]}=${JSON.stringify(String(attr[1]))}`,
                                )
                                .join(' ');
                            if (captionAttributesString !== '') {
                                captionAttributesString = ` ${captionAttributesString}`;
                            }
                            caption = `<figcaption${captionAttributesString}>${attributes.caption}</figcaption>\n`;
                        }
                    }
                    return `<figure${figureAttributesString}>\n${svgComponent}\n${caption}</figure>`;
                },
            } as DefaultVerbEnvConfig<'tex'> as DefaultVerbEnvConfig<T>;
        default:
            throw new Error(`Unknown verbatim type: ${type}`);
    }
}

/**
 * Sanitize options passed to Poppler. Basically just removes `undefined`s and
 * `null`s. Also adds the `svgFile` property, set to `true`.
 *
 * @param options - The options to sanitize.
 * @returns The sanitized options.
 */
export function sanitizePopplerSvgOptions(
    options: PropertiesDefined<PopplerSvgOptions>,
): CleanPopplerSvgOptions & {
    svgFile: true;
} {
    return {
        ...Object.fromEntries(
            Object.entries(options).filter(([, v]) => v !== null),
        ),
        svgFile: true,
    };
}

/**
 * Get the default configuration for a given TeX preset.
 *
 * @param presetName - The name of a TeX preset.
 * @returns The default configuration for the given TeX preset.
 */
export function getTexPresetDefaults(presetName: PresetName): Preset {
    switch (presetName) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        case 'tikz':
            return {
                name: 'tikz',
                libraries: {
                    babel: true,
                    arrows: { meta: true },
                    calc: true,
                },
            };
    }
}

// '3d': false,
// arrows: { meta: true },
// automata: false,
// angles: false,
// animations: false,
// backgrounds: false,
// babel: false,
// bending: false,
// calc: false,
// calendar: false,
// chains: false,
// circuits: {
//     ee: {
//         IEC: false,
//     },
//     logic: {
//         CDH: false,
//         IEC: false,
//         US: false,
//     },
// },
// decorations: {
//     footprints: false,
//     markings: false,
//     fractals: false,
//     pathmorphing: false,
//     pathreplacing: false,
//     shapes: false,
//     text: false,
// },
// curvilinear: false,
// datavisualization: {
//     formats: {
//         functions: false,
//     },
//     polar: false,
// },
// er: false,
// externalization: false,
// fadings: false,
// fit: false,
// fixedpointarithmetic: false,
// folding: false,
// fpu: false,
// graphdrawing: {
//     circular: false,
//     force: false,
//     layered: false,
//     trees: false,
//     examples: false,
//     phylogenetics: false,
//     routing: false,
// },
// graphs: false,
// intersections: false,
// lindenmayersystems: false,
// math: false,
// matrix: false,
// mindmap: false,
// patterns: { meta: false },
// perspective: false,
// petri: false,
// plotmarks: false,
// positioning: false,
// quotes: false,
// shadows: false,
// shadings: false,
// shapes: {
//     arrows: false,
//     callouts: false,
//     geometric: false,
//     misc: false,
//     multipart: false,
//     symbols: false,
// },
// spy: false,
// svg: false,
// through: false,
// profiler: false,
// rdf: false,
// scopes: false,
// trees: false,
// turtle: false,
// views: false,
