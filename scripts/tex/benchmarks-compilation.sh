#!/bin/bash

mkdir -p results

# Prepare the environment and perform initial benchmarks
hyperfine \
    --prepare 'rm -f *.aux *.log *.pdf *.dvi *.xdv *.fdb_latexmk *.fls' \
    --warmup 3 \
    --parameter-list file gradient,plot,text,transparency \
    --export-json results/benchmarks-compilation.json \
    --export-csv results/benchmarks-compilation.csv \
    --export-markdown results/benchmarks-compilation.md \
    'latexmk -pdflua "files/pdf/{file}"' \
    'latexmk -dvilua "files/dvi/{file}"' \
    'latexmk -pdfxe "files/pdf/{file}"' \
    'latexmk -xdv "files/dvi/{file}"' \
    'latexmk -pdf "files/pdf/{file}"' \
    'latexmk -dvi "files/dvi/{file}"' \
    'lualatex --output-format=pdf "files/pdf/{file}"' \
    'lualatex --output-format=dvi "files/dvi/{file}"' \
    'pdflatex -output-format=pdf "files/pdf/{file}"' \
    'pdflatex -output-format=dvi "files/dvi/{file}"' \
    'xelatex "files/pdf/{file}"' \
    'xelatex -no-pdf "files/dvi/{file}"'





# hyperfine \
#     --prepare 'rm -rf build && mkdir build' \
#     --warmup 3 \
#     --parameter-list file gradient,plot,text,transparency \
#     --export-json benchmarks-compilation.json \
#     --export-csv benchmarks-compilation.csv \
#     --export-markdown benchmarks-compilation.md \
#     'latexmk -pdflua -outdir=build files/pdf/{file}' \
#     'latexmk -dvilua -outdir=build files/dvi/{file}' \
#     'latexmk -pdfxe -outdir=build files/pdf/{file}' \
#     'latexmk -xdv -outdir=build files/dvi/{file}' \
#     'latexmk -pdf -outdir=build files/pdf/{file}' \
#     'latexmk -dvi -outdir=build files/dvi/{file}' \
#     'lualatex --output-format=pdf --output-dir=build files/pdf/{file}' \
#     'lualatex --output-format=dvi --output-dir=build files/dvi/{file}' \
#     'pdflatex -output-format=pdf -output-directory=build files/pdf/{file}' \
#     'pdflatex -output-format=dvi -output-directory=build files/dvi/{file}' \
#     'xelatex -output-directory=build files/pdf/{file}' \
#     'xelatex -no-pdf -output-directory=build files/dvi/{file}'


# dvisvgm --font-format=woff2 --pdf gradient &&
# dvisvgm --font-format=woff2 gradient-dvi &&
# dvisvgm --font-format=woff2 --pdf plot &&
# dvisvgm --font-format=woff2 plot-dvi &&
# dvisvgm --font-format=woff2 --pdf text &&
# dvisvgm --font-format=woff2 text-dvi &&
# dvisvgm --font-format=woff2 --pdf transparency &&
# dvisvgm --font-format=woff2 transparency-dvi


# pdflatex -output-format=pdf -output-directory=build gradient &&
# pdflatex -output-format=dvi -output-directory=build gradient-dvi &&
# pdflatex -output-format=pdf -output-directory=build plot &&
# pdflatex -output-format=dvi -output-directory=build plot-dvi &&
# pdflatex -output-format=pdf -output-directory=build text &&
# pdflatex -output-format=dvi -output-directory=build text-dvi &&
# pdflatex -output-format=pdf -output-directory=build transparency &&
# pdflatex -output-format=dvi -output-directory=build transparency-dvi
