"use strict";
import { sveltex } from "@nvl/sveltex";
export const backendConfigs = cartesianProduct(
  ["unified", "markdown-it", "micromark", "marked"],
  ["shiki", "starry-night", "highlight.js", "escape"],
  ["mathjax-svg", "mathjax-chtml", "katex"]
);
export const preprocessors = await Promise.all(
  backendConfigs.map(async ([markdownBackend, codeBackend, mathBackend]) => {
    return await sveltex(
      {
        markdownBackend,
        codeBackend,
        mathBackend: mathBackend.split("-")[0]
      },
      {
        general: {
          extensions: [
            `.${markdownBackend.replace(/-/g, "")}AND${codeBackend.replace(/-/g, "")}AND${mathBackend.replace(/-/g, "")}ANDsveltex`
          ]
        },
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
        code: codeBackend === "starry-night" ? { languages: "all" } : codeBackend === "shiki" ? {
          shiki: { theme: "github-dark-default" },
          transformers: {
            post: (str) => str.replace(
              ' tabindex="0"><code>',
              "><code>"
            )
          }
        } : {}
      }
    );
  })
);
export function cartesianProduct(...a) {
  return a.reduce((a2, b) => a2.flatMap((d) => b.map((e) => [d, e].flat())));
}
