<script lang="ts" setup>
import PipelineImage from './PipelineImage.vue';
</script>

# Overview

<PipelineImage class="mt-10 mb-8" />

1.  **Compilation (TeX → DVI/PDF/XDV):** This is the most laborious step, and
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

2.  **Conversion (DVI/PDF/XDV → SVG):** Next, the DVI, PDF, or XDV file is
    converted to an SVG file. This step is relatively quick, usually taking
    between ~200ms and ~600ms. In addition to
    [dvisvgm](https://ctan.org/pkg/dvisvgm), which can convert all of the
    aforementioned intermediate file formats, Sveltex also supports
    [Poppler](https://poppler.freedesktop.org) for PDF → SVG conversion
    specifically. However, I'd strongly encourage using DVI/XDV over PDF, and,
    even if using PDF, I'd still recommend using dvisvgm over Poppler. Poppler
    is mainly supported for the sake of having a fallback option.

    -   **dvisvgm:** Run dvisvgm on the DVI/PDF/XDV file by spawning another
        Node.js child process. Then, read the generated SVG file in preparation
        for the optimization step below.
    -   **Poppler:** Call Poppler with
        [`node-poppler`](https://www.npmjs.com/package/node-poppler) to convert
        the PDF to an SVG string.

3.  **Optimization (SVG → Svelte):** Lastly, the SVG code is optimized and
    converted to a Svelte component. This step is extremely quick, usually
    taking less than 10ms.

    1.  **Optimize** the SVG code with
        [`svgo`](https://www.npmjs.com/package/svgo). This will remove
        unnecessary attributes, comments, and other elements from the SVG code.
    2.  **Override** the `.svg` file (if dvisvgm was used) with the optimized SVG code
    3.  **Convert** to a Svelte component. Given that SVGO has already stripped
        the SVG of its DOCTYPE, the only thing left to do to have a Svelte
        component is changing the file extension from `.svg` to `.svelte`.




