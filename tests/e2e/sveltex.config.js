"use strict";
import { sveltex } from "@nvl/sveltex";
import { randomUUID } from "crypto";
export const backendConfigs = () => cartesianProduct(
  ["unified"],
  ["shiki"],
  ["katex"]
);
export const preprocessors = async () => await Promise.all(
  backendConfigs().map(
    async ([markdownBackend, codeBackend, mathBackend]) => {
      return await sveltex(
        {
          markdownBackend,
          codeBackend,
          mathBackend: mathBackend.split("-")[0]
        },
        {
          tex: {
            caching: {
              enabled: false,
              cacheDirectory: "node_modules/.cache/@nvl/sveltex/" + randomUUID()
            }
          },
          extensions: [
            `.${markdownBackend.replace(/-/g, "")}AND${codeBackend.replace(/-/g, "")}AND${mathBackend.replace(/-/g, "")}ANDsveltex`
          ],
          verbatim: {
            Verb: { type: "escape", component: "p" },
            tex: {
              type: "tex",
              aliases: ["tikz", "TikZ", "TeX"],
              preamble: [
                "\\usepackage{mathtools}",
                "\\usepackage{amsmath}",
                "\\usepackage{microtype}",
                "\\usepackage{tikz}"
              ].join("\n")
            }
          },
          math: mathBackend.startsWith("mathjax") ? {
            outputFormat: mathBackend.split("-")[1]?.toLowerCase()
          } : {},
          code: {
            shiki: { theme: "github-dark-default" },
            transformers: {
              post: (str) => str.replace(
                ' tabindex="0"><code>',
                "><code>"
              )
            }
          }
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
        }
      );
    }
  )
);
export function cartesianProduct(...a) {
  return a.reduce((a2, b) => a2.flatMap((d) => b.map((e) => [d, e].flat())));
}
