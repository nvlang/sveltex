import { sveltex } from '@nvl/sveltex';
import { randomUUID } from 'crypto';

// 4 x 4 x 3 = 48 configurations
export const backendConfigs = () =>
    cartesianProduct(
        ['unified', 'markdown-it', 'micromark', 'marked'] as const,
        ['shiki', 'starry-night', 'highlight.js', 'escape'] as const,
        ['mathjax-svg', 'mathjax-chtml', 'katex'] as const,
    );
// export const backendConfigs = () =>
//     cartesianProduct(
//         ['unified'] as const,
//         ['shiki'] as const,
//         ['katex'] as const,
//     );

export const preprocessors = async () =>
    await Promise.all(
        backendConfigs().map(
            async ([markdownBackend, codeBackend, mathBackend]) => {
                return await sveltex(
                    {
                        markdownBackend,
                        codeBackend,
                        mathBackend: mathBackend.split('-')[0] as
                            | 'mathjax'
                            | 'katex',
                    },
                    {
                        tex: {
                            caching: {
                                enabled: false,
                                cacheDirectory:
                                    'node_modules/.cache/@nvl/sveltex/' +
                                    randomUUID(),
                            },
                        },
                        extensions: [
                            `.${markdownBackend.replace(/-/g, '')}AND${codeBackend.replace(/-/g, '')}AND${mathBackend.replace(/-/g, '')}ANDsveltex`,
                        ],
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
                        math: mathBackend.startsWith('mathjax')
                            ? {
                                  outputFormat: mathBackend
                                      .split('-')[1]
                                      ?.toLowerCase() as 'svg' | 'chtml',
                              }
                            : {},
                        code: {
                            shiki: { theme: 'github-dark-default' },
                            transformers: {
                                post: (str) =>
                                    str.replace(
                                        ' tabindex="0"><code>',
                                        '><code>',
                                    ),
                            },
                        },
                        // code: codeBackend === 'starry-night'
                        //     ? { languages: 'all' }
                        //     : codeBackend === 'shiki'
                        //       ? {
                        //             shiki: { theme: 'github-dark-default' },
                        //             transformers: {
                        //                 post: (str) =>
                        //                     str.replace(
                        //                         ' tabindex="0"><code>',
                        //                         '><code>',
                        //                     ),
                        //             },
                        //         }
                        //       : {},
                    },
                );
            },
        ),
    );

export function cartesianProduct<X1>(x1: X1[]): [X1][];
export function cartesianProduct<X1, X2>(x1: X1[], x2: X2[]): [X1, X2][];
export function cartesianProduct<X1, X2, X3>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
): [X1, X2, X3][];
export function cartesianProduct<X1, X2, X3, X4>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
): [X1, X2, X3, X4][];
export function cartesianProduct<X1, X2, X3, X4, X5>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
): [X1, X2, X3, X4, X5][];
export function cartesianProduct<X1, X2, X3, X4, X5, X6>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
    x6: X6[],
): [X1, X2, X3, X4, X5, X6][];
export function cartesianProduct(...a: unknown[][]) {
    return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
}
