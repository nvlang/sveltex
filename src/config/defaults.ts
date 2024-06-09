// Types
import type { FullSveltexConfiguration } from '$types/SveltexConfiguration.js';
import type { FullTexConfiguration } from '$types/handlers/Tex.js';
import type {
    CodeBackend,
    FullCodeConfiguration,
} from '$types/handlers/Code.js';
import type {
    FullMarkdownConfiguration,
    MarkdownBackend,
} from '$types/handlers/Markdown.js';
import type {
    FullMathConfiguration,
    MathBackend,
} from '$types/handlers/Math.js';
import type {
    FullVerbEnvConfigTex,
    FullVerbEnvConfigBase,
    FullVerbEnvConfigCode,
    FullVerbEnvConfigEscape,
    Preset,
    PresetName,
    VerbatimType,
} from '$types/handlers/Verbatim.js';

// Internal dependencies
import {
    isNonNullObject,
    isPresentAndDefined,
    isString,
} from '$type-guards/utils.js';

// External dependencies
import {
    findCacheDirectory,
    getProperty,
    homedir,
    join,
    relative,
    resolve,
    setProperty,
} from '$deps.js';
import { interpretAttributes } from '$utils/parseComponent.js';
import {
    CleanPopplerSvgOptions,
    PopplerSvgOptions,
} from '$types/utils/PopplerOptions.js';
import { MakePropertiesNotUndefined } from '$types/utils/utility-types.js';
import { sveltexHtmlAttributes } from '$data/keys.js';

/**
 * Get the default configuration for a TeX backend.
 */
export function getDefaultMathConfiguration<
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
                                dir: 'src/sveltex',
                                timeout: 2000,
                                type: 'hybrid',
                            }
                          : { type: 'none' },
                katex: {},
                transformers: { post: [], pre: [] },
            };
            return rv as FullMathConfiguration<T>;
        }
        case 'mathjax': {
            const rv: FullMathConfiguration<'mathjax'> = {
                css:
                    ca === 'hybrid'
                        ? {
                              cdn: ['jsdelivr', 'esm.sh', 'cdnjs', 'unpkg'],
                              dir: 'src/sveltex',
                              timeout: 2000,
                              type: 'hybrid',
                          }
                        : { type: 'none' },
                mathjax: {
                    tex: {},
                },
                outputFormat: 'svg',
                transformers: { post: [], pre: [] },
                // mathjax: { chtml: { fontURL:
                //     'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2',
                // }}
            };
            return rv as FullMathConfiguration<T>;
        }
        default:
            return {
                transformers: { post: [], pre: [] },
            } as FullMathConfiguration<
                'custom' | 'none'
            > as FullMathConfiguration<T>;
    }
}

const cacheDir = findCacheDirectory({ name: '@nvl/sveltex' });
export const defaultCacheDirectory = cacheDir
    ? relative(process.cwd(), cacheDir)
    : resolve(
          process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache'),
          'sveltex',
      );

export function getDefaultTexConfig(): FullTexConfiguration {
    return {
        caching: {
            cacheDirectory: defaultCacheDirectory,
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
                    color: true, // overrides dvisvgm default
                    message: null,
                    progress: true, // overrides dvisvgm default
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
 * Default CodeConfiguration
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
            const m = /^\{(.+?)\}\s(\s*\S[\w\W]*)$/.exec(code);
            const specialCandidate = m?.[1];
            const codeCandidate = m?.[2];
            if (specialCandidate && codeCandidate) {
                const space = /\s/.exec(specialCandidate)?.index;
                const tag = specialCandidate.slice(0, space);
                if (validLanguageTag(tag)) {
                    code = codeCandidate;
                    lang = tag;
                    if (space) meta = specialCandidate.slice(space + 1);
                }
            }
        } else {
            const m = /^([\w-]['\w-]*)\s(\s*\S[\w\W]*)$/.exec(code);
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
                                    key && /^[A-Z0-9]+$/i.test(key);
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
                // 'src/sveltex' and 2000, respectively, so that, if the user
                // changes the `type` to 'self-hosted', the `dir` and `timeout`
                // properties are already set to sensible defaults.
                dir: 'src/sveltex',
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
                // 'src/sveltex' and 2000, respectively, so that, if the user
                // changes the `type` to 'self-hosted', the `dir` and `timeout`
                // properties are already set to sensible defaults.
                dir: 'src/sveltex',
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
 * @param m - The Markdown backend.
 * @param c - The Code backend.
 * @param t - The Math backend.
 * @returns The default SvelTeX configuration options.
 *
 * @remarks Mutating the returned object will not affect return values of
 * subsequent calls to this function.
 */
export function getDefaultSveltexConfig<
    M extends MarkdownBackend = 'none',
    C extends CodeBackend = 'none',
    T extends MathBackend = 'none',
>(
    m: M = 'none' as M,
    c: C = 'none' as C,
    t: T = 'none' as T,
): FullSveltexConfiguration<M, C, T> {
    return {
        general: {
            extensions: ['.sveltex'] as `.${string}`[],
            math: {
                enabled: t !== 'none',
                delims: {
                    inline: { escapedParentheses: true, singleDollar: true },
                    display: { escapedSquareBrackets: true },
                },
                doubleDollarSignsDisplay: 'fenced',
            },
        },
        math: getDefaultMathConfiguration(t),
        code: getDefaultCodeConfig(c),
        markdown: getDefaultMarkdownConfig(m),
        tex: getDefaultTexConfig(),
        verbatim: {},
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

type DefaultVerbEnvConfig<T extends VerbatimType> = T extends 'tex'
    ? FullVerbEnvConfigTex
    : T extends 'code'
      ? FullVerbEnvConfigCode
      : T extends 'escape'
        ? FullVerbEnvConfigEscape
        : FullVerbEnvConfigBase;

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
                wrap: true,
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
                            /^((fig|figure)[-_:.@#+]?)?caption[-_:.@#+]/.exec(
                                lowercaseKey,
                            ) !== null
                        ) {
                            captionAttributes[
                                key.replace(/^.*?caption./i, '')
                            ] = value;
                        } else if (key !== 'ref') {
                            const dottedKey = key.replace(/[-_:.@#+]/g, '.');
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
                        let captionAttributesString = '';
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

export function sanitizePopplerSvgOptions(
    options: MakePropertiesNotUndefined<PopplerSvgOptions>,
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

export function getTexPresetDefaults(presetName: PresetName): Preset {
    switch (presetName) {
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
