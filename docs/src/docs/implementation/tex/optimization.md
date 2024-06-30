
# Optimization



## SVGO

SvelTeX uses [SVGO] to optimize SVG files. This is in addition to the
optimizations that `dvisvgm` already performs.

At the cost of a few extra milliseconds of processing time, SVGO can often
reduce the size of the generated SVG files by ≥20% (see [benchmarks] for examples).

[SVGO]: https://svgo.dev/
[benchmarks]: https://sveltex.dev/docs/implementation/tex/benchmarks
