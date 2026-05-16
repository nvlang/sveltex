import { defineAddon, defineAddonOptions } from 'sv';
import { transforms, type AstTypes } from '@sveltejs/sv-utils';

/**
 * Peer dependencies pulled in by each backend choice, mirrored from
 * `packages/create-sveltex/src/plopfile.ts`. Versions are taken from the
 * `peerDependencies` field of `@nvl/sveltex`'s `package.json` so that a project
 * scaffolded by this add-on satisfies SvelTeX's peer-dependency ranges.
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
    marked: { marked: '^16.0.0' },
    none: {},
} as const;

const codeDependencies = {
    shiki: { shiki: '^3.0.0' },
    'starry-night': {
        '@wooorm/starry-night': '^3.3.0',
        'hast-util-find-and-replace': '^5.0.1',
        'hast-util-to-html': '^9.0.1',
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
        default: 'unified' as MarkdownBackend,
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
        default: 'shiki' as CodeBackend,
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
        default: 'mathjax' as MathBackend,
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
            // Content inside <TeX ref="...">...</TeX> will be compiled by the
            // local TeX distribution. For example, you can try the following:
            // "<TeX ref="example">\\LaTeX</TeX>". Note that the "ref" attribute
            // is mandatory.
            TeX: {
                type: 'tex',
            },
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

    run: ({ sv, options, file, language, directory }) => {
        const { markdownBackend, codeBackend, mathBackend, demoRoute } =
            options;

        // --- Dependencies ----------------------------------------------------
        // `@nvl/sveltex` itself, plus the peer dependencies for the chosen
        // backends, are added as dev dependencies of the consuming project.
        sv.devDependency('@nvl/sveltex', '^0.4.4');
        const backendDeps: Record<string, string> = {
            ...markdownDependencies[markdownBackend],
            ...codeDependencies[codeBackend],
            ...mathDependencies[mathBackend],
        };
        for (const [name, range] of Object.entries(backendDeps)) {
            sv.devDependency(name, range);
        }

        // --- sveltex.config.{js,ts} ------------------------------------------
        const sveltexConfigPath = `sveltex.config.${language}`;
        sv.file(
            sveltexConfigPath,
            transforms.text(({ content }) => {
                // Don't overwrite an existing config.
                if (content) return false;
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

                // `preprocess` — coerce to an array, then append the SvelTeX
                // preprocessor instance. The property may already exist as a
                // single (non-array) preprocessor, so the runtime type guard
                // is required even though the fallback is an array. Reading
                // `.value` off the property node (rather than `js.object
                // .property`'s fallback-narrowed return) keeps the type wide.
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
                js.array.append(
                    preprocessArray,
                    js.common.parseExpression('sveltexPreprocessor'),
                );

                // `extensions` — make sure `.svelte` and `.sveltex` are
                // present. `js.array.append` is idempotent for string
                // literals, so this is safe to run more than once.
                const extensionsProp = js.object.propertyNode(exportDefault, {
                    name: 'extensions',
                    fallback: js.array.create(),
                });
                if (extensionsProp.value.type === 'ArrayExpression') {
                    js.array.append(extensionsProp.value, '.svelte');
                    js.array.append(extensionsProp.value, '.sveltex');
                }
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

    nextSteps: ({ options, language }) => {
        const steps = [
            `Review your SvelTeX backends in \`sveltex.config.${language}\`.`,
        ];
        if (options.demoRoute) {
            steps.push(
                'Visit the `/sveltex-demo` route to see the SvelTeX demo page.',
            );
        }
        steps.push(
            'See https://sveltex.dev for documentation and configuration options.',
        );
        return steps;
    },
});
