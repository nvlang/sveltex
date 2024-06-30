
# Conversion

## Converters

### `dvisvgm`

SvelTeX primarily uses [`dvisvgm`] to convert DVI, PDF, and XDV files to SVG. It
does so by spawning a [child process] from which it calls the `dvisvgm` command.

`dvisvgm` is bundled with [TeX Live] and [MiKTeX], so if you can compile a LaTeX
document, you _probably_ have `dvisvgm` installed already.

### Poppler

Intended as a sort of fallback, SvelTeX can be configured to use [Poppler] to
convert PDF files to SVG. Poppler is then called via the [`node-poppler`]
package.

Poppler internally uses [`pdftocairo`] to convert PDF files to SVG.[^1] Poppler
and Cairo are also used by [`pdf2svg`], which is another tool that can be used
to convert PDF files to SVG (though, to be used with SvelTeX, it'd have to be
configured as a custom CLI instruction via the `overrideConversion` setting).

To be clear, Poppler is a fantastic tool, but it's less specialized than
`dvisvgm`, and doesn't work with DVI or XDV files. This last point is
particularly important, since PDF is, compared to DVI or XDV, a lossier
intermediate format for the TeX to SVG pipeline in some regards. Furthermore, in
my testing, Poppler's SVG output has been consistently larger than `dvisvgm`'s
(when the latter is used via DVI/XDV).

[^1]: See [release notes](https://poppler.freedesktop.org/releases.html) for Poppler 0.17.3 from 2011-08-29.

[`dvisvgm`]: https://dvisvgm.de/
[child process]: https://nodejs.org/api/child_process.html
[Poppler]: https://poppler.freedesktop.org/
[`node-poppler`]: https://www.npmjs.com/package/node-poppler
[`pdftocairo`]: https://manpages.ubuntu.com/manpages/noble/man1/pdftocairo.1.html
[`pdf2svg`]: https://github.com/dawbarton/pdf2svg
[TeX Live]: https://tug.org/texlive/
[MiKTeX]: https://miktex.org/
