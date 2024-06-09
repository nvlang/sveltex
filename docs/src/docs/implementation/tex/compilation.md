
# Compilation

## TeX engines

-   **pdfLaTeX**: The default LaTeX engine for SvelTeX. Despite the name, the
    engine can output both PDF and DVI files, and in SvelTeX's case, it's
    configured to output DVI files by default. pdfLaTeX is fast and widespread,
    but it doesn't support OpenType fonts in the same way that LuaLaTeX and
    XeLaTeX do.
-   **LuaLaTeX**: A modern LaTeX engine that supports OpenType fonts and Unicode
    characters. It's slower than pdfLaTeX, but it's very powerful, as it can
    make use of Lua scripts to extend its functionality.
-   **XeLaTeX**: Though slowly waning in popularity (as far as I can tell),
    XeLaTeX is still a powerful LaTeX engine that supports OpenType fonts and
    Unicode characters.
-   **{pdf,Lua}LaTeXmk**: These are _not_ engines, but rather informal names for
    different configurations of [LaTeXmk](https://ctan.org/pkg/latexmk), which
    is a Perl script that automates the process of compiling LaTeX documents by
    running the necessary commands in the correct order. Generally speaking,
    this is useful for documents that need to be compiled multiple times to
    resolve references, citations, tables of contents, indices, bibliographies,
    etc. Though it might seem unlikely that you'd need this within SvelTeX, it's
    still supported.

## Intermediate filetypes

The DVI, XDV, and PDF formats are all intermediate formats that can be generated
by TeX engines. Within SvelTeX they're not user-facing, however, and will be
kept in the caching directory (usually `node_modules/.cache/@nvl/sveltex`).

-   The [device-independent file format (DVI)](https://en.wikipedia.org/wiki/Device_independent_file_format) is LaTeX's original output format, and, although it's becoming progressively rarer due to the prevalence of the PDF, it's essential for Sveltex, as DVI → SVG conversion is much more powerful than PDF → SVG conversion.

-   The [extended DVI file format (XDV)](https://en.wikipedia.org/wiki/XeTeX) is XeLaTeX's custom extension of the DVI format. While this might've been necessary at one point for essential features like supporting custom fonts, newer versions of the DVI format allow LuaLaTeX to support almost all of XeLaTeX's features, while arguably being better maintained.

-   The [portable document format (PDF)](https://en.wikipedia.org/wiki/PDF) is the de facto standard output format for LaTeX documents nowadays. However, it doesn't work nearly as well as DVI for SVG conversion, which is why it's not the default format for Sveltex.
