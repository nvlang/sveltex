#!/bin/bash

rm -rf ../../docs/src/docs/implementation/tex/res/benchmarks

# move contents of markdown directory to docs/src/implementation/tex directory
mv markdown/benchmarks.md ../../docs/src/docs/implementation/tex/benchmarks.md
mv markdown/res/benchmarks ../../docs/src/docs/implementation/tex/res/benchmarks
