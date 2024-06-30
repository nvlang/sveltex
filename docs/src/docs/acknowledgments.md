
# Acknowledgments

Like all software, SvelTeX owes an immense debt to prior work. Below I list a
small fraction of the works on which SvelTeX relies, focusing on direct
dependencies.

All of the software listed below is open-source, available under MIT, GPL, or
(in the case of fonts) SIL licences.


## Inspiration

Without these the project would've had little reason to exist:

-   **[Svelte]:** The frontend JS framework for which this project is built.
-   **[LaTeX]:** An incredibly powerful typesetting system with a huge ecosystem
    of packages.
-   **[PGF/TikZ]:** An amazing vector graphics language in TeX.

Similar works to SvelTeX, which also inspired it:

-   **[MDsveX]:** A great Svelte preprocessor that's become the de facto
    standard for Svelte Markdown processing.

## Libraries

### Direct dependencies

-   **[micromark]:** A tiny, very powerful markdown parser. Most of SvelTeX's
    parsing functionality is powered by micromark.

### Indirect dependencies

-   **[`dvisvgm`]:** A fantastic tool for converting DVI, PDF, and XDV files to SVG.
    Bundled with [texlive].

    **Note:** SvelTeX doesn't bundle it `dvisvgm`, but rather spawns child processes
    that invokes `dvisvgm` on the user's system, if it is available. As such,
    SvelTeX can be licensed under MIT, despite `dvisvgm` being GPL. This is my
    understanding, anyhow.

### Development

-   **[Vitest]:** Unit testing.
-   **[Playwright]:** Integration testing.
-   **[`fast-check`]:** Property-based testing (aka. fuzzy testing).
-   **[Knip]:** Project linter to find unused files, dependencies and exports.


## Site

-   **[VitePress]:** Great SSG using Vite and Vue to render docs from Markdown.

### Syntax highlighting

-   **[Shiki]:** A beautiful, fast, and feature-rich syntax highlighter.
-   **[`twoslash`]:** Powers the IntelliSense in the code blocks, together with [`floating-vue`].

### Graphics

-   **[Phosphor icons]:** A wonderful collection of 1,200+ icons in 6 weights
    each.

### Typography

-   **[Inter]:** An extremely high-quality sans-serif.
-   **[Monaspace]:** Advanced superfamily of monospaced fonts by GitHub Next.


## And so much more

This list could go on and on, but it might become a bit frivolous at some point;
after all, backtracking dependencies and intellectual debts is often an endless
pursuit.


[Svelte]: https://svelte.dev
[LaTeX]: https://www.latex-project.org
[PGF/TikZ]: https://www.ctan.org/pkg/pgf
[MDsveX]: https://mdsvex.pngwn.io/

[micromark]: https://github.com/micromark/micromark

[`dvisvgm`]: https://dvisvgm.de/
[texlive]: https://en.wikipedia.org/wiki/TeX_Live

[Vitest]: https://vitest.dev/
[Playwright]: https://playwright.dev/
[`fast-check`]: https://fast-check.dev/
[Knip]: https://knip.dev/

[VitePress]: https://vitepress.dev/
[Shiki]: https://shiki.style/
[`twoslash`]: https://shikijs.github.io/twoslash/
[`floating-vue`]: https://floating-vue.starpad.dev/

[Phosphor icons]: https://phosphoricons.com/
[Inter]: https://rsms.me/inter/
[Monaspace]: https://monaspace.githubnext.com/
