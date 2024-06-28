<script lang="ts" setup>
import { PhLightning, PhHammer, PhTextT, PhDatabase, PhPalette, PhBird, PhGear, PhTerminal } from '@phosphor-icons/vue';
</script>

# TeX

<p class="text-lg">
Have SvelTeX compile LaTeX inside your markup and import the result.
</p>


## Features

<div class="features-list mt-8">

-   <PhBird color="var(--168-700)" :size="28" weight="duotone"/>

    **LaTeX ecosystem:** Sveltex uses your local LaTeX distribution to compile
    your documents, so any LaTeX package (e.g.,
    [TikZ](https://www.ctan.org/pkg/pgf)) is at your disposal.

-   <PhHammer color="var(--168-700)" :size="28" weight="duotone"/>

    **Compilation:** Sveltex natively supports pdfLaTeX, LuaLaTeX, and XeLaTeX,
    as well as LaTeXmk and custom compilation instructions.

-   <PhTextT color="var(--168-700)" :size="28" weight="duotone"/>

    **Embedded fonts:** Each SVG file embeds all necessary font glyphs as WOFF2
    data URIs by default, ensuring that the SVGs are fully self-contained (save
    for any potential CSS variables). This also works with custom fonts imported
    via e.g. [`fontspec`](https://www.ctan.org/pkg/fontspec).

-   <PhLightning color="var(--168-700)" :size="28" weight="duotone"/>

    **Optimization:** The SVG code is optimized both by
    [dvisvgm](https://dvisvgm.de/) and [SVGO](https://svgo.dev/), so the SVGs
    you ship are as small as possible.

-   <PhDatabase color="var(--168-700)" :size="28" weight="duotone"/>

    **Caching:** A simple but robust caching mechanism prevents unnecessary
    recompilations, speeding up build times and helping Vite's
    [**HMR**](https://vitejs.dev/guide/features#hot-module-replacement) remain
    performant.

-   <PhPalette color="var(--168-700)" :size="28" weight="duotone"/>

    **Adaptive theming:** The generated SVGs will use `currentColor` by default.
    Also, **CSS color variables** work anywhere colors work in your LaTeX code
    (excl. gradients).

-   <PhGear color="var(--168-700)" :size="28" weight="duotone"/>

    **Custom transformers:** Inject custom transformers to pre- and post-process
    the in- and output of the TeX handler, respectively.

-   <PhTerminal color="var(--168-700)" :size="28" weight="duotone"/>

    **Relevant error messages:** SvelTeX extracts messages from the LaTeX log,
    categorizes them by severity, and prints each of them to the console with a
    direct link to the line in the Svelte source file at which the problematic
    LaTeX code is located.

</div>


## Configuration

SvelTeX's pipeline for LaTeX is essentially split into three steps:

-   **Compilation:** TeX → DVI/PDF/XDV, done by your chosen LaTeX engine.
-   **Conversion:** DVI/PDF/XDV → SVG, done by dvisvgm or [Poppler](https://poppler.freedesktop.org/).
-   **Optimization:** SVG → Svelte, done with the help of SVGO.

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
                    verbosity: 0b0011,
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
            ignoreLogMessages: [
                'Package shellesc Warning: Shell escape disabled',
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
                // ...
            },
        },
    }
})
```


