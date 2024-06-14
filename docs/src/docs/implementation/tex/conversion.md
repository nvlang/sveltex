
# Conversion

SvelTeX primarily uses [`dvisvgm`] to convert DVI, PDF, and XDV files to SVG. It
does so by spawning a [child process] from which it calls the `dvisvgm` command.





[`dvisvgm`]: https://dvisvgm.de/
[child process]: https://nodejs.org/api/child_process.html
