hyperfine \
    --prepare 'rm -rf build && mkdir build' \
    --warmup 3 \
    --parameter-list file gradient,plot,text,transparency \
    --export-json benchmark.json \
    --export-csv benchmark.csv \
    --export-markdown benchmark.md \
    'latexmk -pdflua -outdir=build {file}' \
    'latexmk -dvilua -outdir=build {file}-dvi' \
    'latexmk -pdfxe -outdir=build {file}' \
    'latexmk -xdv -outdir=build {file}-dvi' \
    'latexmk -pdf -outdir=build {file}' \
    'latexmk -dvi -outdir=build {file}-dvi' \
    'lualatex --output-format=pdf --output-dir=build {file}' \
    'lualatex --output-format=dvi --output-dir=build {file}-dvi' \
    'pdflatex -output-format=pdf -output-directory=build {file}' \
    'pdflatex -output-format=dvi -output-directory=build {file}-dvi' \
    'xelatex -output-directory=build {file}' \
    'xelatex -output-directory=build -no-pdf {file}-dvi'



# pdflatex -output-format=pdf -output-directory=build gradient &&
# pdflatex -output-format=dvi -output-directory=build gradient-dvi &&
# pdflatex -output-format=pdf -output-directory=build plot &&
# pdflatex -output-format=dvi -output-directory=build plot-dvi &&
# pdflatex -output-format=pdf -output-directory=build text &&
# pdflatex -output-format=dvi -output-directory=build text-dvi &&
# pdflatex -output-format=pdf -output-directory=build transparency &&
# pdflatex -output-format=dvi -output-directory=build transparency-dvi

# dvisvgm --font-format=woff2 --pdf gradient &&
# dvisvgm --font-format=woff2 gradient-dvi &&
# dvisvgm --font-format=woff2 --pdf plot &&
# dvisvgm --font-format=woff2 plot-dvi &&
# dvisvgm --font-format=woff2 --pdf text &&
# dvisvgm --font-format=woff2 text-dvi &&
# dvisvgm --font-format=woff2 --pdf transparency &&
# dvisvgm --font-format=woff2 transparency-dvi
