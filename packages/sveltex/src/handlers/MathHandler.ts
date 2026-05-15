// File description: Handles math expressions.

// Types
import type {
    FullMathConfiguration,
    MathBackend,
    MathConfiguration,
    MathProcessFn,
    MathProcessOptions,
} from '../types/handlers/Math.js';
import type { ProcessedSnippet } from '../types/utils/Escape.js';
import type { MathjaxOptions } from '../types/utils/MathjaxOptions.js';

// Internal dependencies
import { getDefaultMathConfig } from '../base/defaults.js';
import { Handler } from './Handler.js';
import { isArray } from '../typeGuards/utils.js';
import { cdnLink, fancyFetch, fancyWrite } from '../utils/cdn.js';
import { escapeCssColorVars, unescapeCssColorVars } from '../utils/css.js';
import { getVersion, missingDeps } from '../utils/env.js';
import { escapeBraces } from '../utils/escape.js';
import { fs } from '../utils/fs.js';
import { mergeConfigs } from '../utils/merge.js';
import { ensureStartsWith } from '../utils/misc.js';
import { applyTransformations } from '../utils/transformers.js';

// External dependencies
import { is, join, nodeAssert, typeAssert } from '../deps.js';
import { log } from '../utils/debug.js';
import { diagnoseMathConfiguration } from '../utils/diagnosers/mathConfiguration.js';

/**
 * MathJax v4 splits its accessibility features across separately loadable
 * components. A document-`options` key only gains a registered default once
 * the component that owns it is loaded; passing an option whose component is
 * not loaded makes MathJax log `Invalid option "<key>" (no default value)`.
 *
 * SvelTeX is a build-time preprocessor, so it loads only the components that
 * are meaningful without a browser runtime. This table pairs each loadable
 * accessibility component with the option keys it owns and a predicate that
 * decides — from SvelTeX's `enable*` meta-options — whether to load it.
 */
const mathjaxA11yComponents: {
    component: string;
    keys: string[];
    shouldLoad: (options: Record<string, unknown>) => boolean;
}[] = [
    {
        component: 'a11y/assistive-mml',
        keys: ['enableAssistiveMml'],
        shouldLoad: (o) => o['enableAssistiveMml'] !== false,
    },
    {
        component: 'a11y/semantic-enrich',
        keys: ['enableEnrichment', 'enrichError'],
        shouldLoad: (o) => o['enableEnrichment'] === true,
    },
    {
        component: 'a11y/speech',
        keys: [
            'enableSpeech',
            'enableBraille',
            'speechError',
            'sre',
            'a11y',
            'worker',
        ],
        shouldLoad: (o) =>
            o['enableSpeech'] === true || o['enableBraille'] === true,
    },
    {
        component: 'a11y/complexity',
        keys: ['enableComplexity'],
        shouldLoad: (o) => o['enableComplexity'] === true,
    },
];

/**
 * MathJax `options` keys owned by accessibility components that SvelTeX never
 * loads — the `explorer` and contextual `menu` extensions both require a
 * browser runtime. These keys are always stripped before the options are
 * forwarded to MathJax.
 */
const mathjaxUnsupportedA11yKeys: string[] = [
    'enableExplorer',
    'enableMenu',
    'menuOptions',
];

/**
 * Resolves SvelTeX's accessibility meta-options into a concrete MathJax setup.
 *
 * The `enable*` flags in the MathJax `options` block are SvelTeX-level
 * switches that decide which MathJax accessibility *components* to load. This
 * returns the components to add to `loader.load`, together with a copy of
 * `options` from which every key whose owning component is not loaded has
 * been removed — so MathJax is never handed an option without a registered
 * default.
 *
 * @param options - The MathJax document options from the SvelTeX config.
 * @returns The accessibility components to load and the filtered options.
 */
export function resolveMathjaxA11y(options: MathjaxOptions | undefined): {
    load: string[];
    options: MathjaxOptions;
} {
    // MathJax's `options` is a loose key/value bag; treat it as such while
    // deciding which components to load and which keys are safe to forward.
    const provided = (options ?? {}) as unknown as Record<string, unknown>;
    const load: string[] = [];
    const blockedKeys = new Set<string>(mathjaxUnsupportedA11yKeys);
    for (const { component, keys, shouldLoad } of mathjaxA11yComponents) {
        if (shouldLoad(provided)) {
            load.push(component);
        } else {
            // The component is not loaded, so MathJax would reject the keys
            // it owns: keep them out of the forwarded options.
            for (const key of keys) blockedKeys.add(key);
        }
    }
    const forwarded: Record<string, unknown> = {};
    for (const key of Object.keys(provided)) {
        if (!blockedKeys.has(key)) forwarded[key] = provided[key];
    }
    return { load, options: forwarded };
}

/**
 * Removes the `menuOptions` key that the `a11y/assistive-mml` component adds
 * to `config.options` so the contextual menu — when present — can mirror the
 * assistive-MathML setting. SvelTeX never loads the menu, so the key has no
 * registered default; leaving it would make MathJax log
 * `Invalid option "menuOptions"`. This runs from the MathJax `startup.ready`
 * hook: after the component has executed, but before the document is created.
 *
 * @param config - The global `MathJax.config` object.
 */
export function stripMathjaxMenuOptions(config: Record<string, unknown>): void {
    const options = config['options'];
    if (options) {
        delete (options as Record<string, unknown>)['menuOptions'];
    }
}

export class MathHandler<B extends MathBackend> extends Handler<
    B,
    MathBackend,
    MathProcessOptions<B>,
    FullMathConfiguration<B>,
    MathHandler<B>,
    string
> {
    public override get process(): (
        tex: string,
        options?: MathProcessOptions<B>,
    ) => Promise<ProcessedSnippet> {
        return async (tex: string, options?: MathProcessOptions<B>) => {
            this.configIsValid ??=
                diagnoseMathConfiguration(this.backend, this._configuration)
                    .errors === 0;

            if (!this.configIsValid) {
                log(
                    'error',
                    'Invalid math configuration. Skipping math processing.',
                );
                return {
                    processed: escapeBraces(tex),
                    unescapeOptions: { removeParagraphTag: true },
                };
            }

            await this.handleCss();

            // Apply pre-transformers
            const pretransformed = applyTransformations(
                tex,
                { inline: options?.inline !== false },
                this._configuration.transformers.pre,
            );

            const res = await super.process(
                pretransformed,
                options ?? ({} as MathProcessOptions<B>),
            );

            // Apply post-transformers
            res.processed = applyTransformations(
                res.processed,
                { inline: options?.inline !== false, original: tex },
                this._configuration.transformers.post,
            );

            // Escape braces (which might otherwise confuse Svelte)
            res.processed = escapeBraces(res.processed);

            return res;
        };
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private readonly _handleCss: (mathHandler: this) => Promise<void> =
        async () => Promise.resolve();
    public get handleCss(): () => Promise<void> {
        return async () => {
            if (this._handledCss) {
                return;
            }
            if (this._handlingCss) {
                // wait until the CSS is handled
                await new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (this._handledCss) {
                            clearInterval(interval);
                            resolve(null);
                        }
                    }, 10);
                });
                return;
            }
            this._handlingCss = true;
            await this._handleCss(this);
            this._handledCss = true;
            this._handlingCss = false;
        };
    }

    private _handledCss: boolean = false;
    private _handlingCss: boolean = false;

    // The `() => undefined` function is unreachable, since the `updateCss`
    // getter only calls `_updateCss` if MathJax and CHTML are being used, in
    // which case `_updateCss` is overridden in the constructor.
    /* v8 ignore start -- unreachable default: the constructor overrides `_updateCss` before `updateCss` could ever reach it */
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private readonly _updateCss: (mathHandler: this) => Promise<void> =
        async () => Promise.resolve();
    /* v8 ignore stop */

    public get updateCss(): () => Promise<void> {
        return async () => {
            if (
                this.backend === 'mathjax' &&
                (this._configuration as FullMathConfiguration<'mathjax'>).css
                    .type === 'hybrid' &&
                (this._configuration as FullMathConfiguration<'mathjax'>)
                    .outputFormat === 'chtml'
            ) {
                await this._updateCss(this);
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private readonly _cleanup: (mathHandler: this) => Promise<void> =
        async () => Promise.resolve();
    public get cleanup(): () => Promise<void> {
        return async () => {
            await this._cleanup(this);
        };
    }

    private configIsValid: boolean | undefined = undefined;

    /**
     * Lines of code that should be added to the `<svelte:head>` component
     * of any page that contains any TeX on which this handler ran. This
     * variable must be set at most once, and cannot depend on what page the
     * handler is being used on.
     */
    private _headLines: string[] = [];
    public get headLines(): string[] {
        return this._headLines;
    }

    /**
     * Lines of code that should be added to the `<script>` tag
     * of any page that contains any TeX on which this handler ran. This
     * variable must be set at most once, and cannot depend on what page the
     * handler is being used on. These aren't necessarily the only lines that
     * will be added to the `<script>` tag on this handler's behalf, but they're
     * the only ones that don't depend on further details about the TeX content
     * of the page.
     */
    private readonly _scriptLines: string[] = [];
    public get scriptLines(): string[] {
        return this._scriptLines;
    }

    private constructor({
        backend,
        process,
        configuration,
        handleCss,
        updateCss,
        cleanup,
    }: {
        backend: B;
        process: MathProcessFn<B>;
        configuration: FullMathConfiguration<B>;
        handleCss?: (mathHandler: MathHandler<B>) => Promise<void>;
        updateCss?: (mathHandler: MathHandler<B>) => Promise<void>;
        cleanup?: (mathHandler: MathHandler<B>) => Promise<void>;
    }) {
        super({ backend, process, configuration });
        if (handleCss) this._handleCss = handleCss;
        if (updateCss) this._updateCss = updateCss;
        if (cleanup) this._cleanup = cleanup;
    }

    /**
     * Creates a math handler of the specified type.
     *
     * @param backend - The type of the tex processor to create.
     * @returns A promise that resolves to a math handler of the specified type.
     */
    public static async create<B extends MathBackend>(
        backend: B,
        userConfig?: MathConfiguration<B>,
    ): Promise<MathHandler<B>> {
        // ------------------------------------------------------------------ //
        //                               custom                               //
        // ------------------------------------------------------------------ //
        if (backend === 'custom') {
            // If `backend === 'custom'`, then we knwo that `userConfig`, if
            // defined, must be of type `MathConfiguration<'custom'>`.
            typeAssert(is<MathConfiguration<'custom'> | undefined>(userConfig));

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMathConfig('custom'),
                userConfig ?? {},
            );

            // Return a `MathHandler` instance that uses the above
            // configuration.
            return new MathHandler<'custom'>({
                backend,
                process: configuration.process,
                configuration,
            }) as unknown as MathHandler<B>;
        }
        // ------------------------------------------------------------------ //
        //                               KaTeX                                //
        // ------------------------------------------------------------------ //
        else if (backend === 'katex') {
            // If `backend === 'katex'`, then we know that `userConfig`, if
            // defined, must be of type `MathConfiguration<'katex'>`.
            typeAssert(is<MathConfiguration<'katex'> | undefined>(userConfig));

            // Import the `renderToString` function from the `katex` package,
            // and throw an error if the import fails.
            let renderToString;
            try {
                renderToString = (await import('katex')).default.renderToString;
            } catch (err) {
                // If the import fails, add `katex` to the list of missing
                // dependencies and rethrow the error.
                missingDeps.push('katex');
                throw err;
            }

            // Merge user-provided configuration into the default configuration.
            const configuration = mergeConfigs(
                getDefaultMathConfig('katex', userConfig?.css?.type),
                userConfig ?? {},
            );

            const process = (
                tex: string,
                { inline, options }: MathProcessOptions<'katex'>,
            ): string => {
                // Get KaTeX options.
                const { katex } = configuration;

                // Escape CSS color variables
                const { escaped, cssColorVars } = escapeCssColorVars(tex);
                tex = escaped;

                // Run KaTeX
                let output = renderToString(tex, {
                    // Apply options from config (KaTeX doesn't have a
                    // processor object, so the configuration has to be
                    // passed directly to each call to `renderToString`).
                    ...katex,

                    // Apply options from method parameter, which take
                    // precedence over the ones from the config.
                    ...options,

                    // Tell KaTeX whether the output should be rendered as
                    // inline- or as display math.
                    displayMode: inline === false,
                });

                output = unescapeCssColorVars(output, cssColorVars);

                return output;
            };
            const handleCss: (
                mathHandler: MathHandler<'katex'>,
            ) => Promise<void> = async (mathHandler) => {
                const cssConfig = configuration.css;
                const { type } = cssConfig;

                if (type === 'none') return;

                // If this branch is reached, we know that `type` is either
                // 'cdn' or 'hybrid'.

                const { cdn } = cssConfig;

                const v = (await getVersion('katex')) ?? 'latest';

                const cdns = isArray(cdn) ? cdn : [cdn];
                const links = cdns.map((c) =>
                    cdnLink('katex', 'dist/katex.min.css', v, c),
                );

                if (type === 'cdn') {
                    if (links[0]) {
                        mathHandler._headLines = [
                            `<link rel="stylesheet" href="${links[0]}">`,
                        ];
                        return;
                    } else {
                        log(
                            'error',
                            'No CDN specified for KaTeX. If you want to deactivate SvelTeX CSS handling for KaTeX, set the `tex.css.type` property of the SvelTeX configuration to `none`.',
                        );
                        return;
                    }
                }

                // If this branch is reached, we know that `type` is 'hybrid'.

                const { dir, staticDir } = cssConfig;

                const href = join(dir, `katex@${v}.min.css`);
                const path = join(staticDir, href);

                mathHandler._headLines = [
                    `<link rel="stylesheet" href="${ensureStartsWith(href, '/')}">`,
                ];

                if (fs.existsSync(path)) return;

                let css = await fancyFetch(links);

                if (!css) return;

                const linkPrefix = cdnLink('katex', 'dist/fonts/', v, cdns[0]);

                css = css.replaceAll('fonts/', linkPrefix);

                // Write the CSS to the specified path
                await fancyWrite(path, css);
            };

            // Return a `MathHandler` instance that makes use of the above.
            return new MathHandler<'katex'>({
                backend,
                configuration,
                process,
                handleCss,
            }) as unknown as MathHandler<B>;
        }

        // ------------------------------------------------------------------ //
        //                              MathJax                               //
        // ------------------------------------------------------------------ //
        else if (backend === 'mathjax') {
            // If `backend === 'mathjax'`, then we know that `userConfig`, if
            // defined, must be of type `MathConfiguration<'mathjax'>`.
            typeAssert(
                is<MathConfiguration<'mathjax'> | undefined>(userConfig),
            );

            // Merge user-provided configuration into the default configuration.
            const config = mergeConfigs(
                getDefaultMathConfig('mathjax', userConfig?.css?.type),
                userConfig ?? {},
            );

            const fmt = config.outputFormat;

            /**
             * The MathJax component bundle augments the global `MathJax`
             * object with a `startup` property at runtime; this isn't
             * reflected in `@mathjax/src`'s published type declarations.
             */
            interface MathJaxWithStartup {
                config: Record<string, unknown>;
                startup: {
                    promise: Promise<unknown>;
                    document: unknown;
                    defaultReady: () => void;
                };
            }

            // Import the necessary functions and types from the `@mathjax/src`
            // package, and throw an error if the import fails.
            let MathJax: MathJaxWithStartup;
            let combineConfig: (dst: unknown, src: unknown) => unknown;
            try {
                const { MathJax: _MathJax, combineConfig: _combineConfig } =
                    await import('@mathjax/src/js/components/global.js');
                MathJax = _MathJax as unknown as MathJaxWithStartup;
                combineConfig = _combineConfig;
            } catch (err) {
                // If the import fails, add `@mathjax/src` to the list of
                // missing dependencies and rethrow the error.
                missingDeps.push('@mathjax/src');
                missingDeps.push('speech-rule-engine');
                if (config.font !== 'newcm') {
                    missingDeps.push(`@mathjax/mathjax-${config.font}-font`);
                }
                throw err;
            }

            type MathDocument<N, D, T> =
                import('@mathjax/src/js/core/MathDocument.js').MathDocument<
                    N,
                    D,
                    T
                >;

            // Resolve SvelTeX's accessibility meta-options into the MathJax
            // a11y components to load and the option keys that are safe to
            // forward (see `resolveMathjaxA11y`).
            const a11y = resolveMathjaxA11y(config.mathjax.options);

            // Set the MathJax configuration defaults
            combineConfig(MathJax.config, {
                loader: {
                    load: [
                        'input/tex',
                        `output/${config.outputFormat}`,
                        'adaptors/liteDOM',
                        ...a11y.load,
                        ...(config.mathjax.load ?? []),
                    ],
                    paths: {
                        mathjax: '@mathjax/src/bundle',
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- MathJax loader hook; the module specifier is resolved at runtime
                    require: async (file: string) => import(file),
                },
                startup: {
                    document: '',
                    typeset: false,
                    /*
                     * The `a11y/assistive-mml` component adds
                     * `options.menuOptions` for the contextual menu, which
                     * SvelTeX never loads; strip it before the document is
                     * created so MathJax doesn't warn about an unregistered
                     * option.
                     */
                    ready: () => {
                        stripMathjaxMenuOptions(MathJax.config);
                        MathJax.startup.defaultReady();
                    },
                },
                output: {
                    font: `mathjax-${config.font}`,
                },
                chtml: {
                    fontURL: `https://cdn.jsdelivr.net/npm/@mathjax/mathjax-${config.font}-font@latest/chtml/woff2`,
                    // dynamicPrefix: `@mathjax/mathjax-${config.font}-font/js/chtml/dynamic`,
                },
                svg: {
                    // dynamicPrefix: `@mathjax/mathjax-${config.font}-font/js/svg/dynamic`,
                },
            });

            // Add the MathJax configuration passed to us, with the document
            // options narrowed to those whose components MathJax has loaded.
            combineConfig(MathJax.config, {
                ...config.mathjax,
                options: a11y.options,
            });

            // Load MathJax and wait for it to start up. The specifier is held
            // in a `string`-typed variable so that neither `tsc` nor Deno's
            // type-checker statically resolves the prebuilt (declaration-less)
            // startup bundle — they disagree on whether it resolves, which
            // would leave any `@ts-expect-error` directive "unused" under one
            // of them.
            const startupBundle: string = '@mathjax/src/bundle/startup.js';
            await import(startupBundle);
            await MathJax.startup.promise;

            // Create MathJax processor.
            const processor = MathJax.startup.document as MathDocument<
                HTMLElement,
                unknown,
                string
            >;

            /**
             * The version string of the user's `@mathjax/src` dependency.
             */
            const version = (await getVersion('@mathjax/src')) ?? 'latest';

            /**
             * This function is called exactly once for each build, and is
             * responsible for adding the `<link>` tag to the `<svelte:head>`
             * component that points to the CSS file generated by MathJax, and,
             * in the case of the 'svg' output format, for generating the CSS
             * file itself.
             */
            const handleCss: (
                mathHandler: MathHandler<'mathjax'>,
            ) => Promise<void> = async (mathHandler) => {
                const type = config.css.type;

                // With MathJax, there's no CSS available from CDNs (as far as I
                // could tell). For SVG output, I don't know why, but for CHTML
                // output this makes sense, as newer versions of MathJax
                // dynamically generate the minimal amount of CSS needed by
                // default.
                if (type === 'none') return;

                /**
                 * The directory to which we will write the CSS generated by
                 * MathJax.
                 */
                const { dir, staticDir } = config.css;

                /**
                 * The href to which the `<link>` tag in the `<svelte:head>`
                 * component will point.
                 *
                 * MathJax's output format (either `chtml` or `svg`). The output
                 * format influences the CSS that MathJax generates (in
                 * particular, the CSS for the `chtml` output format is much
                 * larger than the one for the `svg` output format).
                 * Accordingly, we want the filepath to which we write the
                 * generated CSS to be different depending on the output format.
                 */
                const href = join(dir, `mathjax@${version}.${fmt}.css`);
                /**
                 * The filepath to which we will write the CSS generated by
                 * MathJax.
                 */
                const path = join(staticDir, href);

                mathHandler._headLines = [
                    `<link rel="stylesheet" href="${ensureStartsWith(href, '/')}">`,
                ];

                // If the output format is `chtml`, we don't want to
                // generate the CSS file yet, because the MathJax processor
                // won't have rendered any math yet, so the CSS file would
                // be very incomplete. Instead, we'll call it with
                // `updateCss` at the end of the preprocessor run on each
                // page.
                if (fmt === 'chtml') return;

                // If the CSS file already exists, return early. Aside from
                // the file name, we don't have any "cache invalidation"
                // mechanism, so some cases might require manual
                // intervention by the end user (i.e., deleting the
                // generated CSS file manually if something went wrong while
                // generating it).
                if (fs.existsSync(path)) return;

                // Have MathJax generate the CSS for the SVG output format
                const css = processor.adaptor.textContent(
                    processor.outputJax.styleSheet(processor),
                );

                // Write the CSS to the specified filepath
                await fancyWrite(path, css);
            };

            /**
             * This is only meant to be called when the output format is
             * `chtml` and the CSS type is `hybrid`. This function is
             * responsible for updating the MathJax stylesheet to cover
             * all of the math that the MathJax processor has been requested
             * to render thus far. Unfortunately, since we can't know what
             * page is processed last, we have to call this function at the
             * end of every page that contains any MathJax math.
             */
            // eslint-disable-next-line @typescript-eslint/require-await -- async only to satisfy the `_updateCss` signature; the body is synchronous
            const updateCss = async (): Promise<void> => {
                nodeAssert(
                    fmt === 'chtml',
                    "Expected `outputFormat` to be 'chtml' in `updateCss` call.",
                );
                nodeAssert(
                    config.css.type === 'hybrid',
                    "Expected `css.type` to be 'hybrid' in `updateCss` call.",
                );

                // Have MathJax generate the CSS
                const css: string = processor.adaptor.textContent(
                    processor.outputJax.styleSheet(processor),
                );

                const { dir, staticDir } = config.css;

                /**
                 * The filepath to which we will write the CSS generated by
                 * MathJax.
                 */
                const path = join(
                    staticDir,
                    dir,
                    `mathjax@${version}.chtml.css`,
                );
                fs.writeFileEnsureDirSync(path, css);
            };

            const process: MathProcessFn<'mathjax'> = async (
                tex,
                { inline, options },
            ) => {
                const node = (await processor.convertPromise(tex, {
                    // Apply options from method parameter
                    ...options,
                    // Tell MathJax whether the output should be
                    // rendered as inline- or as display math.
                    display: inline === false,
                })) as HTMLElement;
                return processor.adaptor.outerHTML(node);
                // .replace(/ data-latex=".*?"/g, '');
            };

            const cleanup = async () => {
                // If I understand correctly, this is only relevant if speech
                // generation is used. Since SvelTeX uses MathML for
                // accessibility instead, it should hence not be necessary to
                // call this.
                // /* @ts-expect-error */
                // await MathJax.done();
            };

            return new MathHandler<'mathjax'>({
                backend,
                process,
                configuration: config,
                handleCss,
                updateCss,
                cleanup,
            }) as unknown as MathHandler<B>;
        }

        // Merge user-provided configuration into the default configuration.
        const configuration = mergeConfigs(
            getDefaultMathConfig('none'),
            userConfig ?? {},
        );

        // Return a `MathHandler` instance that effectively just transforms math
        // into an empty string.
        return new MathHandler<'none'>({
            backend,
            process: () => '',
            configuration,
        }) as unknown as MathHandler<B>;
    }
}
