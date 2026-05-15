/**
 * SvelTeX configuration for the showcase website.
 *
 * Unlike the auto-generated combo projects (which sweep every backend
 * permutation), the showcase pins one realistic, production-like backend
 * combination and instead exercises SvelTeX's *content* features in depth:
 *
 *   - markdown backend: `marked` (GFM: tables, task lists, strikethrough)
 *   - code backend:     `shiki`
 *   - math backend:     MathJax v4, SVG output, New Computer Modern font
 *
 * SVG math output is self-contained (glyphs are emitted as `<path>` data), so
 * screenshots are deterministic and do not depend on web-font loading.
 */
import { sveltex } from '@nvl/sveltex';

export const preprocessor = await sveltex(
    {
        markdownBackend: 'marked',
        codeBackend: 'shiki',
        mathBackend: 'mathjax',
    },
    {
        extensions: ['.sveltex'],
        math: {
            outputFormat: 'svg',
            font: 'newcm',
        },
        code: {
            shiki: { theme: 'github-dark-default' },
        },
        verbatim: {
            Verb: { type: 'escape', component: 'p' },
            tex: {
                type: 'tex',
                aliases: ['tikz', 'TikZ', 'TeX'],
                preamble: [
                    '\\usepackage{mathtools}',
                    '\\usepackage{amsmath}',
                    '\\usepackage{microtype}',
                    '\\usepackage{tikz}',
                ].join('\n'),
            },
        },
        tex: {
            caching: {
                enabled: false,
                cacheDirectory: 'node_modules/.cache/@nvl/sveltex/showcase',
            },
        },
    },
);
