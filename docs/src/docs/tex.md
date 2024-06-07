<script lang="ts" setup>
import PipelineImage from './PipelineImage.vue';
import { PhLightning, PhHammer, PhTextT, PhDatabase, PhPalette, PhBird } from '@phosphor-icons/vue';
</script>

# Overview

<p class="text-lg">
SvelTeX's pipeline to compile LaTeX inside your markup and import the result.
</p>




## Features

<div class="features-list mt-8">

-   <PhBird color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **LaTeX ecosystem**: Sveltex uses your local LaTeX distribution to compile
    your documents, so any LaTeX package (e.g.,
    [TikZ](https://www.ctan.org/pkg/pgf)) is at your disposal.

-   <PhHammer color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Compilation**: Sveltex natively supports pdfLaTeX, LuaLaTeX, and XeLaTeX,
    as well as LaTeXmk and custom compilation instructions.

-   <PhTextT color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Embedded fonts**: Each SVG file embeds all necessary font glyphs as WOFF2
    data URIs by default, ensuring that the SVGs are fully self-contained (save
    for any potential CSS variables). This also works with custom fonts imported
    via e.g. [`fontspec`](https://www.ctan.org/pkg/fontspec).

-   <PhLightning color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Optimization**: The SVG code is optimized both by
    [dvisvgm](https://dvisvgm.de/) and [SVGO](https://svgo.dev/), so the SVGs
    you ship are as small as possible.

-   <PhDatabase color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Caching**: A simple but robust caching mechanism prevents unnecessary
    recompilations, speeding up build times and helping Vite's
    [**HMR**](https://vitejs.dev/guide/features#hot-module-replacement) remain
    performant.

-   <PhPalette color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Adaptive theming**: The generated SVGs will use `currentColor` by default.
    Also, **CSS color variables** work anywhere colors work in your LaTeX code
    (excl. gradients).

</div>


## Configuration

SvelTeX's pipeline for LaTeX is essentially split into three steps:

-   **Compilation**: TeX → DVI/PDF/XDV, done by your chosen LaTeX engine.
-   **Conversion**: DVI/PDF/XDV → SVG, done by dvisvgm or [Poppler](https://poppler.freedesktop.org/).
-   **Optimization**: SVG → Svelte, done with the help of SVGO.

The configuration for SvelTeX's LaTeX functionality mirrors this divide. Hover
on any of the properties below to see a tooltip with more information.

```ts twoslash [sveltex.config.ts]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({}, {
    tex: {
        caching: {
            cacheDirectory: 'node_modules/.cache/@nvl/sveltex',
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
                    color: true,
                    progress: true,
                    verbosity: 0b0011,
                    message: null,
                },
                customArgs: [],
                svg: {
                    bbox: [2, 'pt'],
                    bitmapFormat: 'png',
                    currentColor: '#000',
                    fontFormat: 'woff2',
                    relative: true,
                    // ...
                },
                processing: {
                    exactBbox: true,
                    // ...
                },
                svgTransformations: {
                    // ...
                },
            },
            outputDirectory: 'src/sveltex',
            overrideConversion: null,
            poppler: {
                // ...
            },
        },
        debug: {
            verbose: false,
        },
        optimization: {
            currentColor: '#000',
            overrideOptimization: null,
            svgo: {
                // ...
            },
        },
    }
})
```


## Implementation

<PipelineImage class="mt-10 mb-8" />

1.  **Compilation (TeX → DVI/PDF/XDV)**: This is the most laborious step, and
    will usually take anywhere from ~500ms to several seconds, depending on the
    complexity of the document. Note that the first three of the steps below
    could more accurately be described as a "Svelte → TeX" step in preparation
    for the actual compilation; however, because it's just about some
    Sveltex-internal processing, and not necessarily of interest to the end
    user, I've merged it with the compilation step.

    1.  **Parse** the LaTeX component from the markdown file. Note in particular
        the component tag, the `ref` attribute, and the inner content of the
        component (the LaTeX code).
    2.  **Escape** CSS variables.

        1.  Extract CSS variables (e.g., `var(--red)`).
        2.  Compute the SHA256 hashes of the CSS variables' names, and use the 6
            first characters of the hex form of each hash to define a color in
            the LaTeX document with which to replace the `var(--red)`. For
            example: `--red` → `a1b2c3d4e5f6...` → `a1b2c3` →
            `\definecolor{sveltexa1b2c3}{HTML}{a1b2c3}`.
        3.  Replace the `var(--red)` in the LaTeX document with the color
            defined in the previous step. This will allow the LaTeX document to
            be compiled; the generated color will be replaced by `var(--red)` at
            the very end.

    3.  **Write** the LaTeX code (with any CSS variables "escaped" to
        placeholder colors) to a file in the cache directory. Use the component
        tag and the `ref` attribute as a composite key with which to identify
        the (location of the) file; in particular, the file is written to
        `node_modules/.cache/@nvl/sveltex/<TAG>/<REF>/root.tex`.
    4.  **Run** the appropriate LaTeX compiler (pdfLaTeX, LuaLaTeX, XeLaTeX,
        pdfLaTeXmk, or LuaLaTeXmk) on the file by spawning a Node.js [child
        process](https://nodejs.org/api/child_process.html), generating a DVI,
        PDF, or XDV file, depending on the chosen compiler and the user's
        configuration.

2.  **Conversion (DVI/PDF/XDV → SVG)**: Next, the DVI, PDF, or XDV file is
    converted to an SVG file. This step is relatively quick, usually taking
    between ~200ms and ~600ms. In addition to
    [dvisvgm](https://ctan.org/pkg/dvisvgm), which can convert all of the
    aforementioned intermediate file formats, Sveltex also supports
    [Poppler](https://poppler.freedesktop.org) for PDF → SVG conversion
    specifically. However, I'd strongly encourage using DVI/XDV over PDF, and,
    even if using PDF, I'd still recommend using dvisvgm over Poppler. Poppler
    is mainly supported for the sake of having a fallback option.

    -   **dvisvgm**: Run dvisvgm on the DVI/PDF/XDV file by spawning another
        Node.js child process. Then, read the generated SVG file in preparation
        for the optimization step below.
    -   **Poppler**: Call Poppler with
        [`node-poppler`](https://www.npmjs.com/package/node-poppler) to convert
        the PDF to an SVG string.

3.  **Optimization (SVG → Svelte)**: Lastly, the SVG code is optimized and
    converted to a Svelte component. This step is extremely quick, usually
    taking less than 10ms.

    1.  **Optimize** the SVG code with
        [`svgo`](https://www.npmjs.com/package/svgo). This will remove
        unnecessary attributes, comments, and other elements from the SVG code.
    2.  **Override** the `.svg` file (if dvisvgm was used) with the optimized SVG code
    3.  **Convert** to a Svelte component. Given that SVGO has already stripped
        the SVG of its DOCTYPE, the only thing left to do to have a Svelte
        component is changing the file extension from `.svg` to `.svelte`.


## DVI, XDV, and PDF

The DVI, XDV, and PDF formats are all intermediate formats that can be generated
by TeX engines. They're not user-facing, however, and will be kept in the
caching directory (usually `node_modules/.cache/@nvl/sveltex`).

-   The [device-independent file format (DVI)](https://en.wikipedia.org/wiki/Device_independent_file_format) is LaTeX's original output format, and, although it's becoming progressively rarer due to the prevalence of the PDF, it's essential for Sveltex, as DVI → SVG conversion is much more powerful than PDF → SVG conversion.

-   The [extended DVI file format (XDV)](https://en.wikipedia.org/wiki/XeTeX) is XeLaTeX's custom extension of the DVI format. While this might've been necessary at one point for essential features like supporting custom fonts, newer versions of the DVI format allow LuaLaTeX to support almost all of XeLaTeX's features, while arguably being better maintained.

-   The [portable document format (PDF)](https://en.wikipedia.org/wiki/PDF) is the de facto standard output format for LaTeX documents nowadays. However, it doesn't work nearly as well as DVI for SVG conversion, which is why it's not the default format for Sveltex.


## Benchmarks

::::: details Results for `gradient.tex`

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| pdfLaTeX → DVI | 0.484 ± 0.011 | 0.469 | 0.500 | 1.38 ± 0.04 |
| pdfLaTeX → PDF | 0.515 ± 0.015 | 0.488 | 0.542 | 1.47 ± 0.05 |
| XeLaTeX → XDV | 0.538 ± 0.004 | 0.533 | 0.543 | 1.53 ± 0.03 |
| pdfLaTeXmk → DVI | 0.686 ± 0.026 | 0.662 | 0.726 | 1.96 ± 0.08 |
| XeLaTeXmk → XDV | 0.695 ± 0.014 | 0.669 | 0.710 | 1.98 ± 0.05 |
| pdfLaTeXmk → PDF | 0.720 ± 0.026 | 0.680 | 0.757 | 2.05 ± 0.08 |
| XeLaTeX → PDF | 1.029 ± 0.038 | 0.986 | 1.104 | 2.93 ± 0.12 |
| LuaLaTeX → DVI | 1.158 ± 0.019 | 1.126 | 1.180 | 3.30 ± 0.08 |
| LuaLaTeX → PDF | 1.205 ± 0.026 | 1.166 | 1.250 | 3.43 ± 0.10 |
| XeLaTeXmk → PDF | 1.289 ± 0.041 | 1.230 | 1.340 | 3.68 ± 0.13 |
| LuaLaTeXmk → DVI | 1.436 ± 0.059 | 1.371 | 1.583 | 4.10 ± 0.18 |
| LuaLaTeXmk → PDF | 1.457 ± 0.048 | 1.398 | 1.538 | 4.15 ± 0.16 |

:::: details `gradient.tex`
::: code-group
```latex [gradient-dvi.tex]
a
```
```latex [gradient-pdf.tex]
b
```
:::
::::
:::: details `gradient.svg`
![gradient.svg](/latex/bench/gradient.svg)
::::
:::::

:::: details Results for `plot.tex`

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| pdfLaTeX → DVI | 1.142 ± 0.014 | 1.125 | 1.179 | 3.26 ± 0.07 |
| XeLaTeX → XDV | 1.239 ± 0.018 | 1.218 | 1.281 | 3.53 ± 0.08 |
| pdfLaTeXmk → DVI | 1.377 ± 0.029 | 1.326 | 1.431 | 3.93 ± 0.11 |
| XeLaTeXmk → XDV | 1.381 ± 0.044 | 1.344 | 1.478 | 3.94 ± 0.15 |
| pdfLaTeX → PDF | 1.468 ± 0.012 | 1.448 | 1.486 | 4.19 ± 0.09 |
| pdfLaTeXmk → PDF | 1.694 ± 0.029 | 1.651 | 1.747 | 4.83 ± 0.12 |
| XeLaTeX → PDF | 1.717 ± 0.018 | 1.691 | 1.748 | 4.89 ± 0.10 |
| XeLaTeXmk → PDF | 1.927 ± 0.017 | 1.905 | 1.952 | 5.49 ± 0.11 |
| LuaLaTeX → DVI | 1.979 ± 0.031 | 1.953 | 2.046 | 5.64 ± 0.14 |
| LuaLaTeX → PDF | 2.058 ± 0.032 | 2.017 | 2.117 | 5.87 ± 0.14 |
| LuaLaTeXmk → DVI | 2.276 ± 0.033 | 2.238 | 2.328 | 6.49 ± 0.15 |
| LuaLaTeXmk → PDF | 2.350 ± 0.044 | 2.277 | 2.443 | 6.70 ± 0.18 |

::: code-group

```latex [DVI]
\documentclass[dvisvgm]{standalone}
\usepackage{xcolor}
\usepackage{tikz}
\usetikzlibrary{datavisualization.formats.functions}

\makeatletter
\@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
\makeatother

\begin{document}
\begin{tikzpicture}
\tikzdatavisualizationset {
  example visualization/.style={
    scientific axes=clean,
    y axis={ticks={style={
          /pgf/number format/fixed,
          /pgf/number format/fixed zerofill,
          /pgf/number format/precision=2}}},
    x axis={ticks={tick suffix=${}^\circ$}},
    1={label in legend={text=$\frac{1}{6}\sin 11x$}},
    2={label in legend={text=$\frac{1}{7}\sin 12x$}},
    3={label in legend={text=$\frac{1}{8}\sin 13x$}},
    4={label in legend={text=$\frac{1}{9}\sin 14x$}},
    5={label in legend={text=$\frac{1}{10}\sin 15x$}},
    6={label in legend={text=$\frac{1}{11}\sin 16x$}},
    7={label in legend={text=$\frac{1}{12}\sin 17x$}},
    8={label in legend={text=$\frac{1}{13}\sin 18x$}}
  }
}
\tikz \datavisualization data group {sin functions} = {
  data [format=function] {
    var set : {1,...,8};
    var x : interval [0:50];
    func y = sin(\value x * (\value{set}+10))/(\value{set}+5);
  }
};
\datavisualization [
  visualize as smooth line/.list=
{1,2,3,4,5,6,7,8},
  example visualization,
  style sheet=strong colors,
  style sheet=vary dashing]
data group {sin functions};
\end{tikzpicture}
\end{document}
```

```latex [PDF]
\documentclass{standalone}
\usepackage{xcolor}
\usepackage{tikz}
\usetikzlibrary{datavisualization.formats.functions}

\makeatletter
\@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
\makeatother

\begin{document}
\begin{tikzpicture}
\tikzdatavisualizationset {
  example visualization/.style={
    scientific axes=clean,
    y axis={ticks={style={
          /pgf/number format/fixed,
          /pgf/number format/fixed zerofill,
          /pgf/number format/precision=2}}},
    x axis={ticks={tick suffix=${}^\circ$}},
    1={label in legend={text=$\frac{1}{6}\sin 11x$}},
    2={label in legend={text=$\frac{1}{7}\sin 12x$}},
    3={label in legend={text=$\frac{1}{8}\sin 13x$}},
    4={label in legend={text=$\frac{1}{9}\sin 14x$}},
    5={label in legend={text=$\frac{1}{10}\sin 15x$}},
    6={label in legend={text=$\frac{1}{11}\sin 16x$}},
    7={label in legend={text=$\frac{1}{12}\sin 17x$}},
    8={label in legend={text=$\frac{1}{13}\sin 18x$}}
  }
}
\tikz \datavisualization data group {sin functions} = {
  data [format=function] {
    var set : {1,...,8};
    var x : interval [0:50];
    func y = sin(\value x * (\value{set}+10))/(\value{set}+5);
  }
};
\datavisualization [
  visualize as smooth line/.list={1,2,3,4,5,6,7,8},
  example visualization,
  style sheet=strong colors,
  style sheet=vary dashing]
data group {sin functions};
\end{tikzpicture}
\end{document}
```

::::

::: details Results for `text.tex`

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| pdfLaTeX → DVI | 0.351 ± 0.006 | 0.337 | 0.356 | 1.00 |
| XeLaTeX → XDV | 0.454 ± 0.007 | 0.446 | 0.465 | 1.29 ± 0.03 |
| pdfLaTeXmk → DVI | 0.503 ± 0.006 | 0.494 | 0.511 | 1.44 ± 0.03 |
| XeLaTeXmk → XDV | 0.504 ± 0.014 | 0.490 | 0.528 | 1.44 ± 0.05 |
| pdfLaTeX → PDF | 0.630 ± 0.013 | 0.615 | 0.656 | 1.80 ± 0.05 |
| pdfLaTeXmk → PDF | 0.805 ± 0.011 | 0.786 | 0.818 | 2.30 ± 0.05 |
| XeLaTeX → PDF | 0.944 ± 0.013 | 0.927 | 0.967 | 2.69 ± 0.06 |
| LuaLaTeX → DVI | 0.973 ± 0.013 | 0.955 | 0.999 | 2.77 ± 0.06 |
| LuaLaTeX → PDF | 1.062 ± 0.018 | 1.041 | 1.095 | 3.03 ± 0.08 |
| XeLaTeXmk → PDF | 1.112 ± 0.020 | 1.070 | 1.143 | 3.17 ± 0.08 |
| LuaLaTeXmk → DVI | 1.164 ± 0.016 | 1.147 | 1.193 | 3.32 ± 0.08 |
| LuaLaTeXmk → PDF | 1.269 ± 0.017 | 1.239 | 1.297 | 3.62 ± 0.08 |

:::

:::: details Results for `transparency.tex`

| Command | Mean [s] | Min [s] | Max [s] | Relative |
|:---|---:|---:|---:|---:|
| pdfLaTeX → DVI | 0.471 ± 0.012 | 0.453 | 0.487 | 1.34 ± 0.04 |
| pdfLaTeX → PDF | 0.481 ± 0.010 | 0.465 | 0.495 | 1.37 ± 0.04 |
| XeLaTeX → XDV | 0.538 ± 0.011 | 0.521 | 0.553 | 1.53 ± 0.04 |
| XeLaTeXmk → XDV | 0.678 ± 0.008 | 0.666 | 0.688 | 1.93 ± 0.04 |
| pdfLaTeXmk → DVI | 0.680 ± 0.017 | 0.665 | 0.721 | 1.94 ± 0.06 |
| pdfLaTeXmk → PDF | 0.689 ± 0.011 | 0.677 | 0.708 | 1.96 ± 0.05 |
| XeLaTeX → PDF | 1.012 ± 0.026 | 0.979 | 1.065 | 2.89 ± 0.09 |
| LuaLaTeX → DVI | 1.146 ± 0.019 | 1.111 | 1.172 | 3.27 ± 0.08 |
| LuaLaTeX → PDF | 1.154 ± 0.043 | 1.123 | 1.261 | 3.29 ± 0.14 |
| XeLaTeXmk → PDF | 1.226 ± 0.017 | 1.200 | 1.251 | 3.49 ± 0.08 |
| LuaLaTeXmk → PDF | 1.403 ± 0.019 | 1.381 | 1.444 | 4.00 ± 0.09 |
| LuaLaTeXmk → DVI | 1.406 ± 0.047 | 1.368 | 1.533 | 4.01 ± 0.15 |

::: code-group

```latex [DVI]
\documentclass[dvisvgm]{standalone}
\usepackage{tikz}
\usepgflibrary{shadings}

\makeatletter
\@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
\makeatother

\begin{document}
\begin{tikzpicture}
\fill [ left color = red, right color = blue ] (0,0) rectangle (2,2);
\fill [ left color = blue, right color = green ] (2,0) rectangle (4,2);
\fill [ left color = green, right color = red ] (4,0) rectangle (6,2);
\end{tikzpicture}
\end{document}
```

```latex [PDF]
\documentclass{standalone}
\usepackage{tikz}
\usepgflibrary{shadings}

\makeatletter
\@ifpackageloaded{xcolor}{}{\usepackage{xcolor}}
\makeatother

\begin{document}
\begin{tikzpicture}
\fill [ left color = red, right color = blue ] (0,0) rectangle (2,2);
\fill [ left color = blue, right color = green ] (2,0) rectangle (4,2);
\fill [ left color = green, right color = red ] (4,0) rectangle (6,2);
\end{tikzpicture}
\end{document}
```

:::

::::


:::: details Running the benchmarks

Compilation:

```sh
hyperfine \
    --prepare 'rm -rf build && mkdir build' \
    --warmup 3 \
    --parameter-list file gradient,plot,text,transparency \
    --export-json benchmark.json \
    --export-csv benchmark.csv \
    --export-markdown benchmark.md \
    'latexmk -pdflua -outdir=build {file}-pdf' \
    'latexmk -dvilua -outdir=build {file}-dvi' \
    'latexmk -pdfxe -outdir=build {file}-pdf' \
    'latexmk -xdv -outdir=build {file}-dvi' \
    'latexmk -pdf -outdir=build {file}-pdf' \
    'latexmk -dvi -outdir=build {file}-dvi' \
    'lualatex --output-format=pdf --output-dir=build {file}-pdf' \
    'lualatex --output-format=dvi --output-dir=build {file}-dvi' \
    'pdflatex -output-format=pdf -output-directory=build {file}-pdf' \
    'pdflatex -output-format=dvi -output-directory=build {file}-dvi' \
    'xelatex -output-directory=build {file}-pdf' \
    'xelatex -output-directory=build -no-pdf {file}-dvi'
```

Conversion:

```sh
hyperfine \
    --prepare 'rm -rf build && mkdir build' \
    --warmup 3 \
    --parameter-list file gradient,plot,text,transparency \
    --export-json benchmark.json \
    --export-csv benchmark.csv \
    --export-markdown benchmark.md \
    'dvisvgm --pdf build/{file}-pdf' \
    'dvisvgm build/{file}-dvi' \
    ''
```

::::
