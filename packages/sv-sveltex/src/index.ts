import { defineAddon, defineAddonOptions } from 'sv';
import { pnpm, transforms, type AstTypes } from '@sveltejs/sv-utils';

/**
 * Peer dependencies pulled in by each backend choice. Versions are taken from
 * the `peerDependencies` field of `@nvl/sveltex`'s `package.json` so that a
 * project scaffolded by this add-on satisfies SvelTeX's peer-dependency
 * ranges.
 */
const markdownDependencies = {
    unified: {
        unified: '^11.0.4',
        'remark-parse': '^11.0.0',
        'remark-retext': '^6.0.0',
        'remark-rehype': '^11.1.0',
        'rehype-stringify': '^10.0.0',
    },
    'markdown-it': { 'markdown-it': '^14.1.0' },
    micromark: { micromark: '^4.0.0' },
    marked: { marked: '^18.0.0' },
    none: {},
} as const;

const codeDependencies = {
    shiki: { shiki: '^4.0.0' },
    'starry-night': {
        '@wooorm/starry-night': '^3.3.0',
        'hast-util-find-and-replace': '^5.0.1',
    },
    'highlight.js': { 'highlight.js': '^11.9.0' },
    escape: {},
    none: {},
} as const;

const mathDependencies = {
    mathjax: { '@mathjax/src': '^4.0.0' },
    katex: { katex: '^0.16.10' },
    none: {},
} as const;

type MarkdownBackend = keyof typeof markdownDependencies;
type CodeBackend = keyof typeof codeDependencies;
type MathBackend = keyof typeof mathDependencies;

const addonOptions = defineAddonOptions()
    .add('markdownBackend', {
        question: 'Which Markdown backend would you like to use?',
        type: 'select',
        default: 'unified',
        options: [
            { value: 'unified', label: 'unified.js', hint: 'recommended' },
            { value: 'markdown-it', label: 'markdown-it' },
            { value: 'micromark', label: 'micromark' },
            { value: 'marked', label: 'marked' },
            { value: 'none', label: 'none' },
        ],
    })
    .add('codeBackend', {
        question:
            'Which code backend (syntax highlighter) would you like to use?',
        type: 'select',
        default: 'shiki',
        options: [
            { value: 'shiki', label: 'Shiki', hint: 'recommended' },
            { value: 'starry-night', label: 'starry-night' },
            { value: 'highlight.js', label: 'highlight.js' },
            { value: 'escape', label: 'escape only' },
            { value: 'none', label: 'none' },
        ],
    })
    .add('mathBackend', {
        question: 'Which math backend would you like to use?',
        type: 'select',
        default: 'mathjax',
        options: [
            { value: 'mathjax', label: 'MathJax' },
            { value: 'katex', label: 'KaTeX' },
            { value: 'none', label: 'none' },
        ],
    })
    .add('demoRoute', {
        question: 'Add a sample `+page.sveltex` route?',
        type: 'boolean',
        default: true,
    })
    .build();

/**
 * Builds the contents of `sveltex.config.{js,ts}`, based on
 * `packages/create-sveltex/template/sveltex.config.js.hbs`.
 */
function sveltexConfig(
    markdownBackend: MarkdownBackend,
    codeBackend: CodeBackend,
    mathBackend: MathBackend,
): string {
    const codeOptions =
        codeBackend === 'shiki'
            ? `        code: {
            shiki: {
                themes: {
                    light: 'github-light-default',
                    dark: 'github-dark-default',
                },
            },
        },`
            : `        code: {
            // Code options
        },`;

    return `import { sveltex } from '@nvl/sveltex';

export default await sveltex(
    {
        markdownBackend: '${markdownBackend}',
        codeBackend: '${codeBackend}',
        mathBackend: '${mathBackend}',
    },
    {
        markdown: {
            // Markdown options
        },
${codeOptions}
        math: {
            // Math options
        },
        tex: {
            // Default LaTeX options
        },
        verbatim: {
            // The <TeX> component compiles LaTeX to SVG with a *local TeX
            // distribution* (TeX Live / MiKTeX, plus dvisvgm or Poppler). It's
            // left disabled by default so your build doesn't depend on system
            // tools you might not have installed — math via $…$ needs none of
            // this. To enable it, install a TeX distribution (see
            // https://sveltex.dev/docs/getting-started#system-prerequisites)
            // and uncomment the block below; then use e.g.
            // "<TeX ref="example">\\LaTeX</TeX>" ("ref" is mandatory).
            //
            // TeX: {
            //     type: 'tex',
            // },
        },
    },
);
`;
}

/**
 * Builds the contents of the sample `+page.sveltex` route, based on
 * `packages/create-sveltex/template/src/routes/+page.sveltex.hbs`. It is kept
 * self-contained (no `$lib` imports) so the add-on doesn't have to scaffold
 * extra components.
 */
function demoRouteContent(mathBackend: MathBackend): string {
    const math =
        mathBackend === 'none'
            ? ''
            : `
Math:

$$
\\int_{a}^{b} f'(t) \\, \\mathrm{d}t = f(b) - f(a).
$$
`;

    return `---
title: SvelTeX demo
description: SvelTeX demo page
---

# SvelTeX demo

Markdown: _italic_ **bold** \`code\` [link](https://example.com)

Fenced code blocks:

\`\`\`ts
console.log('Hello, World!');
\`\`\`
${math}`;
}

export default defineAddon({
    id: 'sveltex',
    shortDescription: 'svelte + markdown + latex',
    homepage: 'https://sveltex.dev',
    options: addonOptions,

    setup: ({ isKit, unsupported }) => {
        if (!isKit) unsupported('Requires SvelteKit');
    },

    run: ({ sv, options, file, directory, packageManager }) => {
        const { markdownBackend, codeBackend, mathBackend, demoRoute } =
            options;

        // --- Dependencies ----------------------------------------------------
        // `@nvl/sveltex` itself, plus the peer dependencies for the chosen
        // backends, are added as dev dependencies of the consuming project.
        sv.devDependency('@nvl/sveltex', '^0.5.0');
        const backendDeps: Record<string, string> = {
            ...markdownDependencies[markdownBackend],
            ...codeDependencies[codeBackend],
            ...mathDependencies[mathBackend],
        };
        for (const [name, range] of Object.entries(backendDeps)) {
            sv.devDependency(name, range);
        }

        // `@nvl/sveltex` pulls in `core-js-pure` (via `xregexp`), whose install
        // script pnpm blocks by default — leaving `pnpm install` to fail with
        // `ERR_PNPM_IGNORED_BUILDS`, or the scaffold to write a `set this to
        // true or false` placeholder into `pnpm-workspace.yaml`. Pre-approve it
        // for pnpm projects so onboarding stays clean (mirrors how the official
        // add-ons handle their native build-script dependencies).
        if (packageManager === 'pnpm') {
            sv.file(
                file.findUp('pnpm-workspace.yaml'),
                pnpm.allowBuilds('core-js-pure'),
            );
        }

        // --- sveltex.config.js -----------------------------------------------
        // Always a `.js` config — even for TypeScript projects. `svelte.config
        // .js` imports this file, and a plain Node `import()` of a `.ts` file
        // only works on Node >=22.18; the generated config has no TS syntax.
        const sveltexConfigPath = 'sveltex.config.js';
        sv.file(
            sveltexConfigPath,
            transforms.text(({ content }) => {
                // Don't overwrite an existing config -- but tell the user we
                // saw it, so they know to reconcile their backend choices
                // (and any custom configuration) with what the add-on is
                // about to wire into `svelte.config.{js,ts}`.
                if (content) {
                    // The sv API has no first-class log helper at v0.15;
                    // fall through to stderr so the user at least sees the
                    // notice next to the rest of `sv add`'s output. The
                    // backend selection from the prompts and the existing
                    // config file may diverge -- worth saying out loud.
                    process.stderr.write(
                        'sveltex.config.js already exists; keeping your ' +
                            'version. Check that its backend selection ' +
                            'matches the choices you picked here, and that ' +
                            'the chosen backends are installed.\n',
                    );
                    return false;
                }
                return sveltexConfig(markdownBackend, codeBackend, mathBackend);
            }),
        );

        // --- svelte.config.{js,ts} -------------------------------------------
        // Wire the SvelTeX preprocessor and the `.sveltex` extension into the
        // existing Svelte config (mirrors the official `mdsvex` add-on).
        const relativeConfigImport = file.getRelative({
            from: file.svelteConfig,
            to: sveltexConfigPath,
        });
        sv.file(
            file.svelteConfig,
            transforms.script(({ ast, js }) => {
                js.imports.addDefault(ast, {
                    as: 'sveltexPreprocessor',
                    from: relativeConfigImport,
                });

                const { value: exportDefault } = js.exports.createDefault(ast, {
                    fallback: js.object.create({}),
                });

                // `preprocess` — coerce to an array, then insert the SvelTeX
                // preprocessor at the *front*. The property may already exist
                // as a single (non-array) preprocessor, so the runtime type
                // guard is required even though the fallback is an array.
                // Reading `.value` off the property node (rather than `js
                // .object.property`'s fallback-narrowed return) keeps the type
                // wide.
                const preprocessProp = js.object.propertyNode(exportDefault, {
                    name: 'preprocess',
                    fallback: js.array.create(),
                });
                let preprocessArray: AstTypes.ArrayExpression;
                if (preprocessProp.value.type === 'ArrayExpression') {
                    preprocessArray = preprocessProp.value;
                } else {
                    preprocessArray = js.array.create();
                    js.array.append(
                        preprocessArray,
                        preprocessProp.value as AstTypes.Expression,
                    );
                    js.object.overrideProperties(exportDefault, {
                        preprocess: preprocessArray,
                    });
                }
                // SvelTeX must run before any other markup preprocessor:
                // it turns `.sveltex` (Markdown + LaTeX) into valid Svelte,
                // whereas e.g. `vitePreprocess` chokes on raw LaTeX
                // backslashes if it sees the file first.
                js.array.prepend(
                    preprocessArray,
                    js.common.parseExpression('sveltexPreprocessor'),
                );

                // `extensions` — make sure `.svelte` and `.sveltex` are
                // present. `js.array.append` is idempotent for string
                // literals, so this is safe to run more than once. Mirror
                // the `preprocess` branch's coercion: if the existing value
                // isn't an array literal (e.g. a spread / identifier /
                // `[...x, '.svelte']`), wrap it in a fresh array and append
                // there, rather than silently doing nothing and leaving the
                // project without `.sveltex` registered.
                const extensionsProp = js.object.propertyNode(exportDefault, {
                    name: 'extensions',
                    fallback: js.array.create(),
                });
                let extensionsArray: AstTypes.ArrayExpression;
                if (extensionsProp.value.type === 'ArrayExpression') {
                    extensionsArray = extensionsProp.value;
                } else {
                    extensionsArray = js.array.create();
                    js.array.append(
                        extensionsArray,
                        extensionsProp.value as AstTypes.Expression,
                    );
                    js.object.overrideProperties(exportDefault, {
                        extensions: extensionsArray,
                    });
                }
                js.array.append(extensionsArray, '.svelte');
                js.array.append(extensionsArray, '.sveltex');
            }),
        );

        // --- Demo route ------------------------------------------------------
        // Created at a dedicated `/sveltex-demo` route rather than `/` so it
        // never collides with an existing `+page.svelte` in the consumer's
        // project.
        if (demoRoute) {
            sv.file(
                `${directory.kitRoutes}/sveltex-demo/+page.sveltex`,
                transforms.text(({ content }) => {
                    if (content) return false;
                    return demoRouteContent(mathBackend);
                }),
            );
        }
    },

    nextSteps: ({ options }) => {
        const steps = ['Review your SvelTeX backends in `sveltex.config.js`.'];
        if (options.demoRoute) {
            steps.push(
                'Visit the `/sveltex-demo` route to see the SvelTeX demo page.',
            );
        }
        steps.push(
            'For editor support in `.sveltex` files (syntax highlighting, ' +
                'diagnostics, hover, completion), install the SvelTeX editor ' +
                'extension. Avoid pointing Prettier or ESLint at `.sveltex` ' +
                'files; they are not valid Svelte. See ' +
                'https://sveltex.dev/docs/editor-integration.',
        );
        steps.push(
            'The `<TeX>` component (LaTeX → SVG) is commented out in ' +
                '`sveltex.config.js` by default; enabling it needs a local TeX ' +
                'distribution (see the System prerequisites docs).',
        );
        steps.push(
            'See https://sveltex.dev for documentation and configuration options.',
        );
        return steps;
    },
});
